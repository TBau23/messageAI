# Phase 3: Offline Persistence & Message Sync
**Technical Design Document**

## Overview

Implement local message persistence and offline support to enable:
- Instant message loading from local cache
- Offline message viewing (read chat history without internet)
- Offline message sending (queue and auto-send when online)
- Persistent storage across app restarts/force-quits

**Success Criteria**: App works like WhatsApp - messages load instantly, sending works offline, everything syncs when reconnected.

## Architecture

### Dual-Storage Strategy

```
┌─────────────┐         ┌──────────────┐
│   SQLite    │ ←──┐    │   Firestore  │
│   (Local)   │    │    │   (Cloud)    │
└─────────────┘    │    └──────────────┘
                   │            ↑
                   │            │
                   │    ┌───────┴────────┐
                   └────┤  Sync Manager  │
                        └────────────────┘
                               ↑
                        ┌──────┴───────┐
                        │ Network State│
                        │   Monitor    │
                        └──────────────┘
```

### Data Flow

**Sending a Message:**
1. User taps "Send"
2. Generate unique `localId` (timestamp-based)
3. Write to SQLite immediately → UI updates instantly
4. If online: Send to Firestore
5. If offline: Add to `pending_messages` queue
6. Update message status when Firestore confirms

**Receiving a Message:**
1. Firestore listener fires (when online)
2. Write to SQLite
3. Update UI from SQLite
4. Mark message as synced

**Loading Messages:**
1. Open chat → Load from SQLite first (instant)
2. Subscribe to Firestore listener (background)
3. Merge incoming Firestore messages into SQLite
4. UI updates from SQLite

## SQLite Database Schema

### Tables

**1. conversations**
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'direct' or 'group'
  participants TEXT NOT NULL,  -- JSON array of userIds
  name TEXT,  -- for groups
  lastMessage TEXT,  -- JSON object
  lastMessageText TEXT,
  lastMessageTime INTEGER,
  updatedAt INTEGER,
  createdAt INTEGER,
  synced INTEGER DEFAULT 1  -- 1 = synced, 0 = pending
);
```

**2. messages**
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,  -- Firestore doc ID
  localId TEXT UNIQUE,  -- Local unique ID for optimistic updates
  conversationId TEXT NOT NULL,
  text TEXT NOT NULL,
  senderId TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  status TEXT DEFAULT 'sent',  -- 'sending', 'sent', 'delivered', 'read', 'failed'
  deliveredTo TEXT,  -- JSON array
  readBy TEXT,  -- JSON array
  synced INTEGER DEFAULT 0,  -- 0 = local only, 1 = synced to Firestore
  FOREIGN KEY (conversationId) REFERENCES conversations(id)
);

CREATE INDEX idx_messages_conversation ON messages(conversationId, timestamp);
CREATE INDEX idx_messages_localId ON messages(localId);
CREATE INDEX idx_messages_synced ON messages(synced);
```

**3. pending_messages**
```sql
CREATE TABLE pending_messages (
  localId TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL,
  text TEXT NOT NULL,
  senderId TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  retryCount INTEGER DEFAULT 0,
  lastRetryAt INTEGER,
  error TEXT
);
```

**4. sync_state**
```sql
CREATE TABLE sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);
-- Stores: lastSyncTime, pendingOperations, etc.
```

## Implementation Components

### 1. Database Manager (`utils/database.js`)

**Responsibilities:**
- Initialize SQLite database
- Create/migrate tables
- Provide CRUD operations
- Handle database errors

**Key Functions:**
```javascript
initDatabase()
getMessages(conversationId)
saveMessage(message)
updateMessageStatus(localId, status)
getConversations(userId)
saveConversation(conversation)
getPendingMessages()
addPendingMessage(message)
removePendingMessage(localId)
```

### 2. Sync Manager (`utils/syncManager.js`)

**Responsibilities:**
- Coordinate SQLite ↔ Firestore sync
- Handle conflict resolution
- Process pending message queue
- Batch operations for efficiency

**Key Functions:**
```javascript
syncMessages(conversationId)  // Pull from Firestore → SQLite
pushPendingMessages()  // Push queued messages to Firestore
resolveConflicts()  // Firestore = source of truth
cleanupOldMessages()  // Optional: Delete old cached messages
```

**Sync Logic:**
```javascript
// When Firestore listener fires with new message:
1. Check if message exists in SQLite (by Firestore ID)
2. If exists: Update if Firestore version is newer
3. If not exists: Insert into SQLite
4. Remove from pending_messages if it was ours
5. Notify UI to refresh
```

### 3. Network Monitor (`utils/networkMonitor.js`)

**Responsibilities:**
- Detect online/offline state
- Trigger sync when connectivity restored
- Provide network status to UI

**Implementation:**
```javascript
import NetInfo from '@react-native-community/netinfo';

let isOnline = true;
let unsubscribe;

export const startNetworkMonitoring = (onStatusChange) => {
  unsubscribe = NetInfo.addEventListener(state => {
    const wasOffline = !isOnline;
    isOnline = state.isConnected && state.isInternetReachable;
    
    onStatusChange(isOnline);
    
    // If we just came online, sync pending messages
    if (wasOffline && isOnline) {
      syncManager.pushPendingMessages();
    }
  });
};

export const getNetworkState = () => isOnline;
export const stopNetworkMonitoring = () => unsubscribe?.();
```

### 4. Updated Chat Store (`store/chatStore.js`)

**Changes:**
- Replace direct Firestore calls with database manager calls
- Add offline queue logic
- Load from SQLite first, Firestore second
- Handle sync status

**Modified `sendMessage` Function:**
```javascript
sendMessage: async (conversationId, senderId, text) => {
  const localId = `local_${Date.now()}_${Math.random()}`;
  const timestamp = Date.now();
  
  // 1. Create optimistic message
  const message = {
    localId,
    conversationId,
    text,
    senderId,
    timestamp,
    status: 'sending',
    deliveredTo: [senderId],
    readBy: [senderId],
    synced: 0
  };
  
  // 2. Save to SQLite immediately
  await database.saveMessage(message);
  
  // 3. Update UI from SQLite
  const messages = await database.getMessages(conversationId);
  set({ messages });
  
  // 4. Try to send to Firestore
  if (networkMonitor.getNetworkState()) {
    try {
      const docRef = await addDoc(
        collection(db, `conversations/${conversationId}/messages`),
        {
          text,
          senderId,
          timestamp: serverTimestamp(),
          deliveredTo: [senderId],
          readBy: [senderId],
          status: 'sent'
        }
      );
      
      // Update SQLite with Firestore ID and mark synced
      await database.updateMessage(localId, {
        id: docRef.id,
        synced: 1,
        status: 'sent'
      });
      
      // Update conversation's lastMessage
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: { text, senderId, timestamp: serverTimestamp() },
        updatedAt: serverTimestamp()
      });
      
    } catch (error) {
      console.error('Send failed:', error);
      await database.updateMessageStatus(localId, 'failed');
    }
  } else {
    // We're offline - add to pending queue
    await database.addPendingMessage(message);
  }
};
```

**Modified `subscribeToMessages` Function:**
```javascript
subscribeToMessages: (conversationId) => {
  // Load from SQLite immediately
  database.getMessages(conversationId).then(messages => {
    set({ messages });
  });
  
  // Then subscribe to Firestore (if online)
  if (networkMonitor.getNetworkState()) {
    const q = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('timestamp', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Save each Firestore message to SQLite
      for (const doc of snapshot.docs) {
        const firestoreMsg = { id: doc.id, ...doc.data() };
        await database.upsertMessage(firestoreMsg);
      }
      
      // Reload from SQLite (single source of truth for UI)
      const messages = await database.getMessages(conversationId);
      set({ messages });
    });
    
    return unsubscribe;
  }
  
  // Return dummy unsubscribe if offline
  return () => {};
};
```

## Message Status Lifecycle

```
[User sends message]
        ↓
    "sending" (clock icon ⏱)
        ↓
   [Saved to SQLite]
        ↓
   [Online?] ──No──→ "queued" (clock icon ⏱) → [Add to pending_messages]
        ↓                                              ↓
       Yes                                    [Wait for online]
        ↓                                              ↓
   [Send to Firestore]                        [Retry sending]
        ↓                                              ↓
    "sent" (✓)  ←──────────────────────────────────────┘
        ↓
   [Delivered to recipient device]
        ↓
    "delivered" (✓✓)
        ↓
   [Recipient opens chat]
        ↓
    "read" (✓✓ blue)
```

## UI Updates

### Network Status Indicator

Add to chat screens:

```javascript
const NetworkBanner = ({ isOnline }) => {
  if (isOnline) return null;
  
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineText}>No connection - Messages will send when online</Text>
    </View>
  );
};
```

### Message Status Icons

Update message rendering:

```javascript
const getStatusIcon = (message, isMyMessage) => {
  if (!isMyMessage) return null;
  
  switch (message.status) {
    case 'sending':
    case 'queued':
      return '⏱';
    case 'failed':
      return '!';
    case 'sent':
      return '✓';
    case 'delivered':
      return '✓✓';
    case 'read':
      return '✓✓'; // TODO: Make blue
    default:
      return '';
  }
};
```

### Retry Failed Messages

```javascript
const onMessagePress = async (message) => {
  if (message.status === 'failed') {
    Alert.alert(
      'Message Failed',
      'This message failed to send. Try again?',
      [
        { text: 'Delete', onPress: () => deleteMessage(message.localId) },
        { text: 'Retry', onPress: () => retryMessage(message.localId) }
      ]
    );
  }
};
```

## Edge Cases & Error Handling

### 1. Message Ordering

**Problem**: Offline messages sent at 3:00 PM might sync after messages sent at 3:05 PM when back online.

**Solution**: 
- Use client-side timestamp for ordering in UI
- Firestore `serverTimestamp()` for server record
- Sort by client timestamp in SQLite queries

### 2. Duplicate Messages

**Problem**: Same message could appear twice (local + Firestore).

**Solution**:
- Match by `localId` when Firestore message arrives
- If found, update existing row with Firestore ID
- If not found, it's from another device → insert

### 3. Database Corruption

**Problem**: SQLite file gets corrupted (rare but possible).

**Solution**:
```javascript
try {
  await database.init();
} catch (error) {
  console.error('DB corrupt, rebuilding:', error);
  await database.delete();
  await database.init();
  // User loses local cache but Firestore is intact
}
```

### 4. Conflicting Edits

**Problem**: User edits message offline, someone else deletes it online.

**Solution**: 
- Firestore = source of truth
- On sync, Firestore state overwrites local
- For MVP: No message editing (future feature)

### 5. Large Message History

**Problem**: 10,000 messages in a chat → slow SQLite queries.

**Solution**:
- Paginate: Load last 50 messages initially
- Lazy load older messages on scroll
- Optional: Delete messages older than 30 days from SQLite (keep in Firestore)

## Testing Strategy

### Unit Tests
- Database CRUD operations
- Sync conflict resolution
- Network state transitions

### Integration Tests
1. **Offline Write → Online Sync**
   - Go offline
   - Send 5 messages
   - Go online
   - Verify all 5 send in order

2. **Offline Read**
   - Load messages while online
   - Go offline
   - Open chat → messages still visible

3. **Force Quit Persistence**
   - Send messages
   - Force quit app
   - Reopen → messages still there

4. **Multi-Device Sync**
   - Device A sends message
   - Device B receives (while online)
   - Device B goes offline → still sees message

5. **Airplane Mode Toggle**
   - Rapid online/offline switching
   - Verify no duplicate messages
   - Verify queue processes correctly

### Manual Test Checklist
- [ ] Send message while online → instant delivery
- [ ] Send message while offline → shows queued status
- [ ] Go back online → queued message sends automatically
- [ ] Open chat while offline → messages load from cache
- [ ] Force quit and reopen → all messages persist
- [ ] Failed message shows retry option
- [ ] Network banner appears when offline
- [ ] Messages load instantly (< 100ms from SQLite)
- [ ] Two devices sync in real-time
- [ ] Old conversations load properly

## Performance Targets

- **Message load time**: < 100ms from SQLite (50 messages)
- **Send latency**: < 50ms to SQLite, UI updates immediately
- **Sync latency**: < 2s after coming online
- **Memory usage**: < 50MB for 10,000 cached messages
- **App size increase**: < 5MB (SQLite is native)

## Future Enhancements (Post-MVP)

- Message search (SQLite FTS - Full Text Search)
- Export chat history
- Selective sync (only recent conversations)
- Message encryption at rest
- Backup/restore from SQLite
- Analytics on sync failures

## Implementation Checklist

### Step 1: Database Setup
- [ ] Create `utils/database.js`
- [ ] Define SQLite schema
- [ ] Implement CRUD functions
- [ ] Test basic read/write

### Step 2: Network Monitoring
- [ ] Create `utils/networkMonitor.js`
- [ ] Integrate NetInfo
- [ ] Add status change listeners
- [ ] Test online/offline detection

### Step 3: Sync Manager
- [ ] Create `utils/syncManager.js`
- [ ] Implement message sync logic
- [ ] Implement pending queue processor
- [ ] Test conflict resolution

### Step 4: Update Chat Store
- [ ] Modify `sendMessage` for dual-write
- [ ] Modify `subscribeToMessages` to load from SQLite first
- [ ] Add queue management functions
- [ ] Add retry logic

### Step 5: UI Updates
- [ ] Add network status banner
- [ ] Update message status icons
- [ ] Add retry failed message UI
- [ ] Test all status transitions

### Step 6: Testing
- [ ] Manual offline testing
- [ ] Multi-device sync testing
- [ ] Force quit persistence testing
- [ ] Edge case testing

---

**Estimated Effort**: 4-6 hours implementation + 2 hours testing  
**Risk Level**: Medium (SQLite is stable, sync logic is complex)  
**Dependency**: `expo-sqlite` (already installed)

**Next Steps**: Review this doc, then begin implementation starting with database setup.


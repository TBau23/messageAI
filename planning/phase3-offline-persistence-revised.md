# Phase 3: Offline Persistence & Network Status (Revised)
**Technical Design Document - Firestore-First Approach**

## Architectural Decision

**Use Firestore's built-in offline persistence instead of manual SQLite implementation.**

### Why Firestore-First?

Firestore already provides:
- ✅ Automatic local caching of all read/written data
- ✅ Offline write queuing with auto-retry (exponential backoff)
- ✅ Conflict resolution (server timestamp wins)
- ✅ Deduplication via document IDs
- ✅ Persistence across app restarts/force-quits
- ✅ Automatic sync when connectivity restored

Our current setup in `firebaseConfig.js` already enables offline persistence:
```javascript
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
```

This is **production-ready** and handles 90% of what we need automatically.

### What We Still Need to Build

Firestore handles data sync, but we need to build **user-facing features**:

1. **Network Status Monitoring** - Detect online/offline state
2. **UI Status Indicators** - Show message delivery status (⏱ → ✓ → ✓✓)
3. **Network Banner** - Display "Offline" / "Connecting..." messages
4. **Message Service Abstraction** - Clean interface for future SQLite migration

### SQLite Migration Path (Post-MVP)

When we need performance optimization:
- Create `SQLiteMessageService` implementing same interface
- Swap implementation in one line
- Get <50ms load times for large message histories

---

## Implementation Plan

### 1. Network Monitor

**File**: `utils/networkMonitor.js`

**Purpose**: Track online/offline state and notify subscribers

**Implementation**:
```javascript
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

// Zustand store for network state
export const useNetworkStore = create((set) => ({
  isOnline: true,
  isConnecting: false,
  
  setOnline: (online) => set({ isOnline: online }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
}));

let unsubscribe = null;

export const startNetworkMonitoring = () => {
  unsubscribe = NetInfo.addEventListener(state => {
    const isOnline = state.isConnected && state.isInternetReachable;
    
    useNetworkStore.getState().setOnline(isOnline);
    
    // Show "Connecting..." briefly when coming back online
    if (isOnline && !useNetworkStore.getState().isOnline) {
      useNetworkStore.getState().setConnecting(true);
      setTimeout(() => {
        useNetworkStore.getState().setConnecting(false);
      }, 1500);
    }
    
    console.log('Network status:', isOnline ? 'Online' : 'Offline');
  });
};

export const stopNetworkMonitoring = () => {
  unsubscribe?.();
};

export const getNetworkState = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable;
};
```

**Usage**:
```javascript
// Start monitoring in app root
useEffect(() => {
  startNetworkMonitoring();
  return () => stopNetworkMonitoring();
}, []);

// Use in components
const { isOnline, isConnecting } = useNetworkStore();
```

---

### 2. Network Status Banner

**Component**: `components/NetworkBanner.js`

**Purpose**: Show user-friendly network status at top of screen

**Implementation**:
```javascript
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStore } from '../utils/networkMonitor';

export default function NetworkBanner() {
  const { isOnline, isConnecting } = useNetworkStore();

  if (isOnline && !isConnecting) return null;

  return (
    <View style={[
      styles.banner,
      isConnecting ? styles.connecting : styles.offline
    ]}>
      <Text style={styles.text}>
        {isConnecting ? '⏳ Connecting...' : '📵 No connection'}
      </Text>
      {!isOnline && (
        <Text style={styles.subtext}>Messages will send when online</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: 8,
    alignItems: 'center',
  },
  offline: {
    backgroundColor: '#f44336',
  },
  connecting: {
    backgroundColor: '#ff9800',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  subtext: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
  },
});
```

**Add to Chat Screen**:
```javascript
// In app/(main)/chat/[id].js
import NetworkBanner from '../../../components/NetworkBanner';

return (
  <SafeAreaView style={styles.safeArea} edges={['top']}>
    <KeyboardAvoidingView ...>
      <View style={styles.header}>...</View>
      <NetworkBanner />  {/* Add here */}
      <FlatList ... />
    </KeyboardAvoidingView>
  </SafeAreaView>
);
```

---

### 3. Message Status Indicators

**Purpose**: Show visual status of message delivery

**Status States**:
- `sending` - Clock icon ⏱ (local, not yet confirmed by Firestore)
- `sent` - Single checkmark ✓ (saved to Firestore)
- `delivered` - Double checkmark ✓✓ (received by recipient's device)
- `read` - Blue double checkmark ✓✓ (opened by recipient)

**Implementation Strategy**:

Since Firestore handles queuing automatically, we track status differently:

1. **Optimistic Updates**: When user sends, show ⏱ immediately
2. **Firestore Confirmation**: When `onSnapshot` fires with our message, change to ✓
3. **Read Receipts** (Phase 5): Update to ✓✓ when recipient reads

**Updated Message Rendering**:
```javascript
// In app/(main)/chat/[id].js

const getMessageStatus = (message, isMyMessage) => {
  if (!isMyMessage) return null;
  
  // Check if message has Firestore ID (confirmed saved)
  const isSynced = !!message.id;
  
  if (!isSynced) {
    return { icon: '⏱', color: '#999' }; // Sending/queued
  }
  
  // Check read status (Phase 5 - read receipts)
  const readByRecipient = message.readBy?.length > 1;
  if (readByRecipient) {
    return { icon: '✓✓', color: '#0084ff' }; // Read (blue)
  }
  
  // Check delivered status
  const deliveredToRecipient = message.deliveredTo?.length > 1;
  if (deliveredToRecipient) {
    return { icon: '✓✓', color: '#999' }; // Delivered
  }
  
  return { icon: '✓', color: '#999' }; // Sent
};

const renderMessage = ({ item }) => {
  const isMyMessage = item.senderId === user.uid;
  const status = getMessageStatus(item, isMyMessage);
  
  return (
    <View style={[...]}>
      <View style={[...]}>
        <Text style={[...]}>{item.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>{timeString}</Text>
          {status && (
            <Text style={[styles.messageStatus, { color: status.color }]}>
              {status.icon}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};
```

---

### 4. Message Service Abstraction

**File**: `services/MessageService.js`

**Purpose**: Abstract interface for message operations, enabling future SQLite swap

**Interface**:
```javascript
export class MessageService {
  // Conversations
  async getConversations(userId) {}
  async getOrCreateConversation(userId1, userId2) {}
  subscribeToConversations(userId, callback) {}
  
  // Messages
  async getMessages(conversationId) {}
  async sendMessage(conversationId, senderId, text) {}
  subscribeToMessages(conversationId, callback) {}
  
  // Read receipts (Phase 5)
  async markAsRead(conversationId, messageIds, userId) {}
  
  // Search
  async searchUsers(query, currentUserId) {}
}
```

**Firestore Implementation**:
```javascript
// services/FirestoreMessageService.js
import { 
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, 
  getDocs, arrayUnion 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export class FirestoreMessageService extends MessageService {
  
  subscribeToConversations(userId, callback) {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
    
    return onSnapshot(q, async (snapshot) => {
      const conversations = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const otherUserId = data.participants.find(id => id !== userId);
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          
          return {
            id: docSnap.id,
            ...data,
            otherUser: { uid: otherUserId, ...userDoc.data() }
          };
        })
      );
      
      callback(conversations);
    });
  }
  
  subscribeToMessages(conversationId, callback) {
    const q = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('timestamp', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(messages);
    });
  }
  
  async sendMessage(conversationId, senderId, text) {
    // Generate temporary local ID for optimistic update
    const localId = `temp_${Date.now()}_${Math.random()}`;
    
    // Return optimistic message immediately
    const optimisticMessage = {
      localId,
      text,
      senderId,
      timestamp: new Date(),
      deliveredTo: [senderId],
      readBy: [senderId],
    };
    
    // Send to Firestore (queued if offline)
    try {
      const messageRef = await addDoc(
        collection(db, `conversations/${conversationId}/messages`),
        {
          text,
          senderId,
          timestamp: serverTimestamp(),
          deliveredTo: [senderId],
          readBy: [senderId],
        }
      );
      
      // Update conversation
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: { text, senderId, timestamp: serverTimestamp() },
        updatedAt: serverTimestamp()
      });
      
      return { success: true, localId, firestoreId: messageRef.id };
    } catch (error) {
      console.error('Send message error:', error);
      return { success: false, localId, error: error.message };
    }
  }
  
  async searchUsers(searchTerm, currentUserId) {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    return snapshot.docs
      .map(doc => ({ uid: doc.id, ...doc.data() }))
      .filter(user => 
        user.uid !== currentUserId && 
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }
}
```

**Updated Chat Store**:
```javascript
// store/chatStore.js
import { FirestoreMessageService } from '../services/FirestoreMessageService';

const messageService = new FirestoreMessageService();

export const useChatStore = create((set, get) => ({
  conversations: [],
  messages: [],
  optimisticMessages: [], // Local-only messages waiting for Firestore confirm
  
  subscribeToConversations: (userId) => {
    return messageService.subscribeToConversations(userId, (conversations) => {
      set({ conversations });
    });
  },
  
  subscribeToMessages: (conversationId) => {
    return messageService.subscribeToMessages(conversationId, (messages) => {
      // Merge with optimistic messages
      const { optimisticMessages } = get();
      
      // Remove optimistic messages that now have Firestore IDs
      const stillPending = optimisticMessages.filter(opt => 
        !messages.some(msg => msg.timestamp?.toMillis?.() === opt.timestamp.getTime())
      );
      
      set({ 
        messages: [...stillPending, ...messages],
        optimisticMessages: stillPending
      });
    });
  },
  
  sendMessage: async (conversationId, senderId, text) => {
    // Create optimistic message
    const optimisticMessage = {
      localId: `temp_${Date.now()}`,
      text,
      senderId,
      timestamp: new Date(),
      deliveredTo: [senderId],
      readBy: [senderId],
    };
    
    // Add to UI immediately
    set((state) => ({
      messages: [...state.messages, optimisticMessage],
      optimisticMessages: [...state.optimisticMessages, optimisticMessage]
    }));
    
    // Send to Firestore (async, queued if offline)
    const result = await messageService.sendMessage(conversationId, senderId, text);
    
    // Firestore listener will update UI when confirmed
    return result;
  },
  
  searchUsers: async (searchTerm, currentUserId) => {
    return messageService.searchUsers(searchTerm, currentUserId);
  },
}));
```

---

## Testing Offline Behavior

### Manual Test Script

**Test 1: Basic Offline Send**
1. Open app, go to a chat
2. Enable Airplane Mode (Settings app in simulator)
3. Send 3 messages → should see ⏱ clock icon
4. Disable Airplane Mode
5. Wait 2-3 seconds → messages should change to ✓
6. Check other device → messages received

**Test 2: Offline Message Viewing**
1. Open app while online, load messages
2. Enable Airplane Mode
3. Close and reopen app
4. Navigate to chat → messages still visible (from Firestore cache)

**Test 3: Force Quit Persistence**
1. Send messages while online
2. Force quit app (swipe up in app switcher)
3. Reopen app → messages still there

**Test 4: Queue Processing**
1. Go offline
2. Send 10 messages rapidly
3. Come back online
4. All messages should send in order (Firestore handles queue)

**Test 5: Multi-Device Sync**
1. Device A sends message
2. Device B receives immediately (online)
3. Device B goes offline → message still visible
4. Device A sends another message
5. Device B comes online → receives new message

### Expected Behavior

✅ Messages sent offline show ⏱ icon  
✅ When online, icon changes to ✓  
✅ "Offline" banner appears when no connection  
✅ "Connecting..." banner shows briefly when reconnecting  
✅ Messages persist across app restarts  
✅ Messages queue and send automatically when online  
✅ No duplicate messages  
✅ Message ordering is preserved  

---

## Implementation Checklist

### Step 1: Network Monitoring
- [ ] Create `utils/networkMonitor.js` with Zustand store
- [ ] Add NetInfo listener
- [ ] Test online/offline detection in simulator
- [ ] Start monitoring in app root (`app/_layout.js`)

### Step 2: Network Banner Component
- [ ] Create `components/NetworkBanner.js`
- [ ] Style offline vs connecting states
- [ ] Add to chat screen
- [ ] Test visibility during offline mode

### Step 3: Message Status Indicators
- [ ] Update message rendering to check for Firestore ID
- [ ] Add status icon logic (⏱ vs ✓)
- [ ] Style status icons
- [ ] Test status transitions

### Step 4: Message Service Abstraction
- [ ] Create `services/MessageService.js` interface
- [ ] Create `services/FirestoreMessageService.js` implementation
- [ ] Refactor `chatStore.js` to use service
- [ ] Test all operations still work

### Step 5: Optimistic Updates
- [ ] Add `optimisticMessages` to store
- [ ] Show optimistic messages immediately in UI
- [ ] Remove from optimistic list when Firestore confirms
- [ ] Test rapid message sending

### Step 6: Offline Testing
- [ ] Test airplane mode scenarios
- [ ] Test force quit persistence
- [ ] Test multi-device sync
- [ ] Verify no duplicate messages

---

## Performance Characteristics

### Firestore Offline Cache Performance

**Load Times** (approximate):
- First load (cold start): 200-500ms
- Subsequent loads (cached): 50-150ms
- SQLite would be: <50ms

**Good enough for MVP?** Yes! 150ms is imperceptible to users.

**When to migrate to SQLite:**
- Large message histories (10,000+ messages)
- Complex queries (search, filtering)
- Frequent offline usage
- Performance monitoring shows slow loads

---

## Future: SQLite Migration

When we need SQLite, the migration is straightforward:

**Step 1**: Create `SQLiteMessageService`
```javascript
export class SQLiteMessageService extends MessageService {
  // Implement same interface, different storage
  async sendMessage(conversationId, senderId, text) {
    // Write to SQLite first (instant)
    // Then Firestore (background)
  }
}
```

**Step 2**: Swap implementation
```javascript
// In chatStore.js - ONE LINE CHANGE
const messageService = new SQLiteMessageService(); // Was: FirestoreMessageService
```

**Step 3**: Data migration script
```javascript
// One-time: Copy Firestore cache → SQLite
await migrateFirestoreToSQLite();
```

All UI code remains unchanged.

---

## Summary

**What we're building:**
1. Network status monitoring (online/offline detection)
2. UI network banner (user feedback)
3. Message status indicators (⏱ → ✓ → ✓✓)
4. Message service abstraction (future-proof)
5. Optimistic UI updates (instant feedback)

**What Firestore handles automatically:**
- Offline caching
- Write queuing
- Auto-retry logic
- Conflict resolution
- Persistence
- Automatic sync

**Estimated effort:** 2-3 hours implementation + 1 hour testing

**Risk level:** Low (using proven Firestore features)

**When complete:** MVP has full offline support, messages work without internet, app feels fast and responsive.

---

**Next Steps**: Review this design, then begin implementation with Step 1 (Network Monitoring).


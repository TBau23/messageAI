# Phase 1: Offline-First Architecture
## Technical Design Document

**Goal**: Achieve 12/12 points on "Offline Support & Persistence"  
**Target**: Sub-1 second sync, zero message loss, graceful offline handling

---

## 1. ARCHITECTURE OVERVIEW

### Current State
- Messages stored only in Firestore
- Optimistic updates in Zustand (memory only)
- Network monitoring via NetInfo
- No true offline persistence

### Target State
```
User Action
    ↓
Zustand Store (UI State)
    ↓
SQLite (Local Truth) ← Sync Engine → Firestore (Cloud Truth)
    ↓
Real-time Listeners
```

**Key Principle**: SQLite is the primary source of truth. Firestore is the sync layer.

---

## 2. DATABASE SCHEMA

### SQLite Tables

```sql
-- Messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,              -- Firestore ID (null if not synced yet)
  local_id TEXT UNIQUE NOT NULL,    -- Client-generated UUID
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp INTEGER NOT NULL,       -- Unix milliseconds
  client_sent_at INTEGER NOT NULL,
  
  -- Sync status
  sync_status TEXT NOT NULL,        -- 'synced', 'pending', 'failed'
  retry_count INTEGER DEFAULT 0,
  last_retry_at INTEGER,
  
  -- Delivery tracking (stored as JSON strings)
  delivered_to TEXT,                -- JSON array of user IDs
  read_by TEXT,                     -- JSON array of user IDs
  delivered_receipts TEXT,          -- JSON object {userId: timestamp}
  read_receipts TEXT,               -- JSON object {userId: timestamp}
  
  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  INDEX idx_conversation_timestamp (conversation_id, timestamp),
  INDEX idx_sync_status (sync_status)
);

-- Conversations table (cached from Firestore)
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,               -- 'direct' | 'group'
  name TEXT,                        -- Group name
  participants TEXT NOT NULL,       -- JSON array of user IDs
  last_message TEXT,                -- JSON object
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  
  INDEX idx_updated_at (updated_at DESC)
);

-- Users table (cached participant data)
CREATE TABLE users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  online INTEGER DEFAULT 0,         -- 0 or 1 (SQLite boolean)
  last_seen INTEGER,
  profile_photo_url TEXT,
  cached_at INTEGER NOT NULL,
  
  INDEX idx_display_name (display_name)
);

-- Sync queue (explicit queue for failed operations)
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL,     -- 'send_message', 'mark_delivered', 'mark_read'
  entity_type TEXT NOT NULL,        -- 'message', 'conversation', 'user'
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,            -- JSON payload
  retry_count INTEGER DEFAULT 0,
  last_retry_at INTEGER,
  created_at INTEGER NOT NULL,
  
  INDEX idx_operation_type (operation_type),
  INDEX idx_retry (retry_count, last_retry_at)
);
```

---

## 3. DATA FLOW

### 3.1 Sending a Message (Online)

```
1. User types → Press Send
   ↓
2. Generate local_id (UUID)
   ↓
3. Insert to SQLite (sync_status: 'pending')
   ↓
4. Update Zustand (optimistic UI)
   ↓
5. Add to sync_queue (operation: 'send_message')
   ↓
6. Sync engine picks up queue item
   ↓
7. POST to Firestore addDoc()
   ↓
8. On Success:
   - Update SQLite (sync_status: 'synced', id: firestore_id)
   - Remove from sync_queue
   ↓
9. On Failure:
   - Update retry_count
   - Schedule exponential backoff retry
```

### 3.2 Sending a Message (Offline)

```
1. User types → Press Send
   ↓
2. Network monitor detects offline
   ↓
3. Insert to SQLite (sync_status: 'pending')
   ↓
4. Update Zustand with status: 'queued'
   ↓
5. Add to sync_queue
   ↓
6. Show "Message queued" UI indicator
   ↓
[User goes online]
   ↓
7. Network monitor detects connection
   ↓
8. Sync engine starts processing queue
   ↓
9. Batch send all pending messages
   ↓
10. Update statuses as messages sync
```

### 3.3 Receiving Messages (Real-time)

```
1. Firestore onSnapshot fires
   ↓
2. New message detected
   ↓
3. Check if message exists in SQLite (by local_id or id)
   ↓
4. If exists:
   - Update sync_status to 'synced'
   - Reconcile delivery/read receipts
   ↓
5. If new:
   - Insert to SQLite (sync_status: 'synced')
   - Add to Zustand messages array
   ↓
6. Mark as delivered (update SQLite + queue sync)
```

### 3.4 App Restart

```
1. App launches
   ↓
2. Load conversations from SQLite
   ↓
3. Display cached data immediately (<200ms)
   ↓
4. Establish Firestore listeners
   ↓
5. Sync engine checks sync_queue
   ↓
6. Process any pending operations
   ↓
7. Firestore snapshot updates arrive
   ↓
8. Reconcile SQLite with Firestore
```

---

## 4. IMPLEMENTATION DETAILS

### 4.1 Database Layer (`/utils/database.js`)

```javascript
import * as SQLite from 'expo-sqlite';

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    this.db = await SQLite.openDatabaseAsync('messageai.db');
    await this.createTables();
  }

  async createTables() {
    // Execute CREATE TABLE statements
    await this.db.execAsync(/* SQL from section 2 */);
  }

  // Message operations
  async insertMessage(message) { /* ... */ }
  async updateMessageSyncStatus(localId, status, firestoreId = null) { /* ... */ }
  async getMessagesByConversation(conversationId, limit = 50, offset = 0) { /* ... */ }
  async getPendingMessages() { /* ... */ }
  
  // Conversation operations
  async upsertConversation(conversation) { /* ... */ }
  async getConversations(userId) { /* ... */ }
  
  // Sync queue operations
  async addToSyncQueue(operation) { /* ... */ }
  async getQueuedOperations() { /* ... */ }
  async removeFromQueue(id) { /* ... */ }
  
  // User cache operations
  async upsertUser(user) { /* ... */ }
  async getUser(uid) { /* ... */ }
}

export const db = new Database();
```

### 4.2 Sync Engine (`/utils/syncEngine.js`)

```javascript
import { db } from './database';
import { collection, addDoc, updateDoc } from 'firebase/firestore';
import { useNetworkStore } from './networkMonitor';

class SyncEngine {
  constructor() {
    this.isProcessing = false;
    this.retryTimeouts = new Map(); // localId -> timeout
  }

  async start() {
    // Process queue on app start
    await this.processQueue();
    
    // Listen for network changes
    useNetworkStore.subscribe((state) => {
      if (state.isOnline && !this.isProcessing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (!useNetworkStore.getState().isOnline) return;
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      const operations = await db.getQueuedOperations();
      
      for (const op of operations) {
        await this.processOperation(op);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async processOperation(op) {
    try {
      switch (op.operation_type) {
        case 'send_message':
          await this.syncMessage(op);
          break;
        case 'mark_delivered':
          await this.syncDeliveryReceipt(op);
          break;
        case 'mark_read':
          await this.syncReadReceipt(op);
          break;
      }
      
      // Success - remove from queue
      await db.removeFromQueue(op.id);
      
    } catch (error) {
      // Failure - update retry count
      await db.updateQueueRetry(op.id);
      
      // Schedule retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, op.retry_count), 30000);
      this.scheduleRetry(op, delay);
    }
  }

  async syncMessage(op) {
    const payload = JSON.parse(op.payload);
    const { conversationId, message } = payload;
    
    // Send to Firestore
    const docRef = await addDoc(
      collection(db, `conversations/${conversationId}/messages`),
      {
        text: message.text,
        senderId: message.sender_id,
        timestamp: serverTimestamp(),
        localId: message.local_id,
        clientSentAt: message.client_sent_at,
        // ... other fields
      }
    );
    
    // Update SQLite with Firestore ID
    await db.updateMessageSyncStatus(
      message.local_id,
      'synced',
      docRef.id
    );
  }

  scheduleRetry(op, delay) {
    const timeout = setTimeout(() => {
      this.processOperation(op);
    }, delay);
    
    this.retryTimeouts.set(op.id, timeout);
  }

  stop() {
    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }
}

export const syncEngine = new SyncEngine();
```

### 4.3 Updated ChatStore (`/store/chatStore.js`)

```javascript
import { db } from '../utils/database';
import { syncEngine } from '../utils/syncEngine';

export const useChatStore = create((set, get) => ({
  // ... existing state ...
  
  sendMessage: async (conversationId, senderId, text) => {
    const localId = uuid.v4();
    const sentAt = Date.now();
    
    const message = {
      local_id: localId,
      conversation_id: conversationId,
      sender_id: senderId,
      text,
      timestamp: sentAt,
      client_sent_at: sentAt,
      sync_status: 'pending',
      delivered_to: JSON.stringify([senderId]),
      read_by: JSON.stringify([senderId]),
      created_at: sentAt,
      updated_at: sentAt,
    };
    
    // 1. Insert to SQLite
    await db.insertMessage(message);
    
    // 2. Update Zustand (optimistic UI)
    set((state) => ({
      messages: [...state.messages, {
        ...message,
        status: 'sending',
      }]
    }));
    
    // 3. Add to sync queue
    await db.addToSyncQueue({
      operation_type: 'send_message',
      entity_type: 'message',
      entity_id: localId,
      payload: JSON.stringify({ conversationId, message }),
      created_at: Date.now(),
    });
    
    // 4. Trigger sync
    syncEngine.processQueue();
    
    return { success: true, localId };
  },
  
  subscribeToMessages: (conversationId, userId) => {
    // Load from SQLite first (instant display)
    db.getMessagesByConversation(conversationId).then(messages => {
      set({ messages });
    });
    
    // Then subscribe to Firestore (for real-time updates)
    const q = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('timestamp', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Process Firestore changes
      for (const change of snapshot.docChanges()) {
        const firestoreMessage = {
          id: change.doc.id,
          ...change.doc.data()
        };
        
        if (change.type === 'added' || change.type === 'modified') {
          // Upsert to SQLite
          await db.upsertMessage(firestoreMessage);
        }
      }
      
      // Reload from SQLite (single source of truth)
      const messages = await db.getMessagesByConversation(conversationId);
      set({ messages });
    });
    
    return unsubscribe;
  },
}));
```

---

## 5. EDGE CASES & ERROR HANDLING

### 5.1 Network Transitions
- **Online → Offline during send**: Message queues, shows "queued" status
- **Offline → Online**: Sync engine processes queue with exponential backoff
- **Intermittent connection**: Retry logic with max 5 attempts

### 5.2 Concurrent Modifications
- **Same message updated from multiple sources**: Use timestamp to determine winner
- **Firestore latency**: SQLite shows optimistic state, reconciles when Firestore confirms

### 5.3 App State Transitions
- **App backgrounded**: Pause sync engine, save current state
- **App foregrounded**: Resume sync engine, process queue
- **App killed**: Messages in SQLite persist, sync on next launch

### 5.4 Storage Limits
- **SQLite full**: Delete old messages (keep last 90 days)
- **Conversation pagination**: Load last 50 messages, fetch more on scroll

### 5.5 Sync Failures
- **Max retries exceeded**: Mark message as permanently failed, show retry button
- **Firestore quota exceeded**: Show user error, pause syncing
- **Corrupted SQLite**: Fallback to Firestore only, show warning

---

## 6. MIGRATION PLAN

### Phase A: Add SQLite Layer (No Breaking Changes)
1. Install `expo-sqlite`
2. Create database schema
3. Initialize on app launch
4. Start caching Firestore data to SQLite
5. Continue using existing Firestore listeners

### Phase B: Dual Write (Verify Data Integrity)
1. Write to both SQLite and Firestore
2. Compare results to ensure consistency
3. Log discrepancies for debugging
4. Run for 2-3 days to validate

### Phase C: SQLite as Primary (Cutover)
1. Update `sendMessage` to write to SQLite first
2. Implement sync queue
3. Start sync engine
4. Monitor for issues

### Phase D: Optimize (Post-Launch)
1. Add database indexes
2. Implement message pagination
3. Add background sync for better offline UX
4. Optimize query performance

---

## 7. TESTING STRATEGY

### Unit Tests
- [ ] Database CRUD operations
- [ ] Sync queue operations
- [ ] Message reconciliation logic
- [ ] Retry exponential backoff

### Integration Tests
- [ ] Send message → verify in SQLite and Firestore
- [ ] Go offline → queue message → go online → verify sync
- [ ] App restart → verify message persistence
- [ ] Receive message → verify SQLite update

### E2E Scenarios (Manual)
1. **Offline Queuing**: Send 5 messages offline → go online → all sync
2. **Force Quit**: Send message → kill app mid-sync → reopen → message sends
3. **Network Drop**: 30s offline → messages queue → reconnect → sync <1s
4. **Concurrent Users**: User A and B send simultaneously → both receive in order
5. **Large Message Load**: Scroll through 1000+ messages → smooth performance

### Performance Tests
- [ ] App launch with 1000 conversations: <500ms
- [ ] Load 50 messages: <100ms
- [ ] Sync 10 pending messages: <2s
- [ ] Database query with 10,000 messages: <200ms

---

## 8. SUCCESS METRICS

### Rubric Requirements (12/12 points)
✅ Messages queue locally when offline  
✅ Send when reconnected  
✅ Messages sent offline appear for others once online  
✅ Auto-reconnect with complete sync  
✅ Clear UI indicators for connection status  
✅ Sub-1 second sync after reconnection  
✅ Force quit → reopen → full history preserved  
✅ Network drop 30s+ → auto-reconnects  

### Performance Targets
- Message send latency: <200ms (online)
- Sync latency: <1s (after reconnect)
- App launch: <2s to chat list
- Database queries: <100ms

### Reliability Targets
- Zero message loss (100% delivery guarantee)
- 99.9% sync success rate
- Max 3 retry attempts before manual intervention

---

## 9. ROLLOUT PLAN

### Week 1: Foundation
- Day 1-2: Implement database layer + schema
- Day 3: Implement sync engine core
- Day 4: Update chatStore with SQLite writes
- Day 5: Testing & bug fixes

### Week 2: Polish & Deploy
- Day 1-2: Handle edge cases
- Day 3: Performance optimization
- Day 4: Final testing (all scenarios)
- Day 5: Deploy to production

---

## 10. DEPENDENCIES

### Required Packages
```json
{
  "expo-sqlite": "^16.0.8",  // Already in package.json
  "uuid": "^10.0.0"          // For client-generated IDs
}
```

### Firestore Indexes (add to firestore.indexes.json)
```json
{
  "indexes": [
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "timestamp", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## IMPLEMENTATION CHECKLIST

- [ ] Create database schema in `/utils/database.js`
- [ ] Implement sync engine in `/utils/syncEngine.js`
- [ ] Update chatStore to use SQLite first
- [ ] Add message status indicators (queued, syncing, synced, failed)
- [ ] Implement exponential backoff retry
- [ ] Handle app lifecycle (background/foreground)
- [ ] Test all offline scenarios
- [ ] Optimize database queries
- [ ] Add migration logic
- [ ] Update documentation

**Estimated Effort**: 2.5 days  
**Points Impact**: +12 (Offline Support & Persistence Excellent)


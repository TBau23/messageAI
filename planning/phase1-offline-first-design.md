# Phase 1: Offline-First Architecture (SIMPLIFIED)
## Technical Design Document

**Goal**: Achieve 12/12 points on "Offline Support & Persistence"  
**Scope**: Pragmatic implementation for Expo Go evaluation  
**Effort**: 1 day (down from 2.5 days)

---

## 1. ARCHITECTURE OVERVIEW

### Current State (What Already Works)
- ✅ Messages stored in Firestore
- ✅ Optimistic updates in Zustand (memory only)
- ✅ Network monitoring via NetInfo
- ✅ **Firestore SDK handles offline queueing** (messages send when reconnected)
- ❌ No local cache (can't load history offline)
- ❌ Messages lost on force quit while offline

### Target State (Simplified)
```
User Action
    ↓
Zustand Store (UI State)
    ↓
SQLite Cache (Fast Local Reads) + Firestore SDK Queue (Handles Offline Writes)
    ↓
Firestore (Cloud Truth)
```

**Key Principle**: SQLite is a **read cache** for instant loading. Firestore SDK handles write queueing (already works!).

### What Changed from Original Design
- ❌ No complex sync engine (Firestore SDK does this)
- ❌ No sync_queue table (Firestore SDK has internal queue)
- ❌ No retry logic (Firestore SDK handles it)
- ✅ Simple write-through cache pattern
- ✅ Focus on instant loading + offline history
- ✅ Trust Firestore SDK for offline write queueing

---

## 2. DATABASE SCHEMA (SIMPLIFIED)

### SQLite Tables - Cache Only

```sql
-- Messages table (simple cache)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,              -- Firestore ID
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp INTEGER NOT NULL,       -- Unix milliseconds
  
  -- Delivery tracking (stored as JSON strings)
  delivered_to TEXT,                -- JSON array of user IDs
  read_by TEXT,                     -- JSON array of user IDs
  delivered_receipts TEXT,          -- JSON object {userId: timestamp}
  read_receipts TEXT,               -- JSON object {userId: timestamp}
  
  -- Cache metadata
  cached_at INTEGER NOT NULL
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, timestamp DESC);

-- Conversations table (cached from Firestore)
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,               -- 'direct' | 'group'
  name TEXT,                        -- Group name (for groups)
  participants TEXT NOT NULL,       -- JSON array of user IDs
  last_message TEXT,                -- JSON object
  updated_at INTEGER NOT NULL,
  cached_at INTEGER NOT NULL
);

CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

-- Users table (cached participant data)
CREATE TABLE users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  online INTEGER DEFAULT 0,         -- 0 or 1 (SQLite boolean)
  last_seen INTEGER,
  cached_at INTEGER NOT NULL
);
```

**Note**: No sync_queue table needed - Firestore SDK handles offline queueing internally!

---

## 3. DATA FLOW (SIMPLIFIED)

### 3.1 Sending a Message (Write-Through Cache)

```
1. User types → Press Send
   ↓
2. Update Zustand (optimistic UI - existing code)
   ↓
3. Call Firestore addDoc() - Firestore SDK handles queueing!
   ↓
4. When onSnapshot receives confirmation:
   - Write to SQLite cache
   - Update Zustand with final state
```

**Key insight**: Let Firestore SDK handle offline queueing (it already works perfectly!)

### 3.2 Receiving Messages (Cache-First Read)

```
1. User opens chat
   ↓
2. Load from SQLite cache immediately (<100ms)
   - Display cached messages
   - Show "Loading..." if empty cache
   ↓
3. Subscribe to Firestore onSnapshot
   ↓
4. As messages arrive:
   - Update SQLite cache (upsert)
   - Update Zustand
   - UI updates reactively
```

### 3.3 App Restart / Offline Access

```
1. App launches
   ↓
2. Load conversations from SQLite
   - Instant display (<200ms)
   ↓
3. User taps conversation
   ↓
4. Load messages from SQLite
   - Full history available offline
   ↓
5. When online, Firestore syncs in background
   - Updates cache as new messages arrive
```

**Result**: Chat history works offline, loads instantly

---

## 4. IMPLEMENTATION DETAILS (SIMPLIFIED)

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
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        delivered_to TEXT,
        read_by TEXT,
        delivered_receipts TEXT,
        read_receipts TEXT,
        cached_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_messages_conversation 
      ON messages(conversation_id, timestamp DESC);
      
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT,
        participants TEXT NOT NULL,
        last_message TEXT,
        updated_at INTEGER NOT NULL,
        cached_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_conversations_updated 
      ON conversations(updated_at DESC);
      
      CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT,
        online INTEGER DEFAULT 0,
        last_seen INTEGER,
        cached_at INTEGER NOT NULL
      );
    `);
  }

  // Message operations
  async upsertMessage(message) {
    // Insert or replace - simple cache update
    await this.db.runAsync(
      `INSERT OR REPLACE INTO messages 
       (id, conversation_id, sender_id, text, timestamp, delivered_to, 
        read_by, delivered_receipts, read_receipts, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.conversationId || message.conversation_id,
        message.senderId || message.sender_id,
        message.text,
        typeof message.timestamp === 'number' ? message.timestamp : message.timestamp?.toMillis?.() || Date.now(),
        JSON.stringify(message.deliveredTo || message.delivered_to || []),
        JSON.stringify(message.readBy || message.read_by || []),
        JSON.stringify(message.deliveredReceipts || message.delivered_receipts || {}),
        JSON.stringify(message.readReceipts || message.read_receipts || {}),
        Date.now()
      ]
    );
  }

  async getMessagesByConversation(conversationId) {
    const rows = await this.db.getAllAsync(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
      [conversationId]
    );
    
    return rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      text: row.text,
      timestamp: new Date(row.timestamp),
      deliveredTo: JSON.parse(row.delivered_to || '[]'),
      readBy: JSON.parse(row.read_by || '[]'),
      deliveredReceipts: JSON.parse(row.delivered_receipts || '{}'),
      readReceipts: JSON.parse(row.read_receipts || '{}'),
    }));
  }
  
  // Conversation operations
  async upsertConversation(conversation) {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO conversations 
       (id, type, name, participants, last_message, updated_at, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        conversation.id,
        conversation.type,
        conversation.name || null,
        JSON.stringify(conversation.participants || []),
        JSON.stringify(conversation.lastMessage || conversation.last_message || null),
        typeof conversation.updatedAt === 'number' ? conversation.updatedAt : conversation.updatedAt?.toMillis?.() || Date.now(),
        Date.now()
      ]
    );
  }

  async getConversations() {
    const rows = await this.db.getAllAsync(
      'SELECT * FROM conversations ORDER BY updated_at DESC'
    );
    
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      name: row.name,
      participants: JSON.parse(row.participants),
      lastMessage: JSON.parse(row.last_message || 'null'),
      updatedAt: new Date(row.updated_at),
    }));
  }
  
  // User cache operations
  async upsertUser(user) {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO users 
       (uid, email, display_name, online, last_seen, cached_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        user.uid,
        user.email || null,
        user.displayName || user.display_name || null,
        user.online ? 1 : 0,
        typeof user.lastSeen === 'number' ? user.lastSeen : user.lastSeen?.toMillis?.() || null,
        Date.now()
      ]
    );
  }

  async getUser(uid) {
    const row = await this.db.getFirstAsync(
      'SELECT * FROM users WHERE uid = ?',
      [uid]
    );
    
    if (!row) return null;
    
    return {
      uid: row.uid,
      email: row.email,
      displayName: row.display_name,
      online: row.online === 1,
      lastSeen: row.last_seen ? new Date(row.last_seen) : null,
    };
  }
}

export const database = new Database();
```

**Note**: No sync engine needed! Firestore SDK handles all offline queueing.

### 4.2 Updated ChatStore (`/store/chatStore.js`)

```javascript
import { database } from '../utils/database';

export const useChatStore = create((set, get) => ({
  // ... existing state ...
  
  // sendMessage: KEEP EXISTING CODE
  // Firestore SDK already handles offline queueing perfectly!
  // Just let onSnapshot cache to SQLite when confirmed
  
  subscribeToMessages: (conversationId, userId) => {
    set({ currentConversation: conversationId });
    
    // 1. Load from cache first (instant display)
    database.getMessagesByConversation(conversationId).then(cachedMessages => {
      if (cachedMessages.length > 0) {
        console.log(`Loaded ${cachedMessages.length} messages from cache`);
        set({ messages: cachedMessages });
      }
    });
    
    // 2. Subscribe to Firestore (for real-time updates)
    const q = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('timestamp', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Update cache as messages arrive
      for (const doc of snapshot.docs) {
        await database.upsertMessage({
          id: doc.id,
          ...doc.data()
        });
      }
      
      // Reload from cache (single source of truth)
      const messages = await database.getMessagesByConversation(conversationId);
      set({ messages });
      
      // Mark as delivered (existing logic)
      // ...
    });
    
    return unsubscribe;
  },
  
  subscribeToConversations: (userId) => {
    // Load from cache first
    database.getConversations().then(cached => {
      if (cached.length > 0) {
        console.log(`Loaded ${cached.length} conversations from cache`);
        // Process cached conversations...
        set({ conversations: cached });
      }
    });
    
    // Subscribe to Firestore (existing code)
    const q = query(/*...*/);
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Cache each conversation
      const convos = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const convo = { id: docSnap.id, ...data };
          
          // Update cache
          await database.upsertConversation(convo);
          
          return convo;
        })
      );
      
      set({ conversations: convos });
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


# Architecture Research Document
## WhatsApp-Style Messaging Application

**Date**: October 24, 2025
**Stack**: React Native (Expo Go) + Firestore + Firebase Auth

---

## 1. TECHNOLOGY STACK

### Frontend
- **Framework**: React Native 0.81.4 with Expo SDK 54
- **Routing**: expo-router 6.x (file-based routing)
- **State Management**: Zustand 5.x (lightweight store)
- **UI Components**: React Native core components
- **Date Formatting**: date-fns 4.x
- **Network Detection**: @react-native-community/netinfo

### Backend
- **Database**: Cloud Firestore (NoSQL document database)
- **Authentication**: Firebase Auth (email/password)
- **Real-time Sync**: Firestore onSnapshot listeners
- **Persistence**: AsyncStorage for auth state

### Configuration
- **Environment Variables**: Expo public env vars (EXPO_PUBLIC_*)
- **Firebase**: Long polling enabled for Firestore (compatibility mode)
- **Auth Persistence**: React Native AsyncStorage integration

---

## 2. FIRESTORE DATA SCHEMA

### Collections Structure

#### `users/` Collection
```
users/{userId}
  - uid: string
  - email: string
  - displayName: string
  - online: boolean
  - lastSeen: timestamp
  - createdAt: timestamp
```

#### `conversations/` Collection
```
conversations/{conversationId}
  - participants: array<userId>
  - type: "direct" | "group"
  - name: string (group chats only)
  - createdAt: timestamp
  - updatedAt: timestamp
  - lastMessage: {
      text: string
      senderId: string
      timestamp: timestamp
    }

  messages/ (subcollection)
    {messageId}
      - text: string
      - senderId: string
      - timestamp: timestamp
      - localId: string (client-generated)
      - clientSentAt: number (epoch ms)
      - status: "sending" | "sent" | "failed"
      - deliveredTo: array<userId>
      - readBy: array<userId>
      - deliveredReceipts: map<userId, timestamp>
      - readReceipts: map<userId, timestamp>

  typingStatus/ (subcollection)
    {userId}
      - typing: boolean
      - updatedAt: timestamp
```

---

## 3. STATE MANAGEMENT ARCHITECTURE

### Zustand Stores (3 global stores)

#### **authStore.js**
**Purpose**: Authentication state and user session management

**State**:
- `user`: Current authenticated user object
- `loading`: Auth initialization status
- `error`: Authentication error messages

**Methods**:
- `initializeAuth()`: Sets up onAuthStateChanged listener, syncs Firestore user doc
- `signIn(email, password)`: Email/password authentication, updates online status
- `signUp(email, password)`: Creates user account + Firestore document
- `updateProfile(displayName)`: Updates user's display name
- `setUserOnlineStatus(isOnline)`: Updates online/offline status
- `signOut()`: Signs out and sets user offline

**Key Behaviors**:
- Auto-syncs user data from Firestore on auth state change
- Updates `online` and `lastSeen` fields on login/logout
- Persists auth state via AsyncStorage

#### **chatStore.js**
**Purpose**: Manages conversations, messages, and optimistic updates

**State**:
- `conversations`: Array of conversation objects
- `currentConversation`: Active conversation ID
- `messages`: Messages for current conversation
- `pendingMessages`: Optimistic messages by conversation ID
- `messageMetrics`: Latency tracking for sent messages
- `previousConversations`: For notification comparison
- `isInitialLoad`: Prevents notifications on first load

**Methods**:
- `subscribeToConversations(userId)`: Real-time listener for user's conversations
- `subscribeToMessages(conversationId, userId)`: Real-time listener for messages
- `getOrCreateConversation(currentUserId, otherUserId)`: Finds or creates direct chat
- `createGroupConversation(participantIds, groupName)`: Creates group chat
- `sendMessage(conversationId, senderId, text)`: Sends message with optimistic update
- `retryMessage(conversationId, senderId, message)`: Retries failed message
- `markMessagesAsRead(conversationId, messageIds, userId)`: Updates read receipts
- `clearMessages()`: Cleans up when leaving chat
- `searchUsers(searchTerm, currentUserId)`: Searches users by display name

**Key Behaviors**:
- **Optimistic UI**: Immediately shows messages before Firestore confirmation
- **Message Ordering**: Uses `orderTimestamp` to sort pending + persisted messages
- **Latency Tracking**: Measures client-sent to Firestore-delivered time
- **Auto-delivery**: Marks messages as delivered when user opens chat
- **Notification Triggering**: Compares previous conversation state to detect new messages

#### **notificationStore.js**
**Purpose**: In-app notification banner management

**State**:
- `notification`: Current notification message object
- `currentChatId`: ID of currently open chat (to suppress notifications)

**Methods**:
- `showNotification(message)`: Displays notification banner
- `clearNotification()`: Dismisses notification
- `setCurrentChatId(chatId)`: Tracks active chat

**Key Behaviors**:
- Suppresses notifications from currently active chat
- Stores notification metadata (conversationId, senderName, text, timestamp)

#### **networkStore (in networkMonitor.js)**
**Purpose**: Network connectivity state

**State**:
- `isOnline`: Boolean for network status
- `isConnecting`: Temporary state when reconnecting

**Key Behaviors**:
- Monitors connection via NetInfo library
- Shows "Connecting..." banner briefly after reconnection

---

## 4. NAVIGATION STRUCTURE

### File-Based Routing (Expo Router)

```
app/
├── index.js                    → Splash/Auth redirect
├── _layout.js                  → Root layout (AppState, network monitoring)
│
├── (auth)/
│   ├── _layout.js              → Auth flow container
│   ├── login.js                → Login screen
│   ├── signup.js               → Signup screen
│   └── profile-setup.js        → Post-signup profile config
│
└── (main)/
    ├── _layout.js              → Main app container (Stack + notification banner)
    ├── index.js                → Chat list screen
    ├── new-chat.js             → User search & chat creation
    └── chat/
        └── [id].js             → Individual chat screen (dynamic route)
```

**Route Groups**: `(auth)` and `(main)` are separate navigation stacks
**Auth Flow**: `app/index.js` redirects to `(auth)/login` or `(main)` based on user state

---

## 5. AUTHENTICATION FLOW

### Initial Load
1. `app/index.js` calls `initializeAuth()`
2. `authStore` sets up `onAuthStateChanged` listener
3. If user exists: Fetch Firestore user doc, update online status → Navigate to `(main)`
4. If no user: Navigate to `(auth)/login`

### Sign Up Flow
1. User enters email/password → `signUp()` called
2. Firebase Auth creates account
3. `authStore` creates Firestore document in `users/` collection
4. Sets `online: true`, `lastSeen: serverTimestamp()`
5. Returns `uid` → Navigate to `profile-setup.js`
6. User enters display name → `updateProfile()` updates Firestore doc
7. Navigate to `(main)`

### Sign In Flow
1. User enters credentials → `signIn()` called
2. Firebase Auth authenticates
3. Update Firestore: `online: true`, `lastSeen: serverTimestamp()`
4. Navigate to `(main)`

### Sign Out Flow
1. `signOut()` called from menu
2. Update Firestore: `online: false`, `lastSeen: serverTimestamp()`
3. Firebase Auth sign out
4. Clear local state → Navigate to `(auth)/login`

### App State Management
- `app/_layout.js` listens to AppState changes (background/foreground)
- When backgrounded: `setUserOnlineStatus(false)`
- When foregrounded: `setUserOnlineStatus(true)`

---

## 6. MESSAGING DATA FLOW

### Conversation Creation

#### Direct Chat
1. User searches by display name (`searchUsers()`)
2. Select user → `getOrCreateConversation(currentUserId, otherUserId)`
3. Query existing conversations with `participants.array-contains` + type check
4. If exists: Return conversation ID
5. If not: Create new document with `participants: [user1, user2]`, `type: "direct"`
6. Navigate to `/chat/{conversationId}`

#### Group Chat
1. Search and select multiple users (2+)
2. Enter group name in modal
3. `createGroupConversation([...userIds], groupName)`
4. Create conversation with `type: "group"`, `name: groupName`
5. Navigate to `/chat/{conversationId}`

### Real-Time Conversation Sync
- `subscribeToConversations(userId)` called on mount of chat list
- Firestore query: `where('participants', 'array-contains', userId)` + `orderBy('updatedAt', 'desc')`
- `onSnapshot` listener updates `conversations` array
- For each conversation:
  - If `type: "group"`: Fetch all participant details from `users/` collection
  - If `type: "direct"`: Fetch other participant's user document
- Triggers notification if `lastMessage` changed (skips initial load)

### Message Sending Flow (Optimistic Updates)
1. User types message, presses Send
2. Generate `localId` (temporary ID: `temp_{timestamp}_{random}`)
3. **Optimistic Update**: Immediately add message to `messages` and `pendingMessages`
   - Status: `"sending"`
   - `clientSentAt`: `Date.now()`
   - `orderTimestamp`: Used for sorting
4. Send to Firestore: `addDoc(conversations/{id}/messages)`
   - Fields: `text`, `senderId`, `timestamp: serverTimestamp()`
   - `deliveredTo: [senderId]`, `readBy: [senderId]`
   - `status: "sent"`, `localId` (for reconciliation)
5. **On Success**: Firestore listener receives message, matches by `localId`
   - Removes from `pendingMessages`
   - Calculates `deliveryLatencyMs`
6. **On Failure**: Update optimistic message `status: "failed"`
   - Show "Retry" button
   - User can call `retryMessage()` to resend

### Real-Time Message Sync
- `subscribeToMessages(conversationId, userId)` called on chat screen mount
- Firestore query: `conversations/{id}/messages` + `orderBy('timestamp', 'asc')`
- `onSnapshot` listener:
  - Fetches messages
  - Auto-marks as delivered: `arrayUnion(userId)` to `deliveredTo`
  - Merges with pending messages
  - Sorts by `orderTimestamp` for consistent ordering
- **Read Receipts**: Separate effect marks messages as read when chat is viewed
  - Filters unread messages not from current user
  - Calls `markMessagesAsRead()` → Updates `readBy` and `readReceipts`

### Typing Indicators
- User types in input → `handleTextChange()`
- Throttled update (every 2 seconds): Write to `conversations/{id}/typingStatus/{userId}`
  - `typing: true`, `updatedAt: serverTimestamp()`
- Stop typing after 2s inactivity: `typing: false`
- Other users subscribe to `typingStatus/` subcollection via `onSnapshot`
- Filter entries where `updatedAt` is within 5 seconds (stale detection)
- Display "Typing..." indicator

### Message Status Indicators

#### Direct Chats
- **Pending**: Gray "Pending…" (optimistic message sending)
- **Sent**: Light gray badge (message reached Firestore)
- **Delivered**: Blue badge (other user's app received it)
- **Read**: Green badge + timestamp (other user viewed message)

#### Group Chats
- **Read Count**: "Read 2/5" badge
- **Tap for Details**: Opens modal showing per-user read status with timestamps

---

## 7. COMPONENT ARCHITECTURE

### Reusable Components

#### **MessageNotification.js**
- Displays in-app notification banner at top of screen
- Props: `message` (conversationId, senderName, text), `onPress`, `onDismiss`
- Auto-dismisses after 5 seconds
- Animated slide-in from top

#### **MessageStatusIndicator.js**
- Shows delivery/read status badges on messages
- Logic:
  - Direct chat: Single user read/delivered state
  - Group chat: Aggregate read count (e.g., "Read 3/8")
- Group chats: Tappable to open detail modal

#### **NetworkBanner.js**
- Global network status indicator
- States:
  - Offline: Red banner "📵 No connection"
  - Connecting: Orange banner "⏳ Connecting..."
  - Online: Hidden
- Always visible across all screens in `(main)` layout

---

## 8. CORE INTERACTIONS

### Conversation List
- **Pull-to-refresh**: Not implemented (real-time sync handles updates)
- **Search**: Navigate to "New Chat" for user search
- **Tap Conversation**: Navigate to `/chat/{id}`
- **Last Message Preview**: Shows text + timestamp
- **Online Indicators**: Avatar shows online status (for direct chats)

### Chat Screen
- **Header**: Shows name, online status (direct) or member count (group)
- **Typing Indicators**: Real-time display when others are typing
- **Message Bubbles**: 
  - Own messages: Right-aligned, green background
  - Others: Left-aligned, white background
  - Failed: Red border, shows "Retry" button
- **Group Chat**: Displays sender name above message bubble
- **Keyboard Handling**: `KeyboardAvoidingView` pushes input up
- **Auto-scroll**: Scrolls to bottom on new messages
- **Read Receipts**: Auto-marked when chat is open

### New Chat Screen
- **Search**: Real-time user search by display name
- **Multi-select**: Checkbox-based selection for group chats
- **Direct Chat**: Select 1 user → Immediate navigation
- **Group Chat**: Select 2+ users → Prompt for group name → Create

### Profile & Settings
- **Not fully implemented** (no dedicated settings screen)
- Sign out available from menu in chat list
- Profile setup during signup flow

---

## 9. DATA SYNCHRONIZATION PATTERNS

### Real-Time Listeners
- **All active subscriptions**: Cleaned up on component unmount
- **Conversations**: Global subscription for entire user session
- **Messages**: Per-chat subscription, cleared on navigation away
- **Typing Status**: Per-chat subscription
- **Participant Data**: Dynamic subscriptions for users in active conversation

### Optimistic Updates
- Messages immediately appear in UI before Firestore confirmation
- `localId` used to reconcile optimistic message with server message
- Failed messages remain in UI with retry option
- Pending state shown with visual indicator

### Latency Tracking
- Stores `clientSentAt` timestamp when sending
- Calculates `deliveryLatencyMs` when message appears in Firestore snapshot
- Used for debugging and potential performance monitoring

---

## 10. SECURITY & RULES

### Current Firestore Rules
```
⚠️ WARNING: Development rules in place (expires Nov 19, 2025)
- Allow all reads/writes without authentication checks
- NOT production-ready
```

**Recommended Production Rules**:
- Require authentication for all operations
- Users can only read/write their own user document
- Participants can only access conversations they're in
- Messages can only be created by conversation participants
- Read receipts can only be updated by the receiving user

---

## 11. KEY TECHNICAL DECISIONS


### Why Subcollections for Messages?
- Firestore best practice for scalability
- Conversations can have unlimited messages
- Messages queried independently per conversation
- Better indexing and query performance

### Why Long Polling?
- `experimentalForceLongPolling: true` in Firestore config
- Compatibility with Expo Go environment
- WebSocket issues in some network configurations

---

## 12. CURRENT LIMITATIONS & GAPS

1. **No Image/Media Support**: Text-only messages
2. **No Push Notifications**: Only in-app foreground notifications
4. **No User Profile Pictures**: Avatar initials only
5. **Security Rules**: Open database (dev only)
6. **No Message Search**: Can't search within conversations
7. **No Conversation Deletion**: Conversations persist forever
8. **No User Blocking**: No spam protection
9. **No Emoji Reactions**: Basic message bubbles only
10. **No Voice/Video Calling**: Text chat only

---

## 13. PERFORMANCE CONSIDERATIONS

### Firestore Reads
- Each conversation load: 1 doc read
- Participant data: N reads (N = number of participants)
- Message subscription: Initial read of all messages
- Real-time: Charged per document change

### Optimization Opportunities
- Pagination for old messages (currently loads all)
- Participant data caching (currently refetches on every mount)
- Lazy load conversation metadata
- Implement message virtualization for long chats

---

## 14. TESTING & DEBUGGING

- No testing required

### Available Debug Data
- Message latency metrics in `messageMetrics` store
- Network state exposed via `useNetworkStore`
- `__DEV__` checks for development logging

---

## SUMMARY



**Architecture Strengths**:
- Clean separation of concerns (stores, components, screens)
- Real-time sync with Firestore
- Good UX with optimistic updates
- Scalable data model (subcollections)


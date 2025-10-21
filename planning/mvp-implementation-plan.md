# MVP Implementation Plan
**WhatsApp-Style Messaging App - React Native + Expo + Firebase**

## Project Overview

Build a production-quality messaging app with real-time sync, offline support, and group chat capabilities. Focus on reliable message delivery and solid infrastructure over feature quantity.

## Explicit MVP Requirements

The following features are REQUIRED for MVP completion:

1. ✅ **One-on-one chat functionality**
2. ✅ **Real-time message delivery between 2+ users**
3. ✅ **Message persistence** (survives app restarts)
4. ✅ **Optimistic UI updates** (messages appear instantly before server confirmation)
5. ✅ **Online/offline status indicators**
6. ✅ **Message timestamps**
7. ✅ **User authentication** (users have accounts/profiles)
8. ✅ **Basic group chat functionality** (3+ users in one conversation)
9. ✅ **Message read receipts** (both 1-on-1 AND group chats)
10. ✅ **Push notifications** (at least foreground)
11. ✅ **Deployment** (running on local emulator/simulator)
12. ✅ **Setup documentation** (clean instructions for others to run locally)

### Key Clarifications

- **Read Receipts**: Work in BOTH 1-on-1 and group chats. Backend logic is identical (track array of userIds). UI shows overall status + detailed view on tap.
- **Media Support**: NOT required for MVP. No image/video upload needed.
- **Physical Devices**: NOT required. Testing will use multiple iOS simulators running simultaneously.
- **Production Deployment**: NOT required. TestFlight/APK is nice-to-have but not gated.

## Tech Stack

### Core Dependencies
- **Expo SDK ~54** - React Native framework
- **Expo Router ~5.0** - File-based navigation
- **Firebase 12** - Backend services
  - Firestore - Real-time database
  - Auth - User authentication
  - Cloud Messaging (FCM) - Push notifications
- **Expo SQLite ~16.0** - Local persistence
- **Expo Notifications ~0.28** - Push notification handling
- **@react-native-community/netinfo ~11.3** - Network state detection
- **AsyncStorage ~1.24** - Simple key-value storage

### Utilities
- **date-fns** - Timestamp formatting
- **zustand** - Lightweight state management

### Current Status
✅ Expo project initialized  
✅ Firebase connected and working  
✅ Environment variables configured  
✅ AsyncStorage installed  
✅ **Phase 1 Complete**: Auth flow working (signup, login, profile setup, sign out)

**Setup Note**: Used `Slot` instead of `Stack` in layouts to avoid boolean/string type error with Expo Router v6. Required AsyncStorage@2.2.0 and correct React/RN versions for Expo SDK 54 compatibility.  

## Firebase Architecture

### Firestore Schema

```
users/
  {userId}/
    - displayName: string
    - email: string
    - photoURL: string (optional, post-MVP)
    - online: boolean
    - lastSeen: timestamp
    - createdAt: timestamp

conversations/
  {conversationId}/
    - participants: [userId1, userId2, ...]
    - type: 'direct' | 'group'
    - name: string (for groups)
    - lastMessage: {
        text: string,
        senderId: string,
        timestamp: timestamp
      }
    - updatedAt: timestamp
    - createdAt: timestamp
    
    messages/ (subcollection)
      {messageId}/
        - text: string
        - senderId: string
        - timestamp: timestamp
        - deliveredTo: [userId1, userId2, ...]
        - readBy: [userId1, userId2, ...]
        - status: 'sending' | 'sent' | 'delivered' | 'read'
        - localId: string (for optimistic updates)

presence/
  {userId}/
    - online: boolean
    - lastSeen: timestamp
    - typing: {conversationId: boolean} (optional)
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own profile and profiles of people they chat with
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    // Only conversation participants can read/write
    match /conversations/{conversationId} {
      allow read: if request.auth.uid in resource.data.participants;
      allow create: if request.auth.uid in request.resource.data.participants;
      allow update: if request.auth.uid in resource.data.participants;
      
      match /messages/{messageId} {
        allow read: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow create: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow update: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
    }
    
    // Presence tracking
    match /presence/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

### Firebase Cloud Messaging Setup

- **Foreground Notifications**: Handle with expo-notifications
- **Background Notifications**: Post-MVP (nice-to-have)
- **Notification Data**: Include conversationId for deep linking

## Feature Breakdown by Phase

### Phase 1: Foundation & Auth
**Goal**: Users can create accounts and log in

- [ ] Install all required dependencies
- [ ] Set up Expo Router file structure
- [ ] Create navigation flow (Auth stack vs Main stack)
- [ ] Build Login screen
- [ ] Build Signup screen
- [ ] Integrate Firebase Auth (email/password)
- [ ] Persistent auth state (AsyncStorage)
- [ ] Profile setup (display name)
- [ ] Create user document in Firestore on signup
- [ ] Auth error handling & validation

**Screens**: Login, Signup, ProfileSetup

### Phase 2: Core 1-on-1 Messaging
**Goal**: Two users can send messages in real-time

- [ ] Chat List screen (conversations list)
- [ ] Chat screen with message list
- [ ] Message input component
- [ ] Send text message to Firestore
- [ ] Real-time Firestore listener for incoming messages
- [ ] Display messages with timestamps
- [ ] Message bubbles (sender vs recipient styling)
- [ ] Auto-scroll to latest message
- [ ] Create conversation on first message
- [ ] Conversation list updates with latest message
- [ ] Optimistic UI (show message immediately, update on confirmation)
- [ ] Message status indicators (sending → sent)

**Screens**: ChatList, ChatScreen

### Phase 3: Message Persistence & Offline Support
**Goal**: Messages work offline and sync when reconnected

- [ ] Set up Expo SQLite database
- [ ] Create local messages table schema
- [ ] Save messages to SQLite when sent
- [ ] Load messages from SQLite on chat open
- [ ] Network state detection (@react-native-community/netinfo)
- [ ] Offline queue for pending messages
- [ ] Auto-retry sending when back online
- [ ] Sync Firestore → SQLite on message receive
- [ ] Handle app lifecycle (background/foreground)
- [ ] Handle force-quit persistence
- [ ] Conflict resolution (use Firestore as source of truth)

**Technical Notes**: 
- Save to SQLite first, then to Firestore
- On app restart, check for unsent messages and retry
- Use unique localId for optimistic updates

### Phase 4: Presence & Status
**Goal**: Show who's online and when they were last seen

- [ ] Presence system setup in Firestore
- [ ] Update online status on auth state change
- [ ] Update online status on app foreground/background
- [ ] Set offline on disconnect
- [ ] Update lastSeen timestamp
- [ ] Display online/offline indicator in chat list
- [ ] Display online/offline in chat header
- [ ] Display "last seen" when offline
- [ ] Typing indicator (optional for MVP+)

**Technical Notes**:
- Use Firestore's `onDisconnect()` callback
- Update presence on network state change

### Phase 5: Read Receipts (1-on-1 & Groups)
**Goal**: Track and display message read status

- [ ] Update message `readBy` array when user opens chat
- [ ] Mark all visible messages as read
- [ ] Real-time listener for read status updates
- [ ] Message delivery indicators:
  - Grey single check: Sent
  - Grey double check: Delivered to all
  - Blue double check: Read by all
- [ ] Message Info modal (long-press message)
- [ ] Show read/delivered timestamps per user
- [ ] Display participant list with read status
- [ ] Handle read receipts in both 1-on-1 and groups

**UI Components**: MessageInfo modal, Checkmark icons

### Phase 6: Group Chat
**Goal**: Support conversations with 3+ users

- [ ] Create Group screen (select participants)
- [ ] Create group conversation in Firestore
- [ ] Set conversation type to 'group'
- [ ] Group name input
- [ ] Add multiple participants
- [ ] Display sender name in group messages
- [ ] Group chat header (show group name)
- [ ] Member list view
- [ ] Participant avatars/names
- [ ] Message attribution (show who sent each message)
- [ ] Read receipts for all group members
- [ ] Delivery tracking for all participants

**Screens**: CreateGroup, GroupInfo, ChatScreen (enhanced)

### Phase 7: Push Notifications
**Goal**: Users receive notifications for new messages

- [ ] Set up Firebase Cloud Messaging project
- [ ] Register device for push notifications
- [ ] Request notification permissions
- [ ] Store FCM tokens in user document
- [ ] Send test notification
- [ ] Foreground notification handling
- [ ] Display notification with message preview
- [ ] Notification tap handler (deep link to chat)
- [ ] Mute notifications when chat is open
- [ ] Background notifications (if time permits)

**Technical Notes**:
- Use Expo's push notification service for simplicity
- Test on physical device or use Expo Go

### Phase 8: Polish & Refinements
**Goal**: Improve UX and handle edge cases

- [ ] Empty states (no conversations, no messages)
- [ ] Loading indicators
- [ ] Error handling & retry logic
- [ ] Pull-to-refresh in chat list
- [ ] Message timestamps (show date headers)
- [ ] Keyboard-aware scroll view
- [ ] Input auto-focus
- [ ] Character count (optional)
- [ ] Delete conversation (optional)
- [ ] Search conversations (optional, post-MVP)
- [ ] Profile picture upload (optional, post-MVP)

### Phase 9: Testing & Documentation
**Goal**: Ensure reliability and enable others to run the app

- [ ] Write comprehensive README.md
- [ ] Document Firebase setup steps
- [ ] Document environment variables
- [ ] Create .env.example file
- [ ] Multi-simulator testing guide
- [ ] Test scenarios checklist
- [ ] Firestore security rules deployment guide
- [ ] Troubleshooting section
- [ ] Architecture diagram (optional)
- [ ] Demo credentials (optional)

## Testing Strategy

### Multi-Simulator Setup

Since no physical devices are available, we'll use multiple iOS simulators:

```bash
# List available simulators
xcrun simctl list devices

# Boot 2-3 iPhone simulators
xcrun simctl boot "iPhone 15 Pro"
xcrun simctl boot "iPhone 14"
open -a Simulator

# Run Expo on each
npx expo start
# Press 'i' and select simulator
```

### Test Scenarios

Run these tests with 2-3 simulators as different users:

#### Real-Time Sync Tests
- [ ] User A sends message → appears on User B immediately
- [ ] User B replies → appears on User A immediately
- [ ] Rapid-fire messages (20+ quickly)
- [ ] Message ordering is consistent across devices

#### Persistence Tests
- [ ] Send messages → force quit app → reopen → messages still there
- [ ] User A sends 5 messages → User B opens app for first time → all 5 appear

#### Offline Tests
- [ ] User A goes offline (airplane mode) → User B sends messages → User A comes online → messages sync
- [ ] User A sends message while offline → message queued → comes online → message delivers
- [ ] App shows offline indicator when no network

#### Presence Tests
- [ ] User A appears online when app is open
- [ ] User A appears offline when app is closed
- [ ] Last seen timestamp updates correctly

#### Read Receipt Tests
- [ ] User A sends message → User B opens chat → User A sees blue checkmarks
- [ ] Group chat: User A sends → Users B & C open → all checkmarks update
- [ ] Long-press message → see who read it and when

#### Group Chat Tests
- [ ] Create group with 3+ users
- [ ] All participants receive messages
- [ ] Message attribution shows correct sender
- [ ] Read receipts track all participants

#### Push Notification Tests
- [ ] User B sends message → User A receives notification (foreground)
- [ ] Tap notification → opens correct chat

#### Edge Cases
- [ ] Handle app backgrounding/foregrounding
- [ ] Handle rapid network toggling
- [ ] Handle sending to user who is offline
- [ ] Handle empty conversations
- [ ] Handle long messages (text wrapping)

## Setup Documentation Requirements

### README.md Must Include

1. **Prerequisites**
   - Node.js version (e.g., v18+)
   - npm or yarn
   - Expo CLI installation
   - Xcode (for iOS) or Android Studio (for Android)

2. **Firebase Project Setup**
   - Create Firebase project at console.firebase.google.com
   - Enable Firestore Database
   - Enable Authentication (Email/Password)
   - Enable Cloud Messaging
   - Download configuration
   - Add to .env file

3. **Installation Steps**
   ```bash
   git clone <repo>
   cd react-messageai
   npm install
   cp .env.example .env
   # Add your Firebase credentials to .env
   npx expo start
   ```

4. **Environment Variables**
   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   EXPO_PUBLIC_FIREBASE_APP_ID=
   ```

5. **Running the App**
   - iOS: Press `i` in Expo CLI
   - Android: Press `a` in Expo CLI
   - Web: Press `w` in Expo CLI (limited functionality)

6. **Testing with Multiple Users**
   - How to launch multiple simulators
   - How to sign in as different users
   - Sample test accounts

7. **Deploying Firestore Rules**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore
   firebase deploy --only firestore:rules
   ```

8. **Troubleshooting**
   - Firebase connection issues
   - Simulator not showing up
   - Metro bundler errors
   - Common dependency issues

### .env.example File

Create a template for environment variables that users can copy.

## Implementation Priority Order

This is the recommended build sequence to minimize risk:

1. **Foundation** (Phase 1)
   - Get auth working end-to-end
   - Users can sign up, log in, persist session

2. **Core Messaging Loop** (Phase 2)
   - Send message User A → User B
   - Real-time Firestore listeners
   - Basic chat UI

3. **Persistence** (Phase 3)
   - Messages save locally
   - Offline queue
   - Sync logic

4. **Presence** (Phase 4)
   - Online/offline indicators
   - Quick win for MVP requirement

5. **Read Receipts** (Phase 5)
   - Implement for 1-on-1
   - Extend to groups (same logic)

6. **Group Chat** (Phase 6)
   - Extend existing chat logic
   - Add participant management

7. **Push Notifications** (Phase 7)
   - Foreground notifications
   - Basic deep linking

8. **Polish & Test** (Phases 8 & 9)
   - Fix edge cases
   - Write documentation

## Out of Scope for MVP

These features are explicitly NOT required and should be deferred:

- ❌ Image/video/audio messages
- ❌ Voice/video calls
- ❌ Message editing
- ❌ Message deletion
- ❌ Forward messages
- ❌ Search messages
- ❌ Profile picture upload
- ❌ User search/discovery
- ❌ Contact syncing
- ❌ Message encryption (E2E)
- ❌ Reactions/emojis on messages
- ❌ Message replies/threading
- ❌ File attachments
- ❌ Location sharing
- ❌ Background push notifications (nice-to-have)
- ❌ TestFlight/Play Store deployment (nice-to-have)


## Success Criteria

MVP is complete when:
- ✅ All 12 explicit requirements are working
- ✅ 2+ simulators can chat in real-time
- ✅ Messages persist after app restart
- ✅ Offline messages sync when reconnected
- ✅ Group chat works with 3+ users
- ✅ Read receipts work in both 1-on-1 and groups
- ✅ Foreground notifications work
- ✅ README allows anyone to clone and run locally
- ✅ All test scenarios pass




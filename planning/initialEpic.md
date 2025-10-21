MVP Epic: Core Messaging Infrastructure
Epic Overview
Build a production-quality messaging foundation with real-time sync, offline support, and group chat capabilities using React Native + Expo + Firebase.

Key Features (Feature Breakdown)
1. Project Setup & Infrastructure

Initialize Expo project with proper folder structure
Configure Firebase (Firestore, Auth, Cloud Messaging)
Set up navigation (Expo Router recommended)
Configure local storage (Expo SQLite or AsyncStorage)
Set up environment variables and configuration
Basic UI component library/styling setup (consider NativeWind for Tailwind-like styling)

2. User Authentication & Profiles

Firebase Authentication integration
Login/signup flow (email/password minimum)
User profile creation (display name, profile picture)
Persistent auth state
Profile viewing/editing

3. One-on-One Chat

Chat list view (shows all conversations)
Individual chat screen with message history
Send text messages
Real-time message delivery (Firestore listeners)
Message persistence (local + cloud)
Timestamps on messages
Optimistic UI updates (show message immediately, then confirm)
Message delivery states (sending → sent → delivered → read)

4. Real-Time Sync & Offline Support

Firestore real-time listeners for incoming messages
Local database sync (queue messages when offline)
Automatic retry logic when connection restored
Handle app backgrounding/foregrounding
Survive app force-quit (persistence)
Network state detection

5. Presence & Status Indicators

Online/offline status indicators
"Last seen" timestamps
Typing indicators
Real-time presence updates via Firestore

6. Read Receipts

Track message read status
Update UI to show read/unread state
Sync read status across devices
Display read receipts in chat

7. Group Chat

Create group chats (3+ users)
Group chat list/selection
Message attribution (show sender in group)
Group member list
Delivery tracking for multiple recipients
Group metadata (name, participants)

8. Media Support

Image picker integration (Expo ImagePicker)
Send images in chat
Image upload to Firebase Storage
Display images in message thread
Image thumbnails and full-view

9. Push Notifications

Firebase Cloud Messaging setup
Notification permissions
Foreground notifications (minimum for MVP)
Background/killed state notifications (if time permits)
Notification tap handling (deep link to chat)

10. Testing & Edge Cases

Handle rapid-fire messages (20+ quickly)
Poor network conditions (airplane mode toggle)
App lifecycle testing (background/foreground/force-quit)
Multi-device real-time sync verification
Message ordering consistency


Recommended Tech Stack Specifics
Core:

Expo Router - file-based navigation (easier than React Navigation setup)
Expo SQLite - local message persistence
Firebase Firestore - real-time database
Firebase Auth - authentication
Firebase Storage - image/media storage
Firebase Cloud Messaging (FCM) - push notifications

UI/Styling:

NativeWind (Tailwind for React Native) or Tamagui - faster styling
Expo Image - optimized image handling
React Native Gifted Chat - optional (pre-built chat UI, but might limit customization)

State Management:

Zustand or Context API - lightweight state management
Avoid Redux for MVP speed

Utilities:

date-fns - timestamp formatting
expo-image-picker - media selection
expo-notifications - push notification handling


Setup Priority Order

Foundation First: Auth + basic navigation + Firebase connection
Core Loop: Send message → see it appear → persists locally
Real-time: Firestore listeners working between devices
Offline Resilience: Queue and sync logic
Polish MVP Features: Presence, read receipts, groups, media
Notifications: Get basic foreground notifications working
Testing: Verify all MVP requirements with real devices


AI Feature Preparation (Post-MVP)
To set yourself up for AI features later, consider:

Message schema: Include metadata fields for AI processing (e.g., language, aiProcessed, summary)
Cloud Functions setup: You'll need Firebase Cloud Functions to call OpenAI/Claude APIs (don't expose API keys client-side)
Conversation indexing: Structure Firestore queries to easily retrieve conversation history for RAG
User preferences collection: Store AI settings/preferences early


Notes on Firebase Structure
Suggested Firestore schema:
users/
  {userId}/
    - displayName
    - photoURL
    - online
    - lastSeen

conversations/
  {conversationId}/
    - participants: [userId1, userId2, ...]
    - type: 'direct' | 'group'
    - lastMessage
    - updatedAt
    
    messages/
      {messageId}/
        - text
        - senderId
        - timestamp
        - readBy: [userId1, ...]
        - deliveredTo: [userId1, ...]
        - mediaUrl (optional)


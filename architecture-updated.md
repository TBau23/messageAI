# React MessageAI Architecture (Updated)

Updated with the current codebase as of 2025-01-12.

---

## 1. High-Level Overview
- WhatsApp-style messaging app built with Expo Router on React Native.
- Real-time chat backed by Firebase Auth, Firestore, and Firebase Storage.
- Offline-first experience via Expo SQLite cache that mirrors Firestore collections.
- Push notifications delivered through Expo Notifications with in-app banner fallbacks.

---

## 2. Stack & Runtime
- **Mobile runtime:** Expo SDK 54 on React Native 0.81 (`package.json`).
- **Routing:** Expo Router file-based navigation (`app/` directory).
- **State management:** Multiple Zustand stores for auth, chat, notifications, and network awareness (`store/*.js`, `utils/networkMonitor.js`).
- **Services:** Firebase Auth, Firestore (long polling enabled), Firebase Storage.
- **Device APIs:** Expo Notifications, Image Picker, Image Manipulator, Device, NetInfo, SQLite.

---

## 3. Application Bootstrap & Global Services
1. **Entry point** – `expo-router/entry` loads `app/_layout.js`.
2. **SQLite init** – `database.init()` bootstraps tables and pending migrations before any screen renders (`app/_layout.js`).
3. **Network monitoring** – `startNetworkMonitoring()` attaches NetInfo listeners and exposes connectivity state through `useNetworkStore`.
4. **Auth session** – `app/index.js` invokes `initializeAuth()` from `authStore` to wire `onAuthStateChanged`.
5. **Routing guard** – Once auth state resolves, users are redirected to `(main)` or `(auth)` route groups.
6. **Push token** – When a user session exists, `registerPushToken()` obtains an Expo push token, stores it in Firestore, and caches it locally.
7. **App state tracking** – `AppState` listeners toggle Firestore `online`/`lastSeen` flags and refresh badge counts when returning to foreground.
8. **Notification taps** – Foreground/background notification taps are routed to the proper chat (`app/_layout.js`).

---

## 4. Data Sources & Schema

### 4.1 Firestore
- **Collection `users/{uid}`:** `email`, `displayName`, `photoURL`, `online`, `lastSeen`, `createdAt`, `pushToken`, `pushTokenUpdatedAt`, etc. (`store/authStore.js`, profile flows).
- **Collection `conversations/{conversationId}`:** `participants`, `type` (`direct` | `group`), `name`, `createdAt`, `updatedAt`, `lastMessage` (text, senderId, timestamp, readBy). (`store/chatStore.js`).
- **Sub-collection `conversations/{conversationId}/messages/{messageId}`:** `text`, `senderId`, `timestamp`, `localId`, `clientSentAt`, `deliveredTo`, `readBy`, `deliveredReceipts`, `readReceipts`, optional `imageURL`, `imageWidth`, `imageHeight`, `status`. (`store/chatStore.js`, `app/(main)/chat/[id].js`).
- **Sub-collection `conversations/{conversationId}/typingStatus/{uid}`:** `typing`, `updatedAt` (used for 5-second freshness window). (`app/(main)/chat/[id].js`).

### 4.2 Expo SQLite Cache
Defined in `utils/database.js`:
- **Table `messages`** – Primary key `id`, `conversation_id`, `sender_id`, `text`, `timestamp`, JSON blobs for delivered/read receipts, optional image metadata, `cached_at`.
- **Table `conversations`** – Primary key `id`, `type`, `name`, JSON `participants`, serialized `last_message`, `updated_at`, `cached_at`.
- **Table `users`** – Primary key `uid`, `email`, `display_name`, `online` (int), `last_seen`, `cached_at`.
- Automatic migration adds image columns (`image_url/width/height`) when absent (`migrateSchema()`).
- Helper methods `upsertConversation`, `upsertMessage`, `upsertUser`, retrieval methods, and debug helpers (`clearAllCache`, `resetDatabase`).

---

## 5. State Management (Zustand Stores)

### 5.1 `useAuthStore` (`store/authStore.js`)
- **State:** `user`, `loading`, `error`, `pushToken`.
- **Key effects:**
  - `initializeAuth()` wires Firebase auth listener, fetches Firestore profile, marks user online/offline.
  - `signIn/signUp` manage Firebase Auth credentials and Firestore user documents.
  - `updateProfile` updates display name and syncs store.
  - `registerPushToken` handles Expo Notification permissions, persists `pushToken` to Firestore, deduplicates on repeat runs.
  - `setUserOnlineStatus` toggles Firestore presence on app state changes.
  - `signOut` clears push token, marks user offline, invokes Firebase sign out.

### 5.2 `useChatStore` (`store/chatStore.js`)
- **State:** `conversations`, `messages`, `currentConversation`, `pendingMessages`, `messageMetrics`, `previousConversations`, `isInitialLoad`, `unreadCount`.
- **Subscriptions:**
  - `subscribeToConversations(userId)` – Hydrates from SQLite first, then Firestore real-time query; fetches participant profiles, writes cache, and triggers in-app notifications for new messages (skips initial snapshot).
  - `subscribeToMessages(conversationId, userId)` – Hydrates cached messages, maintains optimistic pending queue, listens to Firestore messages, writes delivery receipts, merges and orders by derived timestamps.
- **Mutation helpers:** `getOrCreateConversation`, `createGroupConversation`, `sendMessage` (optimistic updates + push notifications), `retryMessage`, `markMessagesAsRead`, `clearMessages`.
- **Push integration:** `sendPushToRecipients` loads participant push tokens and calls Expo push API.
- **Badge management:** `calculateUnreadCount`, `updateBadgeCount` (delegates to Expo Notifications).

### 5.3 `useNotificationStore` (`store/notificationStore.js`)
- Tracks foreground notification banner data and currently open chat to suppress duplicates.
- Exposed methods: `setCurrentChatId`, `showNotification`, `clearNotification`, `shouldSuppressPush`.

### 5.4 `useNetworkStore` (`utils/networkMonitor.js`)
- Maintains `isOnline` and `isConnecting` flags, showing transient “Connecting…” state after reconnection.
- Public helpers `startNetworkMonitoring`, `stopNetworkMonitoring`, `getNetworkState`.

---

## 6. Core Data Flows

### 6.1 Authentication & Presence
1. `initializeAuth()` listens for Firebase Auth changes and resolves Firestore user data.
2. On sign-in/up, Firestore `users` doc is created or updated; presence fields (`online`, `lastSeen`) are refreshed on every state transition.
3. `app/_layout.js` AppState listener ensures `setUserOnlineStatus(false)` when backgrounded and re-enables presence + badge count when foregrounded.
4. Profile setup (`app/(auth)/profile-setup.js`) and profile screen updates propagate through Firestore and rehydrate the store.

### 6.2 Conversation Lifecycle
1. Chat list (`app/(main)/index.js`) mounts `subscribeToConversations(user.uid)`.
2. Cached conversations render immediately; Firestore updates replace or merge and cache again.
3. Notification store compares `previousConversations` to detect new remote messages and displays `MessageNotification` when applicable.
4. Selecting a conversation navigates to `/chat/{id}`, marking it as `currentConversation`.

### 6.3 Messaging & Receipts
1. Compose area supports text and optional image attachments (`pickImageForMessage`, `uploadMessageImage`).
2. `sendMessage` creates a `temp_*` optimistic record, updates caches, stores latency metadata, then writes to Firestore.
3. Firestore snapshot acknowledges message, clearing pending state and measuring delivery latency.
4. Background updates mark delivered messages (`deliveredTo` + `deliveredReceipts`) for all non-sender recipients.
5. When the chat screen is focused, unread messages from others prompt `markMessagesAsRead`, updating message docs and conversation `lastMessage.readBy`.
6. `MessageStatusIndicator` renders human-readable status (pending, sent, delivered, read) and group read breakdown modals.

### 6.4 Typing Indicators
- Each keystroke schedules `updateTypingStatus(true)` throttled to ~2s intervals.
- Inactivity clears typing flag; remote snapshots filtered to entries updated within 5 seconds.
- Group chats aggregate multiple typing members into a descriptive status string.

### 6.5 Notifications & Badges
- **Foreground:** `MessageNotification` banner via `useNotificationStore`; suppressed for active chat.
- **Background:** `sendPushToRecipients` loads recipient push tokens from Firestore and POSTs to Expo push API; Expo notification handler suppresses OS alerts while app is foregrounded but still updates badge count.
- `updateBadgeCount` recalculates unread conversations and updates the app badge using Expo Notifications.

### 6.6 Offline & Cache Strategy
- SQLite mirrors conversations, messages, and user profiles to allow instant rendering and resilience when offline.
- `NetworkBanner` reacts to `useNetworkStore` to inform users when offline; messages are queued optimistically and flagged as failed if Firestore writes reject.
- Debug utilities on chat list and profile screens provide manual cache clear or full database reset options.

---

## 7. Screen & Navigation Overview

### Auth Route Group `(auth)`
- `login.js` – Email/password sign-in with validation.
- `signup.js` – Account creation and navigation to profile setup.
- `profile-setup.js` – Collects display name post-signup.

### Main Route Group `(main)`
- `_layout.js` – Defines stack navigator, hides headers, overlays notification banner.
- `index.js` – Conversation list with menu (profile, cache controls, sign out).
- `new-chat.js` – User search, multi-select for group chat, modal to name groups.
- `chat/[id].js` – Full chat experience with message list, typing indicators, read receipts, attachment support, member list modal, and group name editing.
- `profile.js` – View/update display name, profile photo upload (via Firebase Storage), cache clear, sign-out.

### Root Layout
- `app/_layout.js` manages global services (SQLite init, network monitoring, push registration, notification routing).
- `app/index.js` acts as splash/redirector based on auth state.

---

## 8. Shared Components & Utilities
- **`Avatar`** (`components/Avatar.js`) – Profile image with initials fallback and deterministic color palette.
- **`MessageNotification`** – Animated foreground notification banner.
- **`MessageStatusIndicator`** – Delivery/read status UI for sent messages.
- **`NetworkBanner`** – Connectivity banner displayed on chat screens.
- **`imageUtils`** – Permission helpers, pickers, compression (`expo-image-manipulator`), and Firebase Storage uploads for profile, group, and message images.
- **`notifications`** – Expo Notifications handler, push token registration, badge management, `sendPushNotification` REST call.
- **`database`** – SQLite abstraction detailed above.
- **`networkMonitor`** – NetInfo integration plus Zustand store exposure.

---

## 9. External Configuration
- **Firebase config** (`firebaseConfig.js`) draws from Expo public env vars and enables Firestore long polling for Expo Go compatibility.
- **Expo app config** (`app.json`) registers plugins for router, notifications, and image picker; defines bundle IDs, icons, and splash assets.
- **Security rules** (`firestore.rules`) currently permissive (allow all reads/writes until 2025-11-19); production hardening required.

---

## 10. Notable Considerations & Gaps
- Message pagination is not implemented; entire history loads on each chat open.
- Firestore security rules are development-only; enforce participant-level access before production.
- Push notifications rely on Expo’s service—ensure device tokens remain valid and handle failure paths.
- SQLite cache includes manual reset options; consider background pruning or sync strategies for large datasets.
- Performance hotspots called out in legacy docs (e.g., group chat re-renders) should be validated against current implementation.

---

## 11. Reference Map
- **Bootstrap:** `app/_layout.js`, `app/index.js`.
- **State stores:** `store/authStore.js`, `store/chatStore.js`, `store/notificationStore.js`, `utils/networkMonitor.js`.
- **Data utilities:** `utils/database.js`, `utils/imageUtils.js`, `utils/notifications.js`.
- **Core screens:** `app/(main)/index.js`, `app/(main)/chat/[id].js`, `app/(main)/new-chat.js`, `app/(main)/profile.js`, `app/(auth)/*.js`.

This document supersedes the previous `ARCHITECTURE.md` and reflects the architecture observed directly in the repository.

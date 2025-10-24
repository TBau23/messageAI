# Phase 2: Push Notifications - Technical Design

**Goal:** Achieve 8/8 "Excellent" score for Mobile Lifecycle Handling (Rubric Section 2)

**Rubric Requirements:**
- App backgrounding → WebSocket maintains or reconnects instantly ✅ (Already done in Phase 1)
- Foregrounding → instant sync of missed messages ✅ (Already done in Phase 1)
- Push notifications work when app is closed ⬜ (This phase)
- No messages lost during lifecycle transitions ✅ (Already done in Phase 1)
- Battery efficient (no excessive background activity) ⬜ (This phase)

---

## Current State (Phase 1)

### ✅ What Exists
- **In-app notifications**: `MessageNotification.js` - banner notifications when app is foregrounded
- **Notification suppression**: `notificationStore.js` - prevents notifications from currently open chat
- **App lifecycle handling**: `app/_layout.js` - tracks active/background state, online status
- **Dependencies installed**: `expo-notifications` (0.32.12), `expo-linking` (8.0.8)

### ⬜ What's Missing
- Push notification permissions & token registration
- Push token storage in Firestore
- System push notification delivery (backgrounded/closed app)
- Deep linking on notification tap
- Badge count management
- Notification triggers (who sends the push?)

---

## Architecture Overview

### Flow Diagram
```
User A sends message
    ↓
Firestore message created
    ↓
chatStore.subscribeToConversations detects new message
    ↓
Check: Is User B online & in that chat?
    ├─ YES → In-app notification only (existing)
    └─ NO → Send push notification
            ↓
        Expo Push Service sends notification
            ↓
        User B's device receives push
            ↓
        User taps notification
            ↓
        App opens to specific chat (deep link)
```

### Key Decision: Client-Side Push Triggers (No Cloud Functions)
For simplicity and Expo Go compatibility, we'll send push notifications **from the client** when users send messages. This is acceptable for an educational project and doesn't require Firebase Cloud Functions setup.

**Trade-offs:**
- ✅ Simpler setup, works in Expo Go
- ✅ No backend deployment needed
- ⚠️ Sender must be online to trigger push (acceptable for messaging app)
- ⚠️ Not scalable for production (would use Cloud Functions)

---

## Implementation Plan

### 1. Permission & Token Registration

**File:** `utils/notifications.js` (new)

**Responsibilities:**
- Request notification permissions on app start (after login)
- Register for Expo push token
- Handle permission denied gracefully
- Refresh tokens on app restart

**Key Functions:**
```javascript
registerForPushNotifications()
  - Check permission status
  - Request permission if needed
  - Get Expo push token
  - Return token or null

setupNotificationHandlers()
  - Configure notification channels (Android)
  - Set default sound/vibration
  - Register tap listener for deep linking
```

**Integration Point:** Call from `app/_layout.js` after user authenticates

---

### 2. Token Storage

**File:** `store/authStore.js` (modify)

**Changes:**
- Add `pushToken` field to state
- Store token in Firestore on login: `users/{uid}.pushToken`
- Update token on app restart if changed
- Clear token on logout

**Firestore Schema:**
```javascript
users/{uid}
  ├─ displayName: string
  ├─ email: string
  ├─ lastActive: timestamp
  ├─ isOnline: boolean
  └─ pushToken: string  // NEW: Expo push token
```

---

### 3. Push Notification Triggers

**File:** `store/chatStore.js` (modify sendMessage function)

**Logic:**
```javascript
sendMessage(conversationId, text, userId)
  1. Create optimistic message (existing)
  2. Write to Firestore (existing)
  3. NEW: Get recipients who should receive push:
     - Get conversation participants
     - Exclude sender (self)
     - Filter to offline users OR users not in this chat
  4. NEW: For each recipient:
     - Get their pushToken from Firestore
     - Send push via Expo Push API
```

**Expo Push API Call:**
```javascript
POST https://exp.host/--/api/v2/push/send
Body: {
  to: recipientPushToken,
  title: senderName,
  body: messageText,
  data: { conversationId },
  sound: 'default',
  badge: unreadCount,
  channelId: 'messages' // Android
}
```

---

### 4. Deep Linking

**File:** `app/_layout.js` (modify)

**Add Notification Listener:**
```javascript
useEffect(() => {
  // Listen for notification taps
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const conversationId = response.notification.request.content.data?.conversationId;
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
    }
  });
  
  return () => subscription.remove();
}, []);
```

**Expo Go Deep Link Format:**
- App foregrounded: Direct navigation via router
- App closed: Opens to chat list, then navigate to chat

---

### 5. Badge Count Management

**File:** `store/chatStore.js` (add badge tracking)

**Logic:**
- Count unread messages across all conversations
- Update badge when:
  - New message received
  - User opens a conversation (mark as read)
  - App foregrounded (recalculate)

**Functions:**
```javascript
calculateUnreadCount(userId)
  - Sum messages where user not in readBy array
  - Exclude currently open chat

updateBadgeCount(count)
  - Notifications.setBadgeCountAsync(count)
  - Call on message receive, chat open, app foreground
```

---

### 6. Notification Suppression (Enhanced)

**File:** `store/notificationStore.js` (modify)

**Current:** Suppresses in-app notifications for open chat
**Enhancement:** Also suppress push notifications

**New Field:**
```javascript
suppressPushForChat: chatId | null
```

**Integration:**
- Set when user opens chat screen
- Clear when user leaves chat screen
- Check in `sendMessage` before sending push

---

### 7. Notification Channels (Android)

**File:** `utils/notifications.js`

**Setup:**
```javascript
setNotificationChannelAsync('messages', {
  name: 'Messages',
  importance: AndroidImportance.HIGH,
  sound: 'default',
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#075E54',
})
```

---

## File Changes Summary

### New Files
1. **`utils/notifications.js`** (~100 lines)
   - Permission handling
   - Token registration
   - Notification channel setup
   - Tap handler registration

### Modified Files
1. **`store/authStore.js`** (+30 lines)
   - Add `pushToken` state
   - Save/update token in Firestore
   - Clear token on logout

2. **`store/chatStore.js`** (+80 lines)
   - Add push sending logic to `sendMessage`
   - Add `calculateUnreadCount` function
   - Add `updateBadgeCount` function
   - Fetch recipient tokens from Firestore

3. **`app/_layout.js`** (+20 lines)
   - Call `registerForPushNotifications` on mount
   - Add notification tap listener
   - Update badge count on foreground

4. **`store/notificationStore.js`** (+5 lines)
   - Add `suppressPushForChat` tracking

---

## Testing Strategy

### Manual Tests (Physical Device Required)

**Test 1: Backgrounded App**
1. User A and B logged in
2. User B opens app, then backgrounds it (home button)
3. User A sends message
4. **Expected:** User B receives system push notification
5. User B taps notification
6. **Expected:** App opens to that chat

**Test 2: Closed App**
1. User B completely closes app (swipe away)
2. User A sends message
3. **Expected:** User B receives push notification
4. User B taps notification
5. **Expected:** App launches and navigates to chat

**Test 3: Suppression**
1. User B has app open, viewing Chat X
2. User A sends message to Chat X
3. **Expected:** No push notification (suppressed)
4. **Expected:** In-app notification shown (existing behavior)

**Test 4: Badge Count**
1. User B receives 3 messages across 2 chats while away
2. **Expected:** App icon shows badge "3"
3. User B opens Chat 1 (2 messages)
4. **Expected:** Badge updates to "1"
5. User B opens Chat 2
6. **Expected:** Badge clears to "0"

**Test 5: Permission Denied**
1. User denies notification permission
2. **Expected:** App still works, no crashes
3. **Expected:** In-app notifications still work

---

## Error Handling

### Scenarios
1. **Permission Denied**
   - Gracefully continue without push
   - Show in-app notifications only
   - Optional: Show one-time prompt to enable in Settings

2. **Token Registration Failed**
   - Log error
   - Continue without push
   - Retry on next app launch

3. **Push Send Failed**
   - Log error (don't block message send)
   - Message still saves to Firestore (primary path)

4. **Invalid/Expired Token**
   - Expo handles gracefully (fails silently)
   - User will get new token on next login

---

## Performance Considerations

### Battery Efficiency
- ✅ No background polling (Firestore listeners handle sync)
- ✅ Push notifications are system-level (not our code running)
- ✅ Token refresh only on app start, not periodic

### Network Efficiency
- Push API calls are small (<1KB per notification)
- Batch pushes if multiple recipients (group chat)
- Don't send push if already sending in-app notification

### Firestore Reads
- Fetching recipient tokens: 1 read per recipient per message
- Optimization: Cache tokens in memory for 5 minutes
- Trade-off acceptable for educational project

---

## Edge Cases

1. **Group Chat (5 users)**
   - User A sends message
   - Other 4 users need push
   - Filter: Only send to offline users or those not viewing chat
   - Maximum 4 push API calls (acceptable)

2. **Rapid Messages (20+ messages quickly)**
   - Each message triggers push check
   - User will receive multiple notifications
   - iOS/Android auto-group by app (native behavior)
   - Consider: Debounce pushes (wait 2s before sending)

3. **Notification Arrives While Opening App**
   - Race condition: Push sent, but user just opened app
   - Acceptable: User might see both push and in-app notification briefly
   - Low probability, minimal UX impact

4. **Deep Link to Deleted Conversation**
   - Check if conversation exists before navigating
   - Fallback: Navigate to chat list with error message

---

## Rubric Alignment

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| App backgrounding → maintain connection | AppState + Firestore listeners | ✅ Phase 1 |
| Foregrounding → instant sync | Firestore real-time + SQLite cache | ✅ Phase 1 |
| Push notifications when closed | Expo Push + deep linking | ⬜ Phase 2 |
| No message loss during transitions | Offline queue + retry logic | ✅ Phase 1 |
| Battery efficient | System push (no polling) | ⬜ Phase 2 |

**Target Score:** 8/8 (Excellent)

---

## Implementation Order

1. ✅ Create `utils/notifications.js` - permission & token registration
2. ✅ Modify `store/authStore.js` - store token in Firestore
3. ✅ Test permission flow on physical device
4. ✅ Modify `store/chatStore.js` - add push sending to `sendMessage`
5. ✅ Test push delivery (backgrounded app)
6. ✅ Add deep linking in `app/_layout.js`
7. ✅ Test notification tap navigation
8. ✅ Add badge count management
9. ✅ Test badge updates
10. ✅ Polish error handling & edge cases

**Estimated Time:** 4-6 hours

---

## Success Criteria

- [ ] Push notifications arrive within 3 seconds when app backgrounded
- [ ] Push notifications arrive when app completely closed
- [ ] Tapping notification opens correct chat 100% of time
- [ ] No notifications for currently open chat
- [ ] Badge count accurate across app lifecycle
- [ ] Works on both iOS and Android physical devices
- [ ] Graceful degradation if permissions denied
- [ ] No crashes or freezes during notification flow


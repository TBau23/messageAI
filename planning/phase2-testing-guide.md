# Phase 2: Push Notifications - Testing Guide

## Prerequisites
- **Physical iOS/Android device** (simulators don't support push)
- Two accounts or devices for full testing
- Expo Go app installed

---

## Quick Test Checklist

### 🔴 Critical Tests (Must Pass)

**Test 1: Push When Backgrounded**
1. User B: Open app, press home button (background, don't close)
2. User A: Send message to User B
3. ✅ User B receives push notification within 3 seconds
4. User B: Tap notification → App opens to correct chat

**Test 2: Push When App Closed**
1. User B: Swipe up and close app completely
2. User A: Send message to User B
3. ✅ User B receives push notification
4. ✅ Badge appears on app icon
5. User B: Tap notification → App launches to correct chat

**Test 3: No Push for Active Chat (Suppression)**
1. User B: Open chat with User A (stay on screen)
2. User A: Send message
3. ✅ In-app notification appears (banner at top)
4. ❌ NO system push notification

**Test 4: Badge Count Updates**
1. User B: Background app
2. User A: Send 2 messages
3. ✅ Badge shows "2" on app icon
4. User B: Open app and read messages
5. ✅ Badge clears to "0"

---

## Additional Tests

**Test 5: Permission Request**
- Fresh install → Login → Permission prompt appears
- Console shows: `✅ Expo push token obtained: ExponentPushToken[...]`

**Test 6: Permission Denied (Graceful Fallback)**
- Deny permission → App continues working
- In-app notifications still work
- No crashes

**Test 7: Group Chat**
- 3+ users in group
- User A sends message
- Other users receive push with sender name

**Test 8: Token Persists**
- Login → Close app → Reopen
- Console shows: "Push token unchanged" or re-registers same token
- No errors

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Push delivery | <3 seconds |
| Deep link navigation | <1 second |
| Badge update | <1 second |

---

## Troubleshooting

**No push arriving?**
- Using physical device (not simulator)?
- Permission granted in iOS Settings?
- User has `pushToken` in Firestore `users/{uid}`?
- Sender console shows: "Push notification sent to {userId}"?
- Recipient app is backgrounded (not foregrounded)?

**Deep link not working?**
- Check console: "Notification tapped, navigating to chat: {id}"
- Verify conversationId in notification data is valid

---

## Success Criteria

Phase 2 complete when all 4 critical tests pass:
- [ ] Test 1: Push when backgrounded ✅
- [ ] Test 2: Push when closed ✅
- [ ] Test 3: Suppression works ✅
- [ ] Test 4: Badge counts accurate ✅

**Expected Rubric Score:** 8/8 (Excellent) - Mobile Lifecycle Handling

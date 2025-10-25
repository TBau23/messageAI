# Critical Bugs - Phase 3 Read Receipt Implementation

**Date**: October 25, 2025
**Status**: 🔴 BLOCKING - Major issues with read receipts and message management

---

## 🔴 BUG #1: Excessive React Re-renders in Group Chats

### Severity: CRITICAL
**Symptom**: When sending a message in a group chat, thousands of console logs appear, causing severe performance degradation.

### Observable Behavior:
- Console is flooded with logs (potentially thousands)
- Read receipts update slowly/flicker
- UI feels sluggish after sending group messages
- Only happens in group chats, not 1-on-1 chats

### Hypotheses:
1. **React re-render storm**: useEffect dependencies causing cascading re-renders
2. **Firestore listener spam**: Multiple simultaneous listener updates
3. **SQLite cache thrashing**: Excessive cache reads/writes
4. **Message array mutations**: Messages array being mutated causing React to re-render excessively

### To Investigate:
- [ ] Count of useEffect executions per message send
- [ ] Number of Firestore listener callbacks triggered
- [ ] Are we mutating the messages array instead of creating new references?
- [ ] Is participantMap causing cascading updates?
- [ ] Check if logging itself is causing performance issues (remove logs and test)

### Possible Root Causes:
```javascript
// In chat/[id].js - Line 262-301
useEffect(() => {
  // This runs EVERY time messages updates
  // If messages array is being mutated, this could fire repeatedly
}, [id, messages, user]);

// Line 248-259 - useFocusEffect
useFocusEffect(
  useCallback(() => {
    // Does this cause re-renders?
  }, [id])
);
```

### Impact:
- Performance degradation in group chats
- Poor user experience
- Potential app crashes with very large groups
- Excessive Firestore reads (cost implications)

---

## 🔴 BUG #2: Message Cross-Contamination Between Conversations

### Severity: CRITICAL
**Symptom**: Messages from one conversation appearing in another conversation.

### Observable Behavior:
- User A sends message to User B (1-on-1 chat)
- User B views the message
- User A and B are also in a Group Chat with User C
- Messages from the 1-on-1 chat appear in the Group Chat (or vice versa)

### Specific Scenario:
```
Users: A, B, C
Conversations:
  1. Conversation_AB: Direct chat between A and B
  2. Conversation_ABC: Group chat with A, B, and C

Steps to reproduce:
1. User A sends "Hello" to User B in Conversation_AB
2. User B opens Conversation_AB and views the message
3. Navigate to Conversation_ABC
4. Message "Hello" appears in Conversation_ABC (WRONG!)
```

### Hypotheses:
1. **Message subscription leak**: Messages from one conversation bleeding into another
2. **clearMessages() not working**: Old messages not being cleared when switching chats
3. **SQLite cache returning wrong messages**: Cache query filtering by wrong conversationId
4. **State management bug**: Messages array in Zustand not properly isolated by conversation
5. **pendingMessages corruption**: Pending messages being assigned to wrong conversation

### To Investigate:
- [ ] Check `subscribeToMessages()` - is it properly filtering by conversationId?
- [ ] Verify `clearMessages()` is called when leaving a chat
- [ ] Check SQLite query in `database.getMessagesByConversation()`
- [ ] Verify `currentConversation` state is properly set/cleared
- [ ] Check if message IDs are globally unique or conversation-scoped
- [ ] Look for any shared state between conversation instances

### Possible Root Causes:
```javascript
// In chatStore.js - subscribeToMessages
subscribeToMessages: (conversationId, userId) => {
  set({ currentConversation: conversationId });
  
  // Is this query filtering correctly?
  const q = query(
    collection(db, `conversations/${conversationId}/messages`),
    orderBy('timestamp', 'asc')
  );
  
  // Are we properly clearing old subscriptions?
  // Are messages being merged incorrectly?
}
```

### Impact:
- **Data privacy violation**: Users seeing messages not meant for them
- Loss of trust in the app
- Potential security/privacy issues
- Data integrity problems

---

## 🔴 BUG #3: Read Receipt Flickering in Group Chats

### Severity: MEDIUM
**Symptom**: Read receipt indicators flicker/update slowly in group chats.

### Observable Behavior:
- Send message in group chat
- Read receipt shows incorrect count initially
- Slowly updates to correct count
- May flicker between different values

### Related To:
- Likely related to Bug #1 (re-render storm)
- May be caused by multiple Firestore updates racing

### Hypotheses:
1. Multiple `markMessagesAsRead()` calls happening simultaneously
2. Race condition between Firestore updates and local state
3. SQLite cache returning stale data
4. `lastMessage.readBy` array being updated multiple times

---

## 🟡 Previously Fixed Issues (for context)

### ✅ Text Messages Showing as Random Characters
**Fixed**: Parameter order in `sendMessage()` was wrong

### ✅ Profile Photos Not Displaying
**Fixed**: Using wrong userId in Avatar component

### ✅ Chat List Not Showing Unread Indicator
**Fixed**: Added green dot and bold text for unread messages

### ✅ Messages Marked as Read Without Opening Chat
**Fixed**: Added `useFocusEffect` to only mark as read when screen is focused

---

## 🔧 Immediate Action Items

### Priority 1: Message Cross-Contamination (Bug #2)
**This is a data integrity issue and must be fixed immediately**

1. Add conversationId validation to all message operations
2. Audit all Firestore queries to ensure proper filtering
3. Add defensive logging to track message flow between conversations
4. Review clearMessages() implementation

### Priority 2: React Re-render Storm (Bug #1)
**This is causing performance issues**

1. Remove all console.log statements (they may be slowing things down)
2. Audit all useEffect dependencies
3. Use React DevTools Profiler to identify re-render hotspots
4. Check for array mutations vs. new array creation
5. Consider memoization (React.memo, useMemo, useCallback)

### Priority 3: Performance Optimization
1. Profile the app with React DevTools
2. Measure Firestore read count per action
3. Consider message pagination (currently loads ALL messages)
4. Optimize participant data fetching

---

## 📊 Debugging Strategy

### Phase 1: Reproduce Reliably
- [ ] Document exact steps to reproduce Bug #2
- [ ] Record screen while reproducing Bug #1
- [ ] Test with different group sizes (2, 3, 5, 10 people)

### Phase 2: Add Diagnostics
- [ ] Add conversationId to ALL message-related logs
- [ ] Log Firestore query execution (query.toString())
- [ ] Count useEffect executions with a counter
- [ ] Log message array before/after every state update

### Phase 3: Isolate Root Cause
- [ ] Test with Firestore listeners disabled (use manual refetch)
- [ ] Test with SQLite cache disabled
- [ ] Test with logging completely removed
- [ ] Test with focus detection removed

### Phase 4: Fix & Verify
- [ ] Implement fix
- [ ] Test all scenarios (1-on-1, group, multiple chats)
- [ ] Performance test with large message history
- [ ] Load test with multiple simultaneous users

---

## 🤔 Questions to Answer

1. **Why does group chat behave differently than 1-on-1?**
   - More participants = more Firestore updates?
   - participantMap causing cascading re-renders?

2. **Is SQLite helping or hurting?**
   - Is the cache causing stale data issues?
   - Would removing cache simplify debugging?

3. **Are we over-subscribing to Firestore?**
   - How many active listeners do we have?
   - Are we properly unsubscribing?

4. **Is the focus detection causing issues?**
   - Does useFocusEffect interact badly with other hooks?
   - Is isFocusedRef.current causing race conditions?

---

## 📝 Notes

- Logs suggest multiple simultaneous `[READ CHECK]` executions
- The "thousands of logs" suggests a loop or cascading effect
- Message cross-contamination is the most serious issue (data integrity)
- May need to fundamentally rethink the read receipt architecture
- Consider whether the current implementation is scalable

---

## 🎯 Success Criteria

Before considering this fixed:
- [ ] No message cross-contamination between conversations
- [ ] <10 console logs per message send
- [ ] Read receipts update instantly without flickering
- [ ] No performance degradation in group chats
- [ ] All tests pass across 1-on-1 and group chats
- [ ] Load test with 10+ participants succeeds


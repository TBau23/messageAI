--offline status is ugly
-- auth errors should have better ux
-- add and remove people from group chat once created
-- user profile page
-- in app push notifications dont send everytime?
-- do we need streaming?

2. List Performance Warning
VirtualizedList: You have a large list that is slow to update
React Native is warning about list rendering performance. This is the performance issue we suspected. Not critical for now, but should be optimized later with:
React.memo() on message components
Message pagination (load 50 at a time)

Excellent question! Let me break down the **root cause** of the critical bug that was causing both issues:

## 🐛 The Core Problem: Race Condition with Global State

### **The Bug Explained Simply**

The `messages` array in Zustand is **global** - there's only ONE array for the entire app. When you open a chat, `subscribeToMessages()` does two things:

1. **Loads from SQLite cache** (fast, ~50ms)
2. **Subscribes to Firestore** (slower, ~200-500ms)

Both of these **asynchronously** call `set({ messages: [...] })` to update the global array.

### **The Race Condition**

Here's what was happening when you switched chats quickly:

```javascript
Time 0ms:   Open Chat A
            - subscribeToMessages(chatA) starts
            - set({ currentConversation: chatA })
            
Time 50ms:  Cache loads Chat A messages
            - set({ messages: [chatA msgs] }) ✅
            
Time 100ms: User switches to Chat B!
            - subscribeToMessages(chatB) starts
            - set({ currentConversation: chatB })
            
Time 150ms: Cache loads Chat B messages
            - set({ messages: [chatB msgs] }) ✅
            
Time 300ms: 🔥 Firestore for Chat A finishes loading
            - set({ messages: [chatA msgs] }) ❌
            - BUT currentConversation is now chatB!
            - Chat B screen now shows Chat A messages!
```

### **Why This Caused Both Issues**

**1. Message Cross-Contamination:**
- Chat B screen shows Chat A messages because the late Firestore update overwrote the correct messages
- The code never checked if the conversation was still active before setting messages

**2. Read Receipt Flickering:**
When multiple users were viewing the same group chat:
- User 1 marks message as read → Firestore updates
- User 2's listener receives update → Triggers Firestore callback
- User 3's listener receives update → Triggers Firestore callback
- **All 3 callbacks try to update `lastMessage.readBy` simultaneously**
- Race condition causes flickering as updates arrive out of order
- Combined with the cross-contamination bug, read receipts were updating for the wrong conversations

### **The Fix**

Added **guards** before every `set()` call:

```javascript
const unsubscribe = onSnapshot(q, async (snapshot) => {
  // ✅ CHECK: Is this conversation still active?
  const currentState = get();
  if (currentState.currentConversation !== conversationId) {
    console.warn(`⚠️ Ignoring update for ${conversationId}`);
    return; // Stop! Don't update messages
  }
  
  // ... process messages ...
  
  // ✅ FINAL CHECK: Re-check in case it changed during async operations
  const finalState = get();
  if (finalState.currentConversation !== conversationId) {
    return; // Stop again!
  }
  
  set({ messages: [...] }); // Safe to update now
});
```

### **Visual Analogy**

Think of it like a mailbox:

**Without the fix:**
```
You: "I want mail for Apartment A"
Mailman: "OK, collecting..." (takes 5 minutes)
You: "Wait, I moved to Apartment B"
Mailman: *arrives 5 minutes later* "Here's mail for Apartment A!"
You: *now at Apartment B* "Why am I getting Apartment A's mail?!"
```

**With the fix:**
```
You: "I want mail for Apartment A"
Mailman: "OK, collecting..." (takes 5 minutes)
You: "Wait, I moved to Apartment B"
Mailman: *arrives 5 minutes later* "Are you still at Apartment A?"
You: "No, I'm at B now"
Mailman: "OK, I'll throw this away then" ✅
```

### **Why It Was Worse in Group Chats**

Group chats have **more participants** = **more Firestore updates** happening simultaneously:

- 3 people in group = 3x the Firestore listener callbacks
- Each person marking messages as read = more updates
- More async operations = higher chance of race conditions
- The flickering was multiple race conditions compounding

### **The Key Insight**

The bug wasn't about SQLite cache being wrong - **the data was correct**. The bug was about **timing**: async operations finishing **after** the user had moved on to a different conversation, and the code not checking if the update was still relevant.

Does that make sense now? 🎯
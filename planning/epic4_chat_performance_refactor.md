# Epic 4: Chat Screen Refactor

## 🎯 Goal
Refactor 2,270-line chat component into maintainable, performant architecture. **Protect 5-6 rubric points** at risk.

## 📊 Current State
- **2,270 lines total** (main component)
- **VirtualizedList performance warning** (documented in THINGS_TO_FIX.md)
- **No memoization** → all messages re-render on every state change
- **Mixed concerns** → messaging, translation, explanations, UI all in one file

## 🎓 Rubric Impact
| Section | Current | After | Impact |
|---------|---------|-------|--------|
| Performance & UX (12pts) | 8-9 | 11-12 | **+3-4** |
| Architecture (5pts) | 3 | 5 | **+2** |
| **Total Protection** | | | **+5-6 points** |

---

## 📋 Tasks (Quick Wins First)

### ✅ Task 1: Extract Styles (~1 hour, ZERO risk)
**Status**: COMPLETED ✅  
**Result**: 2,270 → 1,511 lines (-759 lines)

Created `[id].styles.js` and imported into main component.

---

### Task 2: Memoize MessageBubble (~3-4 hours, CRITICAL)
**Priority**: 🔴 HIGHEST - Fixes VirtualizedList warning

**Create**: `components/chat/MessageBubble.js`

```javascript
import React, { memo } from 'react';

const MessageBubble = memo(({ 
  message, 
  isMyMessage,
  senderName,
  isGroup,
  shouldShowReadReceipt,
  shouldShowTranslateButton,
  translation,
  isTranslating,
  showTranslation,
  participantMap,
  conversationType,
  currentUserId,
  onLongPress,
  onTranslate,
  onRetry,
  onPressStatusDetails,
  styles,
}) => {
  // Copy renderMessage logic here (~150 lines)
  return ( /* Message UI */ );
}, (prev, next) => {
  // Only re-render if these props change
  return (
    prev.message.id === next.message.id &&
    prev.message.text === next.message.text &&
    prev.message.status === next.message.status &&
    prev.shouldShowReadReceipt === next.shouldShowReadReceipt &&
    prev.translation?.isVisible === next.translation?.isVisible &&
    prev.isTranslating === next.isTranslating
  );
});

export default MessageBubble;
```

**In main component**, replace `renderMessage`:
```javascript
<FlatList
  renderItem={({ item }) => (
    <MessageBubble
      message={item}
      isMyMessage={item.senderId === user.uid}
      styles={styles}
      // ... other props
    />
  )}
/>
```

**Impact**: 
- ✅ Eliminates VirtualizedList warning
- ✅ 60 FPS scrolling
- ✅ 90% fewer re-renders
- ✅ +3-4 rubric points

**Test**:
- [ ] Messages render correctly
- [ ] No console warnings
- [ ] Scroll is smooth
- [ ] All message interactions work (long-press, translate, retry)

---

### Task 3: Extract Modals (~2-3 hours, LOW risk)
**Priority**: 🟡 HIGH

Create 5 modal components in `components/chat/`:

1. **MemberListModal.js** (~80 lines)
2. **EditGroupNameModal.js** (~60 lines)  
3. **TranslationSettingsModal.js** (~150 lines)
4. **ExplanationModal.js** (~120 lines)
5. **MessageStatusModal.js** (~90 lines)

**Pattern**:
```javascript
export default function MemberListModal({ visible, onClose, participants, currentUserId }) {
  if (!visible) return null;
  return (
    <Modal visible={visible} onRequestClose={onClose}>
      {/* Modal JSX */}
    </Modal>
  );
}
```

**Impact**: -400 lines from main component

**Test**:
- [ ] All modals open/close correctly
- [ ] Member list shows participants
- [ ] Edit group name works
- [ ] Translation settings work
- [ ] Explanation modal works
- [ ] Message status modal works

---

## 📈 After Quick Wins (Tasks 1-3)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Lines | 2,270 | ~1,120 | -51% |
| VirtualizedList warning | ❌ | ✅ | Fixed |
| 60 FPS scrolling | ❌ | ✅ | Fixed |
| Rubric risk | HIGH | LOW | Protected |

**Time**: 6-8 hours total  
**Points protected**: 5-6 points

---

## 🚀 Optional Advanced Tasks

### Task 4: Translation Hook (~3 hours)
Create `hooks/useMessageTranslation.js` to extract ~200 lines of translation logic.

### Task 5: Explanation Hook (~2 hours)
Create `hooks/useMessageExplanations.js` to extract ~150 lines.

### Task 6: Add Memoization (~2 hours)
Add `useMemo`/`useCallback` for expensive computations and callbacks.

### Task 7: Typing Hook (~2 hours)
Create `hooks/useTypingIndicators.js` to extract ~80 lines.

### Task 8: ChatHeader Component (~2 hours)
Extract header to separate component (~120 lines).

### Task 9: ChatInput Component (~3 hours)
Extract input area to separate component (~200 lines).

---

## 🧪 Testing After Each Task

### Critical Tests
1. **Messages**: Send text, send image, scroll, long-press
2. **Translation**: Enable/disable, preview, translate received messages
3. **Modals**: Open/close all 5 modals
4. **Group Chat**: Member list, edit name, typing indicators
5. **Read Receipts**: Tap in group chat, verify status modal
6. **Offline**: Go offline, send message, see retry button

### Performance Tests
1. Scroll through 100+ messages → should be smooth
2. Type in input → no lag
3. Check console → no VirtualizedList warnings

---

## 📊 Final Target

| Metric | Target |
|--------|--------|
| Main component | < 1,000 lines |
| VirtualizedList warning | None |
| FPS (1000 msgs) | 60 |
| Re-render reduction | 70%+ |
| Rubric score | +5-6 points |

---

## 🔄 Current Progress

- ✅ Task 1: Styles extracted (-759 lines)
- 🎯 **Next**: Task 2 - MessageBubble (CRITICAL)

**Status**: 1/3 quick wins complete, ready for most important optimization!

# Epic 3: Cultural Intelligence Features - Task Breakdown

## Overview
Add contextual understanding features that explain idioms, slang, and cultural nuances in messages through long-press interactions.

**Goal:** Enable users to understand cultural context and linguistic nuances in multilingual conversations.

---

## Task Groups

### 1. Backend - Firebase Functions (4 tasks)

#### Task 3.1: Create `explainIdioms` Cloud Function
**Priority:** High  
**Estimated Time:** 2 hours

- [ ] Create `functions/src/explainIdioms.js`
- [ ] Implement authenticated callable function
- [ ] Add rate limit check for `explanations` feature type
- [ ] Design system prompt for idiom/slang analysis:
  - Focus on literal vs. figurative meaning
  - Identify slang, idioms, expressions
  - Provide cultural/regional context
  - Return null if no idioms detected
- [ ] Use GPT-4o-mini for cost efficiency
- [ ] Add request/response logging
- [ ] Return structured response: `{ hasIdioms: boolean, explanation: string | null }`
- [ ] Test with examples: "break a leg", "it's raining cats and dogs", "piece of cake"

#### Task 3.2: Create `explainCulturalContext` Cloud Function
**Priority:** High  
**Estimated Time:** 2 hours

- [ ] Create `functions/src/explainCulturalContext.js`
- [ ] Implement authenticated callable function
- [ ] Add rate limit check for `explanations` feature type
- [ ] Design system prompt for cultural analysis:
  - Explain why/how phrases are used in specific cultures
  - Identify tone, formality, social context
  - Note cultural sensitivities or etiquette
  - Return null if no significant cultural context
- [ ] Use GPT-4o-mini
- [ ] Add request/response logging
- [ ] Return structured response: `{ hasContext: boolean, explanation: string | null }`
- [ ] Test with multilingual examples (Japanese formality, Spanish regionalisms)

#### Task 3.3: Implement Explanation Caching System
**Priority:** Medium  
**Estimated Time:** 1.5 hours

- [ ] Create Firestore collection: `explanations/{hash}`
- [ ] Schema: `{ messageText, type (idiom/cultural), language, explanation, createdAt, expiresAt }`
- [ ] Set TTL to 30 days (longer than translations due to static nature)
- [ ] Generate cache key from: `hash(messageText + type + detectedLanguage)`
- [ ] Check cache before calling OpenAI API
- [ ] Write to cache after successful API response
- [ ] Add cache hit/miss logging
- [ ] Return `cached: true/false` in metadata

#### Task 3.4: Export New Functions
**Priority:** High  
**Estimated Time:** 15 minutes

- [ ] Add imports to `functions/index.js`
- [ ] Export `explainIdioms` function
- [ ] Export `explainCulturalContext` function
- [ ] Deploy functions: `firebase deploy --only functions`
- [ ] Verify functions appear in Firebase Console

---

### 2. Frontend - Chat UI Integration (5 tasks)

#### Task 3.5: Add Long-Press Gesture Handler
**Priority:** High  
**Estimated Time:** 2 hours

- [ ] Install/verify `react-native-gesture-handler` is available
- [ ] Wrap message bubble in `LongPressGestureHandler` or use `onLongPress` prop
- [ ] Trigger on 500ms press duration
- [ ] Add haptic feedback on long-press trigger: `Haptics.impactAsync()`
- [ ] Store selected message in state: `selectedMessageForExplanation`
- [ ] Test on both iOS simulator and Android (if available)
- [ ] Ensure doesn't conflict with existing message press handlers

#### Task 3.6: Create Action Sheet Menu
**Priority:** High  
**Estimated Time:** 1.5 hours

- [ ] Use React Native `ActionSheetIOS` for iOS or create custom action sheet
- [ ] Show menu with options:
  - "Explain Idioms & Slang"
  - "Explain Cultural Context"
  - "Cancel"
- [ ] Disable (gray out) options when offline with note: "(Offline)"
- [ ] Handle option selection and call appropriate function
- [ ] Clear `selectedMessageForExplanation` after selection
- [ ] Test menu appearance and dismissal

#### Task 3.7: Build Explanation Bottom Sheet Modal
**Priority:** High  
**Estimated Time:** 2.5 hours

- [ ] Create new state: `explanationModalVisible`, `explanationData`, `explanationType`
- [ ] Design modal in existing Modal pattern (similar to translation settings):
  - Semi-transparent backdrop
  - Bottom sheet slides up from bottom
  - Header with title ("Idiom Explanation" or "Cultural Context")
  - Close button (X)
  - Scrollable content area
- [ ] Display loading state with skeleton/spinner while fetching
- [ ] Show explanation text with good typography (line height, padding)
- [ ] Show original message text at top for reference
- [ ] Show "No idioms/context found" message gracefully
- [ ] Add "Dismiss" button at bottom
- [ ] Handle keyboard avoiding if needed

#### Task 3.8: Implement Explanation Fetch Logic
**Priority:** High  
**Estimated Time:** 2 hours

- [ ] Create async function `handleExplainIdioms(message)`
- [ ] Create async function `handleExplainCulturalContext(message)`
- [ ] Import `httpsCallable` from Firebase
- [ ] Call appropriate Cloud Function with message text
- [ ] Handle loading state: show modal immediately with spinner
- [ ] Update modal with explanation data when received
- [ ] Log response time and cache status to console
- [ ] Handle errors with user-friendly alert
- [ ] Handle rate limit errors specifically: "Daily limit reached (50/50). Resets at midnight UTC."
- [ ] Handle offline errors: "Explanation unavailable while offline"

#### Task 3.9: Add Explanation Styling
**Priority:** Medium  
**Estimated Time:** 1 hour

- [ ] Create stylesheet section for explanation modal
- [ ] Style modal container with rounded corners, shadow
- [ ] Style explanation text with readable font size (15-16px)
- [ ] Add subtle background color for original message reference
- [ ] Add icon/emoji to explanation type header (💬 for idioms, 🌍 for cultural)
- [ ] Style loading spinner/skeleton
- [ ] Style "no results found" message
- [ ] Ensure accessibility (contrast ratios, text sizing)

---

### 3. Error Handling & Edge Cases (3 tasks)

#### Task 3.10: Implement Error Handling
**Priority:** High  
**Estimated Time:** 1 hour

- [ ] Handle network errors gracefully
- [ ] Handle rate limit errors with clear messaging
- [ ] Handle OpenAI API errors (timeout, invalid response)
- [ ] Handle empty/null explanations (show "No idioms/context found")
- [ ] Add retry capability for failed requests
- [ ] Log all errors to console with context
- [ ] Show user-friendly error messages in modal

#### Task 3.11: Handle Offline State
**Priority:** Medium  
**Estimated Time:** 45 minutes

- [ ] Check `isOnline` from `useNetworkStore` before showing action sheet
- [ ] Disable explanation options in action sheet when offline
- [ ] Show "(Offline)" label next to disabled options
- [ ] If user tries to explain while offline, show alert: "Explanation features unavailable while offline"
- [ ] Don't allow long-press menu to trigger API calls when offline
- [ ] Test offline behavior thoroughly

#### Task 3.12: Edge Case Testing
**Priority:** Medium  
**Estimated Time:** 1.5 hours

- [ ] Test with empty messages (image-only messages)
- [ ] Test with very short messages (<5 words)
- [ ] Test with very long messages (500+ chars)
- [ ] Test with emoji-only messages
- [ ] Test with mixed language messages
- [ ] Test with messages containing no idioms/slang
- [ ] Test with already-translated messages
- [ ] Test rapid consecutive long-presses
- [ ] Test during network interruption

---

### 4. Testing & Validation (3 tasks)

#### Task 3.13: Backend Function Testing
**Priority:** High  
**Estimated Time:** 1 hour

- [ ] Test `explainIdioms` with known idioms:
  - "break a leg" → should explain theater good luck wish
  - "it's raining cats and dogs" → should explain heavy rain
  - "piece of cake" → should explain something easy
  - "Hello, how are you?" → should return no idioms found
- [ ] Test `explainCulturalContext` with cultural phrases:
  - Japanese: "お疲れ様です" (workplace greeting)
  - Spanish: "¿Cómo estás?" vs "¿Qué tal?" (regional differences)
  - English: "Cheers!" (British vs American usage)
- [ ] Verify caching works (second request returns cached result)
- [ ] Verify rate limiting triggers at 50 requests
- [ ] Check Firebase logs for proper logging

#### Task 3.14: Frontend UI/UX Testing
**Priority:** High  
**Estimated Time:** 1.5 hours

- [ ] Test long-press gesture on multiple messages
- [ ] Test action sheet appearance and option selection
- [ ] Test bottom sheet modal opening/closing smoothly
- [ ] Test loading states display correctly
- [ ] Test explanation text is readable and well-formatted
- [ ] Test modal scrolling with long explanations
- [ ] Test backdrop dismissal
- [ ] Test on both iOS simulator and physical device if possible
- [ ] Verify haptic feedback works on device

#### Task 3.15: Integration Testing
**Priority:** High  
**Estimated Time:** 1 hour

- [ ] Test full flow: long-press → action sheet → fetch → display
- [ ] Test with real messages in different languages
- [ ] Test rate limiting from user perspective
- [ ] Test offline behavior across all steps
- [ ] Test error scenarios (API failure, timeout, etc.)
- [ ] Test with group chat messages
- [ ] Test with direct chat messages
- [ ] Verify no impact on existing translation features
- [ ] Test cache persistence across app restarts

---

## Success Criteria Checklist

### Functionality
- [ ] Long-press menu appears on all message bubbles
- [ ] Both idiom and cultural context explanations work
- [ ] Explanations are accurate and helpful (>90% quality)
- [ ] Response time <3 seconds for explanation requests
- [ ] Cache prevents redundant API calls
- [ ] Rate limiting active at 50 explanations/day

### User Experience
- [ ] Long-press interaction feels natural and responsive
- [ ] Action sheet is clear and easy to use
- [ ] Bottom sheet modal is visually appealing and readable
- [ ] Loading states provide clear feedback
- [ ] Error messages are user-friendly and actionable
- [ ] Offline state is handled gracefully

### Technical Quality
- [ ] Functions deployed and accessible
- [ ] Proper authentication and rate limiting
- [ ] Caching system reduces API costs
- [ ] Logging provides debugging visibility
- [ ] No memory leaks or performance issues
- [ ] Code follows existing patterns and style

---

## Implementation Notes

### Recommended Order
1. **Backend First:** Tasks 3.1-3.4 (can deploy and test independently)
2. **Core UI:** Tasks 3.5-3.7 (build interaction and display)
3. **Integration:** Tasks 3.8-3.9 (connect frontend to backend)
4. **Hardening:** Tasks 3.10-3.12 (error handling and edge cases)
5. **Validation:** Tasks 3.13-3.15 (thorough testing)

### Key Dependencies
- `firebase-functions` v2 (already installed)
- `openai` or AI SDK (already configured)
- `react-native-gesture-handler` (likely already available via Expo)
- `@react-native-community/haptics` or Expo Haptics

### Performance Targets
- Long-press recognition: <500ms
- Action sheet display: <100ms
- API response time: <3s (target <2s)
- Modal animation: smooth 60fps
- Cache retrieval: <50ms

### Cost Optimization
- Use GPT-4o-mini (not GPT-4o) for explanations
- Cache aggressively (30-day TTL)
- Rate limit to 50/day per user
- Efficient prompts to minimize tokens

---

## Total Estimated Time
**~21.5 hours** for complete Epic 3 implementation

**Breakdown:**
- Backend: ~6 hours
- Frontend: ~9 hours
- Error Handling: ~3.5 hours
- Testing: ~3.5 hours

This estimate assumes familiarity with the existing codebase and no major blockers.


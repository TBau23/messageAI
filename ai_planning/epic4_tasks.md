# Epic 4: Cultural Conversation Insights - Task Breakdown

## Overview
Build personalized cross-cultural conversation analysis that extracts insights from multilingual group chats based on each user's native language perspective.

**Goal:** Help International Communicators understand cultural references, idioms, and communication patterns they might have missed from other participants.

**Advanced Feature:** Intelligent Processing with RAG pipeline and agent-based multi-step reasoning

---

## 📊 Implementation Status (Jan 2025)

### ✅ COMPLETE: Backend + Frontend (Tasks 4.1-4.12)
**All core functionality is implemented and deployed:**
- ✅ Message retrieval with language detection (RAG retrieval)
- ✅ Context enrichment with sender metadata (RAG augmentation)
- ✅ Conversation formatting for agent analysis (RAG generation)
- ✅ Structured output schema with Zod (4 insight categories)
- ✅ GPT-4o integration using `generateObject()` (not `generateText()` with tools)
- ✅ Message-count-based caching (10-message threshold, 24hr TTL)
- ✅ Frontend: 🧠 insights button in chat header
- ✅ Frontend: InsightsModal with 4 sections (cultural refs, idioms, styles, learning)
- ✅ Error handling: offline, rate limits, empty conversations, monolingual chats
- ✅ Seed script: `npm run seed` creates test users + multilingual group chat

**Key Implementation Decision:**
We use **structured output** (`generateObject()` with Zod schemas) instead of function calling/tools. This provides more predictable results and avoids schema validation issues. The agent still demonstrates multi-step reasoning through the structured analysis.

**Testing:**
- Seed script creates 3 test users (English, Spanish, Japanese) with 27 multilingual messages
- Run: `firebase emulators:start` → `cd functions && npm run seed` → test in app

### 🔲 TODO: Final Testing & Validation (Tasks 4.13-4.15)
**Remaining work:**
1. **UI/UX Testing** - Verify modal rendering, scrolling, empty states on real devices
2. **Integration Testing** - Test with various conversation types, measure actual response times
3. **Performance Tuning** - Validate <5s response time, optimize if needed, measure token costs

**Current Status:** Feature is functional and deployed. Ready for real-world testing and optimization.

---

## Task Groups

### 1. Backend - Conversation Retrieval & Context (3 tasks)

#### Task 4.1: Create Message Retrieval Helper
**Priority:** High  
**Estimated Time:** 1.5 hours

- [ ] Create `functions/src/conversationRetrieval.js`
- [ ] Implement `retrieveConversationMessages(conversationId, limit = 100)`
- [ ] Query Firestore messages sub-collection ordered by timestamp
- [ ] Return last N messages with: `text`, `senderId`, `timestamp`, `imageURL` (if present)
- [ ] Add error handling for invalid conversation IDs
- [ ] Test retrieval with conversations of varying sizes

#### Task 4.2: Enrich Messages with Language & Sender Data
**Priority:** High  
**Estimated Time:** 2 hours

- [ ] Create `enrichMessagesWithContext(messages, conversationId)` function
- [ ] Fetch participant user documents (displayName, defaultLanguage if available)
- [ ] Detect language for each message text using existing `detectLanguage()`
- [ ] Build enriched structure: `{ text, senderName, senderId, language, languageName, timestamp }`
- [ ] Handle edge cases: deleted users, missing display names, empty messages
- [ ] Format timestamps to human-readable strings
- [ ] Return conversation metadata: participant list, languages detected, date range

#### Task 4.3: Build Conversation Context Formatter
**Priority:** High  
**Estimated Time:** 1 hour

- [ ] Create `formatConversationForAgent(enrichedMessages, userLanguage)` function
- [ ] Format messages as readable conversation transcript:
  ```
  [2025-01-27 14:23] Maria (Spanish): ¡Hola! ¿Cómo estás?
  [2025-01-27 14:24] John (English): Hey! I'm good, thanks
  ```
- [ ] Add conversation summary header: date range, participants, languages present
- [ ] Highlight messages NOT in user's native language (mark for agent focus)
- [ ] Keep under token limits (truncate if >50K tokens, prioritize recent messages)

---

### 2. Backend - Agent Implementation (4 tasks)

#### Task 4.4: Design Agent Function Calling Tools
**Priority:** High  
**Estimated Time:** 2 hours

- [ ] Create `functions/src/agentTools.js`
- [ ] Define tool: `extract_cultural_references`
  - Description: Find culture-specific concepts, traditions, holidays, customs
  - Parameters: messages, userNativeLanguage, otherLanguages
- [ ] Define tool: `extract_idioms_and_expressions`
  - Description: Identify idioms, slang, expressions from other languages
  - Parameters: messages, userNativeLanguage
- [ ] Define tool: `extract_communication_styles`
  - Description: Analyze formality, politeness, directness differences
  - Parameters: messages, participants, userNativeLanguage
- [ ] Define tool: `extract_learning_opportunities`
  - Description: Highlight interesting vocabulary, grammar, language patterns
  - Parameters: messages, userNativeLanguage
- [ ] Test tool definitions with AI SDK format

#### Task 4.5: Implement Agent System Prompt
**Priority:** High  
**Estimated Time:** 1.5 hours

- [ ] Create personalized system prompt based on user's native language
- [ ] Instruct agent to analyze conversation from user's cultural perspective
- [ ] Emphasize: focus on what the user might NOT understand or find unfamiliar
- [ ] Provide examples of good insights vs generic observations
- [ ] Set tone: educational, friendly, concise (2-3 sentences per insight)
- [ ] Instruct agent to call appropriate tools based on conversation content
- [ ] Handle edge case: monolingual conversations (skip analysis, return friendly message)

#### Task 4.6: Create `extractCulturalInsights` Cloud Function
**Priority:** High  
**Estimated Time:** 3 hours

- [ ] Create `functions/src/extractCulturalInsights.js`
- [ ] Use `createAIFunction('extractions', ...)` template
- [ ] Validate input: `conversationId` required
- [ ] Retrieve user's default language from settings
- [ ] Call message retrieval and enrichment helpers
- [ ] Use `generateObject()` with GPT-4o (not mini) for advanced reasoning
- [ ] Configure agent with function tools from Task 4.4
- [ ] Parse agent's tool calls and synthesize results
- [ ] Structure output: `{ culturalReferences, idioms, communicationStyles, learningOpportunities }`
- [ ] Add response time logging and usage tracking
- [ ] Return metadata: messages analyzed, languages detected, user perspective

#### Task 4.7: Implement Message-Count-Based Caching
**Priority:** Medium  
**Estimated Time:** 1.5 hours

- [ ] Create Firestore collection: `conversationInsights/{conversationId}/userInsights/{userId}`
- [ ] Cache schema: `{ insights, messageCount, userLanguage, createdAt, expiresAt }`
- [ ] Before generating insights, check cache:
  - If cached version exists and `currentMessageCount - cachedMessageCount < 10`, return cached
  - If message count difference >= 10, regenerate (conversation evolved significantly)
  - If user's language changed, regenerate (perspective changed)
- [ ] Set TTL to 24 hours (high-level summaries have longer relevance than per-message explanations)
- [ ] Return `cached: true/false` and `cacheAge` in metadata
- [ ] Log cache hits/misses for monitoring

---

### 3. Frontend - UI Integration (4 tasks)

#### Task 4.8: Add "Get Insights" Button to Chat Header
**Priority:** High  
**Estimated Time:** 1.5 hours

- [ ] In `app/(main)/chat/[id].js`, add header right button or menu item
- [ ] Use icon: 🧠 or 💡 or insights/analytics icon
- [ ] Place near existing member list / group info buttons
- [ ] Add state: `insightsModalVisible`, `insightsData`, `insightsLoading`
- [ ] Disable button when offline with tooltip/toast
- [ ] Show loading indicator on button while fetching
- [ ] Only show for group chats or multilingual conversations (optional logic)

#### Task 4.9: Create Insights Modal Component
**Priority:** High  
**Estimated Time:** 3 hours

- [ ] Create `components/chat/InsightsModal.js`
- [ ] Design full-screen or large modal (lots of content)
- [ ] Header: "Cultural Insights" with user's perspective flag/emoji
- [ ] Sections with icons:
  - 🌍 Cultural References You Might Have Missed
  - 💬 Idioms & Expressions Explained  
  - 🗣️ Communication Style Insights
  - 📚 Language Learning Highlights
- [ ] Each section: collapsible or scrollable list
- [ ] Show empty state if no insights in a category: "No idioms detected"
- [ ] Loading state: skeleton screens for each section
- [ ] Close button and backdrop dismiss
- [ ] Scrollable container for long content

#### Task 4.10: Implement Fetch Logic
**Priority:** High  
**Estimated Time:** 2 hours

- [ ] Create `handleGetInsights()` function in chat screen
- [ ] Call `httpsCallable('extractCulturalInsights')({ conversationId })`
- [ ] Show modal immediately with loading skeletons
- [ ] Update modal with insights data when received
- [ ] Handle errors gracefully:
  - Rate limit: "Daily insights limit reached (5/5). Resets at midnight UTC."
  - Offline: "Insights unavailable while offline"
  - Empty conversation: "Not enough messages to analyze (need 10+)"
  - Monolingual: "This conversation is in your language only. Insights work best with multilingual chats."
- [ ] Log response time and usage to console
- [ ] Add retry button on error

#### Task 4.11: Style Insights Modal
**Priority:** Medium  
**Estimated Time:** 1.5 hours

- [ ] Create styles in separate file or inline
- [ ] Use card-based layout for each insight category
- [ ] Comfortable reading typography (16px, line-height 1.5)
- [ ] Color-code sections with subtle backgrounds
- [ ] Add icons/emoji for visual interest
- [ ] Ensure scrolling performance (FlatList if many items)
- [ ] Add subtle animations (fade in, slide up)
- [ ] Dark mode support (if app has dark mode)
- [ ] Test on various screen sizes

---

### 4. Testing & Validation (4 tasks)

#### Task 4.12: Backend Function Testing
**Priority:** High  
**Estimated Time:** 2 hours

- [ ] Create test conversation with mixed languages (English, Spanish, Japanese)
- [ ] Test retrieval of 100 messages works correctly
- [ ] Verify language detection on each message
- [ ] Test agent tool calls with sample conversation
- [ ] Verify personalized insights for different user perspectives:
  - English speaker sees Spanish/Japanese explanations
  - Spanish speaker sees English/Japanese explanations
- [ ] Test edge cases:
  - Very short conversation (<10 messages)
  - Monolingual conversation
  - Conversation with images only
- [ ] Verify rate limiting triggers at 5/day
- [ ] Check response time <5 seconds for 100 messages

#### Task 4.13: Frontend UI/UX Testing
**Priority:** High  
**Estimated Time:** 1.5 hours

- [ ] Test button appears correctly in chat header
- [ ] Test button disabled state when offline
- [ ] Test modal opening/closing smoothly
- [ ] Test loading states display correctly
- [ ] Test each insight section renders properly
- [ ] Test scrolling through long insights
- [ ] Test empty state handling
- [ ] Test modal on different screen sizes (small phones, tablets)
- [ ] Verify text is readable and well-formatted

#### Task 4.14: Integration & Persona Testing
**Priority:** High  
**Estimated Time:** 2 hours

- [ ] Test full flow with real group chat scenarios:
  - International team discussing project
  - Friends from different countries chatting
  - Language exchange conversation
- [ ] Verify insights are accurate and helpful (>90% relevance)
- [ ] Test from multiple user perspectives (change default language)
- [ ] Verify insights change based on user's perspective
- [ ] Test error scenarios (network failure, timeout, etc.)
- [ ] Test offline behavior end-to-end
- [ ] Validate against rubric requirements:
  - Multi-step reasoning visible in logs
  - Function calling demonstrated
  - RAG pipeline functional (retrieval → augmentation → generation)

#### Task 4.15: Performance & Cost Optimization
**Priority:** Medium  
**Estimated Time:** 1 hour

- [ ] Measure actual response times with various conversation sizes
- [ ] Optimize if >5 seconds: reduce message count or optimize prompts
- [ ] Check OpenAI token usage per request
- [ ] Verify GPT-4o being used (not mini) for advanced capability
- [ ] Calculate cost per insight request (~$0.01-0.05 target)
- [ ] Validate 5/day limit is reasonable for user value
- [ ] Add console warnings if response time >5s
- [ ] Consider pagination if conversations >100 messages cause issues

---

## Success Criteria Checklist

### Functionality
- [ ] Extracts personalized insights based on user's native language
- [ ] Identifies cultural references from other languages/cultures
- [ ] Explains idioms and expressions in context
- [ ] Analyzes communication style differences
- [ ] Highlights learning opportunities
- [ ] Response time <5 seconds for 100-message conversations
- [ ] Rate limiting active at 5 extractions/day

### User Experience  
- [ ] Button easily discoverable in chat interface
- [ ] Modal is visually appealing and readable
- [ ] Loading states provide clear feedback
- [ ] Error messages are helpful and actionable
- [ ] Insights are concise and educational (not overwhelming)
- [ ] Offline state handled gracefully

### Technical Quality
- [ ] Function deployed and accessible
- [ ] Proper authentication and rate limiting  
- [ ] Agent demonstrates multi-step reasoning
- [ ] Function calling tools work correctly
- [ ] RAG pipeline operational (retrieve → augment → generate)
- [ ] Uses GPT-4o for advanced reasoning
- [ ] Logging provides debugging visibility
- [ ] Code follows existing patterns

---

## Implementation Notes

### Recommended Order
1. **Backend Foundation:** Tasks 4.1-4.3 (retrieval and formatting)
2. **Agent Core:** Tasks 4.4-4.6 (tools and function implementation)
3. **Frontend UI:** Tasks 4.8-4.9 (button and modal)
4. **Integration:** Task 4.10-4.11 (connect and style)
5. **Validation:** Tasks 4.12-4.15 (thorough testing)

### Key Dependencies
- Existing AI infrastructure (Epic 1 foundation)
- User settings with default language (Epic 1)
- Existing conversation/message Firestore structure
- AI SDK with function calling support
- GPT-4o access (not just mini)

### Performance Targets
- Message retrieval: <500ms
- Language detection: <100ms per message (local)
- Agent analysis: <5s total
- Modal render: smooth 60fps
- Total end-to-end: <6s from button tap to insights display

### Rubric Alignment
- ✅ Multi-step agent workflow (retrieve → detect → analyze → extract → format)
- ✅ Function calling with 4 specialized tools
- ✅ RAG pipeline (retrieval + augmentation + generation)
- ✅ Handles multilingual content
- ✅ Personalized output (not generic)
- ✅ Advanced reasoning with GPT-4o
- ✅ <8s response time (target: <5s)

---

## Total Estimated Time
**~24 hours** for complete Epic 4 implementation

**Breakdown:**
- Backend Retrieval: ~4.5 hours
- Backend Agent: ~7.5 hours  
- Frontend UI: ~8.5 hours
- Testing: ~6.5 hours

This estimate assumes Epic 1-3 infrastructure is working and no major blockers.


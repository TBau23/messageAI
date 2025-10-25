

# MessageAI: International Communicator Features
## Epic Brief

### Project Overview
Implement AI-powered translation and communication features for an International Communicator persona within an existing React Native (Expo) messaging application. The system will provide real-time translation with preview, cultural context analysis, and intelligent conversation extraction across multiple languages.

### Target Persona: International Communicator
**Core Pain Points Being Solved:**
- Language barriers in real-time communication
- Translation nuances and context loss
- Cultural misunderstandings in cross-language conversations
- Formality and tone adjustment needs

### Technology Stack

**Frontend:**
- React Native with Expo Go
- Expo Router for navigation
- Expo SQLite for local caching

**Backend:**
- Firebase Cloud Functions (Node.js)
- Firebase Firestore (existing)
- Firebase Auth (existing)
- AI SDK by Vercel for agent orchestration
- OpenAI API (GPT-4o-mini for features, GPT-4o for advanced capability)

**Supporting Services:**
- Language detection library (server-side, TBD)
- Firestore for translation caching

---

## Epic Breakdown

### **Epic 1: Foundation & Configuration**
**Goal:** Set up the AI infrastructure and development environment for all subsequent features.

**Scope:**
- Initialize Firebase Functions project (/functions directory) and deployment pipeline
- Install and configure AI SDK by Vercel in Firebase Functions
- Set up OpenAI API integration with proper key management (Firebase environment config)
- Configure authentication middleware to verify Firebase Auth tokens
- Set up CORS and function endpoint security (authenticated users only)
- Establish user settings schema for default language preferences (Firestore: users/{uid}/settings)
- Set up language detection service (server-side)
- Create base Firebase Function templates for AI operations
- Implement rate limiting foundations (per-user quotas in Firestore)
- Implement error handling foundations and request logging
- Set up development/testing environment with API call logging

**Success Criteria:**
- Can successfully call OpenAI API from authenticated Firebase Function
- AI SDK properly integrated with function calling capability
- User language preferences stored and retrievable from Firestore
- Language detection working server-side with <100ms response time
- Rate limiting active (100 translations/day, 50 explanations/day, 5 extractions/day)
- API keys never exposed to React Native app (server-side only)

**Technical Decisions:**
- Use GPT-4o-mini as default model (cost/performance balance)
- Implement response caching in Firestore for common translations
- Store API keys exclusively in Firebase Functions environment configuration
- Use AI SDK's streaming capabilities for longer operations
- All AI calls proxied through authenticated Firebase Functions (security requirement)

---

### **Epic 2: Core Translation Infrastructure**
**Goal:** Build the foundational translation system that supports both outbound (composing) and inbound (receiving) message translation.

**Scope:**
- Create `transformOutboundMessage` Firebase Function with combined translation + tone adjustment
- Implement debounced preview system in React Native (1s pause trigger, integrates with existing compose area)
- Build compose area UI with translation toggle and language selector (extends app/(main)/chat/[id].js)
- Add formality/tone selector to compose UI (modal or keyboard accessory)
- Create translation preview display in compose area (below TextInput)
- Implement streaming support for translation preview (AI SDK streaming)
- Implement server-side language detection on message receive
- Add automatic "Translate" button display for non-native language messages
- Build translation caching system in Firestore (schema: translations collection with TTL)
- Implement optimistic UI updates for translated messages
- Add offline handling (disable translation when offline, cache translated messages in SQLite)

**Features Implemented:**
- Feature #1: Real-time translation (inline) - with preview
- Feature #2: Language detection & auto-translate
- Feature #4: Formality level adjustment

**Success Criteria:**
- User can enable translation, type message, see preview within 2s of pausing
- Preview updates correctly if user continues typing (streaming responses)
- Translation + tone adjustment can be combined in single API call
- Inbound messages auto-detect language and show translate button when needed
- Translations cached to avoid redundant API calls
- <2 second response time for translation requests
- Graceful offline degradation (clear UI feedback when unavailable)

**Technical Components:**
- Debounce logic in React Native with typing indicator integration
- Combined prompt engineering for translation + tone in single request
- Language pair handling (auto-detect source, user selects target)
- Translation state management in message documents
- Firestore cache schema: translations/{hash} with sourceText, targetText, sourceLang, targetLang, formality, TTL
- SQLite cache extension for received translated messages

---

### **Epic 3: Cultural Intelligence Features**
**Goal:** Add contextual understanding features that explain idioms, slang, and cultural nuances.

**Scope:**
- Implement long-press menu system on message bubbles (extends existing message press handlers)
- Create `explainIdioms` Firebase Function for slang/idiom explanations
- Create `explainCulturalContext` Firebase Function for cultural hints
- Build result display UI (modal/bottom sheet) for explanations
- Implement smart detection of when no idioms/context exist (graceful handling)
- Add prompt engineering to differentiate between linguistic vs. cultural explanations
- Create caching for common idiom/cultural explanations (Firestore: explanations collection with TTL)
- Add loading states with skeleton loaders during explanation fetch

**Features Implemented:**
- Feature #3: Cultural context hints
- Feature #5: Slang/idiom explanations

**Success Criteria:**
- Long-press menu appears on any message bubble
- Idiom explanations focus on literal vs. figurative meaning
- Cultural context explains why/how phrases are used in that culture
- Functions return null/empty gracefully when no idioms or context detected
- <3 second response time for explanation requests
- Explanations are clear, concise, and helpful for target audience
- Clear error messages when offline or rate limit hit

**Technical Components:**
- Long-press gesture handler in React Native (integrates with existing message component)
- Action sheet/bottom sheet component for explanation display
- Separate system prompts for idiom vs. cultural analysis
- Smart prompt engineering to handle "no idioms found" scenario
- Firestore cache schema: explanations/{hash} with messageText, type, explanation, TTL (30 days)

---

### **Epic 4: Advanced Capability - Intelligent Processing**
**Goal:** Build conversation analysis system that extracts structured data from multilingual chat history using agent-based multi-step reasoning.

**Scope:**
- Design structured extraction types (action items, decisions, meeting details, key info)
- Create `extractIntelligentData` Firebase Function with GPT-4o and agent framework
- Implement conversation history retrieval from Firestore (last 50-100 messages)
- Define function calling tools for agent: `extract_action_items`, `extract_meeting_details`, `extract_decisions`
- Build prompt engineering for multilingual conversation understanding
- Implement multi-step agent workflow: analyze → decide tools → extract → validate → format
- Implement JSON structured output parsing with schema validation
- Create UI for triggering extraction (chat header menu button)
- Design result display with formatted structured data (action list, meeting cards, decision timeline)
- Implement **RAG pipeline**: retrieval (Firestore messages) → augmentation (format with metadata) → generation (structured extraction)

**Advanced Feature:**
- Option B: Intelligent Processing - Extract structured data from multilingual conversations

**Success Criteria:**
- Can accurately extract action items from 50+ message conversation
- Works across multiple languages in same conversation (agent detects language mix)
- Returns clean JSON with structured data (dates, assignees, decisions, etc.)
- <5 second response time for extraction
- Results displayed in user-friendly format (not raw JSON)
- Demonstrates agent-like behavior with multi-step reasoning (visible tool calls)
- Successfully implements function calling/tool use (required by rubric)
- RAG pipeline operational: retrieves conversation context and generates from it

**Technical Components:**
- Message retrieval with pagination from Firestore (RAG retrieval step)
- Conversation formatting for LLM context with speaker names, timestamps, languages (RAG augmentation)
- Structured output schema definition for each extraction type
- Function calling tools with clear descriptions and parameter schemas
- Agent orchestration: language analysis → tool selection → parallel extraction → result synthesis
- Response parsing and validation with error recovery
- UI for displaying extracted entities (action items as list, meetings as cards, decisions as timeline)

---

### **Epic 5: Performance Optimization & Polish**
**Goal:** Ensure all features meet performance targets and provide excellent user experience.

**Scope:**
- Implement comprehensive caching strategy for translations and explanations (Firestore with TTLs)
- Add loading states and progress indicators for all AI operations (spinners, skeleton screens)
- Optimize API calls (batch when possible, cancel stale requests on re-type)
- Test and tune debounce timing for translation preview (optimize 1s default)
- Implement error handling and retry logic for failed AI requests
- Add offline handling strategy:
  - Disable AI features gracefully when offline (clear UI feedback)
  - Cache translated messages in SQLite for offline viewing
  - Queue pending AI requests (pending_ai_requests table)
  - Process queued requests on reconnect
- Performance testing: measure response times under load
- UX polish: smooth animations, clear status indicators, professional design
- Add user feedback mechanisms (thumbs up/down on translations)
- Implement usage analytics for AI features
- Add quota display in settings (remaining daily limits)

**Success Criteria:**
- All translation operations <2s response time
- Cultural/idiom explanations <3s response time
- Intelligent extraction <5s response time
- Zero UI blocking during AI operations
- Graceful error messages and recovery (rate limits, network errors, API failures)
- Smooth animations and transitions
- Clear visual feedback for all AI operations in progress
- Offline-first architecture maintained (core messaging works, AI degrades gracefully)

**Technical Components:**
- Firestore-based caching layer with TTL management
- Request cancellation for stale operations (debounce cleanup)
- Optimistic UI patterns throughout
- Error boundary implementation
- Loading skeleton screens and progress indicators
- SQLite schema extension for offline AI data caching
- Network status integration with existing useNetworkStore

---

### **Epic 6: Testing & Refinement**
**Goal:** Validate all features against rubric requirements and ensure production quality.

**Scope:**
- Test all 5 required features thoroughly across supported languages
- Validate advanced feature with complex conversation scenarios (50+ messages, mixed languages)
- Test edge cases:
  - Empty messages, very long messages (1000+ chars), emoji-only messages
  - Mixed languages in single message
  - Rare languages, informal slang, cultural references
  - Network interruptions during AI operations
  - Rate limit scenarios
- Verify prompt engineering produces high-quality, relevant results (>90% accuracy target)
- Test specific persona scenarios:
  - English→Spanish formal business conversation
  - English→Japanese casual conversation
  - Explain idioms: "break a leg", "it's raining cats and dogs"
  - Extract action items from multilingual team meeting
- Test performance under poor network conditions
- Validate caching is working correctly (measure cache hit rates)
- Test on physical devices (not just simulator)
- Gather feedback and iterate on prompts
- Document supported languages and limitations
- Prepare demo scenarios showcasing all features for rubric evaluation

**Success Criteria:**
- All features work reliably in demo scenarios
- Response times consistently meet targets (<2s, <3s, <5s)
- Prompt outputs are accurate and helpful (>90% command accuracy)
- Edge cases handled gracefully with clear error messages
- Ready for rubric evaluation with documented test results

---

## Supported Languages (Initial Set)
- English (en)
- Spanish (es)
- French (fr)
- Mandarin Chinese (zh)
- Japanese (ja)

Can expand to Arabic (ar) if time permits for RTL testing.

---

## Key Technical Decisions Summary

1. **Security architecture** - All OpenAI API keys stored exclusively in Firebase Functions environment config, never exposed to React Native app. All AI calls proxied through authenticated Firebase Functions.
2. **No vector database initially** - Use direct LLM calls with conversation retrieval from Firestore (satisfies RAG via retrieval + augmentation + generation pattern)
3. **Preview on pause** - Debounced translation preview after 1s typing pause with streaming support
4. **Combined prompts** - Single API call when translation + tone both needed (efficiency optimization)
5. **Server-side language detection** - Fast, non-blocking detection triggers translate button
6. **Caching strategy** - Store common translations (7-day TTL) and explanations (30-day TTL) in Firestore collections
7. **GPT-4o-mini default** - Use GPT-4o only for advanced extraction feature (cost optimization)
8. **Optimistic UI** - Show immediate feedback, update when AI responds (matches existing offline-first architecture)
9. **Function calling/tools** - Agent-based extraction uses defined tools for multi-step reasoning (rubric requirement)
10. **Rate limiting** - Per-user daily quotas stored in Firestore (100 translations, 50 explanations, 5 extractions)
11. **Offline degradation** - AI features disabled when offline with clear feedback; cached translations remain viewable

---

## Success Metrics (Rubric Alignment)

**Required AI Features (15 points) - Target: 14-15/15:**
- All 5 features implemented and functional
- Fast response times (<2s for simple operations) with streaming support
- Natural language understanding >90% accuracy (tested across language pairs)
- Clean UI integration (extends existing chat interface)
- Clear loading states and error handling

**Persona Fit & Relevance (5 points) - Target: 5/5:**
- All features directly address International Communicator pain points
- Translation solves language barriers
- Cultural/idiom features solve context loss
- Formality adjustment solves tone needs
- Intelligent extraction solves multilingual conversation tracking

**Advanced Feature (10 points) - Target: 9-10/10:**
- Intelligent processing fully functional with agent framework
- Handles multilingual conversations (tested with 3+ language mix)
- Structured output with clear presentation (formatted UI, not raw JSON)
- Demonstrates agent capabilities with multi-step reasoning and function calling
- <5s response time (better than rubric's <8s target)

**Technical Implementation - Architecture (5 points) - Target: 5/5:**
- Clean, well-organized code extending existing architecture
- API keys secured (never exposed to mobile app, server-side only)
- Function calling/tool use implemented correctly (agent tools defined)
- RAG pipeline implemented (retrieval → augmentation → generation)
- Rate limiting implemented (per-user quotas in Firestore)
- Response streaming for long operations (translation preview, extraction)

**Performance targets:**
- Translation preview: <2s (with streaming)
- Idiom/cultural explanations: <3s
- Intelligent extraction: <5s (multi-step agent workflow)

---

This epic structure allows for incremental development where each epic builds on the previous one, while maintaining clear boundaries and testable success criteria. Each epic can be broken down into individual tasks/tickets during implementation planning.

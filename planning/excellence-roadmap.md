# MessageAI Current State & Excellence Plan

## Current Architecture Snapshot
- **Client**: Expo Router structure with `(auth)` and `(main)` stacks, Zustand stores for auth, chat, notifications, and shared UI components (`app/(main)/chat/[id].js`, `store/`).
- **Data layer**: Firebase Auth + Firestore with conversational data stored under `conversations/{id}/messages`, lightweight real-time listeners in `store/chatStore.js:138-154`.
- **Presence & lifecycle**: AppState hook toggles `online` flag on the `users` document (`app/_layout.js`, `store/authStore.js:112-127`).
- **Notifications**: In-app banner fed by chat store diffing (no Expo Notifications integration yet) (`store/chatStore.js:104-132`, `components/MessageNotification.js`).
- **Offline handling**: Relies on Firestore mobile persistence and a network status banner (`utils/networkMonitor.js`, `components/NetworkBanner.js`), no local SQLite cache.

## Rubric Assessment & Gaps

### 1. Core Messaging Infrastructure
- **Real-time delivery**: Firestore listeners provide near-real-time updates, but there is no latency monitoring, typing indicators, or delivery acknowledgements. `deliveredTo` never updates after send, so double-check states never flip (`store/chatStore.js:255-288`). Optimistic error handling compares against a fresh timestamp and never flags failed messages (`store/chatStore.js:284-288`).
- **Offline support & persistence**: Firestore queuing covers basic offline sends, yet the UI never distinguishes queued vs synced messages and there is no retry surface. Network banner lacks granular connection states such as exponential backoff visibility.
- **Group chat**: Group creation works, but participant metadata is fetched once per screen load with `getDoc` calls and no subscription (`app/(main)/chat/[id].js:43-68`), so presence/read info drifts. There is no group management (add/remove), typing indicators, or read-receipt drill downs.

### 2. Mobile App Quality
- **Lifecycle handling**: AppState hook updates presence, but there is no reconnection telemetry, no re-subscribe guard, and Firebase listeners keep running when backgrounded, risking stale reads if auth token expires. Push notifications (background/terminated) are absent.
- **Performance & UX**: UI mimics WhatsApp styling and uses `FlatList`, yet there is no message list virtualization strategy for thousands of rows, no keyboard-safe transitions on Android, and no image/media pipeline. Navigation stack resets on sign-out but lacks skeleton loaders and haptic/animation polish.

### 3. AI Features Implementation
- **Persona features**: None of the required International Communicator features (real-time translation, auto detection, cultural hints, formality adjustments, slang explanations) exist yet.
- **Advanced capability**: No agent framework or smart replies implemented; there is no LLM integration, RAG storage, or preference management.

### 4. Technical Implementation
- **Architecture**: Codebase is clean but client-heavy. There is no edge/cloud logic for message fan-out, translation caching, or rate limiting. API keys are exposed via Expo public env vars (expected for Firebase) but there’s no secure channel for LLM credentials.
- **Authentication & data management**: Auth flow is functional, yet there is no session hardening (re-auth, MFA hooks) and no local database despite the rubric’s “Excellent” requirement. `searchUsers` scans the entire `users` collection client-side (`store/chatStore.js:319-334`), which will not scale.

### 5. Documentation & Deployment
- README is thorough about setup but lacks architecture diagrams, performance expectations, and AI configuration guidance. There is no deployment pipeline, TestFlight/APK build, or environment matrix for the agent services.

## Additional Findings
- Presence indicators in chats rely on static snapshots; real-time status never refreshes without reopening the screen (`app/(main)/chat/[id].js:43-68`).
- Unused import: `AsyncStorage` in `store/authStore.js:2` (Firebase Auth persistence already configured elsewhere).
- `App.js` is a Firebase test harness that diverges from the Expo Router entry (`App.js` vs `expo-router/entry`), which can confuse onboarding.
- No automated tests, logging, or analytics hooks are in place; debugging relies solely on console output.

## Open Questions
- Preferred LLM provider(s) and budget for translation/agent features? (Impacts SDK choice, edge caching, cost controls.)
- Do we need true push notifications (APNS/FCM) or is high-quality in-app notification sufficient for “Excellent”?
- Target platforms for deployment excellence (TestFlight, internal Android track, Expo EAS builds)?
- Any compliance requirements (PII retention, audit logging) that should shape data retention and AI feature scope?

## Roadmap to “Excellent”

### Phase 1 – Messaging Hardening
- Fix optimistic update bug, implement delivery acknowledgements, and ensure `deliveredTo`/`readBy` updates on receipt (`store/chatStore.js`).
- Add typing indicators, message retry states, and latency instrumentation.
- Replace one-off `getDoc` presence lookups with real-time subscriptions and introduction of a presence/typing sub-collection.

### Phase 2 – Offline & Mobile Experience
- Introduce local cache (Expo SQLite) for conversations/messages with delta sync strategy.
- Provide clear pending/failed message UI, connection banners, and background reconnection handling.
- Optimize large thread performance (pagination, inverted lists, windowing) and polish UI (animations, keyboard handling, message status drill-down).
- Implement real push notifications using `expo-notifications`, Expo services or direct FCM/APNS setup.

### Phase 3 – AI Platform Foundation
- Stand up secure AI service layer (serverless functions or edge worker) handling translation, language detection, cultural context prompts, formality toggles, and slang explanations with caching/RAG.
- Model conversation embeddings + vector store for context retrieval; store user preferences for tone and language.
- Add rate limiting, error telemetry, and fallback prompts; expose configuration in README.

### Phase 4 – AI Experience Delivery
- Embed inline translation/detection pipeline in composer and message bubbles with opt-in/out controls.
- Provide cultural/formality hints via contextual UI (long-press actions, suggestion chips).
- Implement chosen advanced capability (e.g., context-aware smart replies with learning loop) and ensure response times stay within rubric targets.
- Craft dedicated AI assistant view if hybrid approach desired, with conversation history queries.

### Phase 5 – Documentation, Deployment, QA
- Produce architecture diagrams, data flow docs, and AI configuration guide; update README + planning docs.
- Set up EAS build workflows (TestFlight/Internal App Sharing), release checklist, crash/error monitoring.
- Expand automated test coverage (unit, integration, end-to-end) and performance monitoring dashboards.

## Immediate Next Steps
- Confirm AI provider and deployment targets.
- Prioritize Phase 1 tickets and schedule profiling/offline test sessions.
- Align on success metrics (latency, offline sync time, AI accuracy) to track progress toward the rubric’s “Excellent” bar.


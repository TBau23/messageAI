# Phase 1 – Messaging Hardening (Implementation Plan)

## Goals
- Eliminate delivery/read state bugs so checkmarks reflect real status in direct and group chats.
- Improve real-time presence fidelity (online/typing) across conversations.
- Strengthen optimistic sends and message state UI for reliability in poor networks.

## Workstreams & Key Tasks

### 1. Delivery & Read Status Accuracy
- Fix optimistic send error handling (`store/chatStore.js`) so temp messages map correctly and expose failed state.
- Persist `localId` or temp metadata to reconcile server responses without race conditions.
- Update message write pipeline to append `deliveredTo` on listener receipt for non-senders; ensure `markMessagesAsRead` is triggered from listeners as well as UI.
- Add UI states for `sending`, `sent`, `delivered`, `read`, and `failed` in `app/(main)/chat/[id].js`.

### 2. Presence & Typing Signals
- Replace one-off `getDoc` fetches with real-time subscriptions to `users` presence data per chat participant.
- Introduce typing indicators: Firestore subcollection (e.g., `conversations/{id}/typingStatus`) updated on input change with debounced writes, subscribed in chat view.
- Extend chat header to surface precise status (online/offline, last seen, typing) for direct chats and aggregate online counts for groups.

### 3. Conversation Sync & Latency
- Instrument timestamps around send/receipt to capture delivery latency (store in message metadata for future analytics UI).
- Guard `subscribeToConversations`/`subscribeToMessages` so re-subscribes on reconnect don’t duplicate listeners; clean up on background/foreground transitions.
- Add message pagination/windowing prep: structure Firestore queries to support `limit` + `startAfter`, even if full paging lands in Phase 2.

### 4. Messaging UX Polish
- Display pending/failed banners or retry affordances in chat when messages fail.
- Provide toast/snackbar feedback on retries or online state changes (leveraging existing `NetworkBanner` cues).
- Harmonize loading skeletons/spinners for conversation list and chat screen when listeners hydrate.

## Dependencies & Sequencing
1. Start with optimistic send and delivery state fixes (Workstream 1) to stabilize baseline.
2. Layer in presence/typing subscriptions (Workstream 2) once message status data is trustworthy.
3. Address listener lifecycle + latency instrumentation (Workstream 3) after presence changes to avoid regressions.
4. Finish with UI polish items (Workstream 4) to surface the improved states to users.

> Note: Testing automation is intentionally out of scope per product direction; rely on manual verification after each workstream.

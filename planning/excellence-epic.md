# Excellence Epic: Non-AI Features
## Goal: Achieve "Excellent" scores on all non-AI rubric items

---

## PHASE 1: Offline-First Architecture (Critical - 12 points at stake)
**Rubric Target**: Offline Support & Persistence (12/12 points)

### 1.1 Local Database Implementation
- [ ] Add Expo SQLite for local message persistence
- [ ] Create schema: messages, conversations, users, pending_messages tables
- [ ] Implement sync layer between SQLite ↔ Firestore
- [ ] Messages persist locally first, then sync to Firestore

### 1.2 Offline Message Queuing
- [ ] Queue messages locally when offline (status: 'queued')
- [ ] Auto-send queued messages when connection restored
- [ ] Handle failed message retry logic
- [ ] Show clear UI indicators for queued messages

### 1.3 Reconnection & Sync
- [ ] Implement conflict resolution for offline edits
- [ ] Sub-1 second sync time after reconnection
- [ ] Fetch missed messages on reconnect (delta sync)
- [ ] Update read receipts for messages received while offline

**Testing Scenarios**:
- Send 5 messages offline → go online → all deliver
- Force quit mid-conversation → reopen → history intact
- 30s network drop → auto-reconnect with full sync

---

## PHASE 2: Push Notifications (Critical - 8 points at stake)
**Rubric Target**: Mobile Lifecycle Handling (8/8 points)

### 2.1 Firebase Cloud Messaging Setup
- [ ] Configure FCM for push notifications
- [ ] Add expo-notifications token registration
- [ ] Store FCM tokens in Firestore user documents

### 2.2 Notification Triggers
- [ ] Send push notification when message arrives (user offline/backgrounded)
- [ ] Include sender name, message preview, conversation ID
- [ ] Handle notification tap → deep link to chat

### 2.3 Notification Management
- [ ] Suppress notifications for active conversation
- [ ] Badge count for unread messages
- [ ] Group notifications by conversation
- [ ] Notification sound/vibration

**Testing**:
- App backgrounded → receive message → push notification appears
- Tap notification → opens correct chat
- Kill app → receive message → notification works

---

## PHASE 3: Media Support & Profile Photos (Critical - 12 points at stake)
**Rubric Target**: Performance & UX (12/12) + Auth & Data (5/5)

### 3.1 Image Messaging
- [ ] Firebase Storage setup for media
- [ ] Image picker integration (camera + library)
- [ ] Upload images to Storage, store URLs in Firestore
- [ ] Progressive image loading with placeholders
- [ ] Image compression before upload (reduce bandwidth)
- [ ] Full-screen image viewer (tap to expand)

### 3.2 Profile Photos
- [ ] Add profile photo upload during profile setup
- [ ] Store photo URLs in user documents
- [ ] Display profile photos in chat list & chat headers
- [ ] Fallback to initials if no photo
- [ ] Photo caching for performance

### 3.3 Media Gallery
- [ ] View all shared media in conversation
- [ ] Media grid view (photos/videos)
- [ ] Download/share media

---

## PHASE 4: Performance Optimization (Important - 12 points at stake)
**Rubric Target**: Performance & UX (12/12 points)

### 4.1 Message Virtualization
- [ ] Implement FlatList virtualization for 1000+ messages
- [ ] Pagination: Load last 50 messages, fetch more on scroll up
- [ ] Smooth 60 FPS scrolling with large message lists
- [ ] Optimize re-renders (React.memo, useMemo, useCallback)

### 4.2 App Launch Optimization
- [ ] Launch to chat screen <2 seconds
- [ ] Lazy load conversation list data
- [ ] Cache user data locally (reduce Firestore reads)
- [ ] Optimize auth initialization

### 4.3 Network Performance
- [ ] Measure message delivery latency (target <200ms)
- [ ] Optimize Firestore queries (composite indexes)
- [ ] Reduce listener re-subscriptions
- [ ] Batch Firestore writes where possible

**Performance Tests**:
- 20+ rapid messages → zero visible lag
- Scroll through 1000+ messages → smooth 60 FPS
- Cold app launch → <2 seconds to chat list

---

## PHASE 5: Production Security & Rules (Critical - 5 points at stake)
**Rubric Target**: Architecture (5/5 points)

### 5.1 Firestore Security Rules
- [ ] Remove development rules (expire Nov 19)
- [ ] Require authentication for all operations
- [ ] Users can only read/write own user document
- [ ] Conversation access: only participants
- [ ] Message creation: only conversation participants
- [ ] Read receipts: only receiving user can update
- [ ] Deploy rules to Firebase

### 5.2 Storage Security Rules
- [ ] Authenticated users only can upload
- [ ] File size limits (max 10MB)
- [ ] Allowed file types (images only initially)

### 5.3 Rate Limiting & Abuse Prevention
- [ ] Client-side rate limiting (max 10 messages/second)
- [ ] Firestore usage monitoring
- [ ] Consider Firebase App Check for bot prevention

---

## PHASE 6: Documentation & Deployment (Important - 5 points at stake)
**Rubric Target**: Documentation & Deployment (5/5 points)

### 6.1 Comprehensive README
- [ ] Project overview and features
- [ ] Tech stack documentation
- [ ] Prerequisites (Node, Expo, Firebase account)
- [ ] Step-by-step setup instructions
- [ ] Environment variable configuration (.env template)
- [ ] Firebase project setup guide
- [ ] Firestore rules deployment instructions
- [ ] Common troubleshooting issues

### 6.2 Architecture Documentation
- [ ] Add diagrams to ARCHITECTURE.md (data flow, auth flow)
- [ ] Document message lifecycle
- [ ] Offline sync strategy diagram
- [ ] Security model overview

### 6.3 Code Documentation
- [ ] Add JSDoc comments to key functions
- [ ] Document complex algorithms (message ordering, sync logic)
- [ ] Inline comments for non-obvious code

### 6.4 Deployment
- [ ] Test on real iOS/Android devices
- [ ] Deploy via Expo Go (working QR code)
- [ ] Optional: Build standalone APK/TestFlight build
- [ ] Create deployment checklist

---

## PHASE 7: Polish & Bonus Points (+6 points potential)
**Rubric Target**: Bonus Points (Innovation, Polish, Advanced Features)

### 7.1 UI Polish (+3 points)
- [ ] Dark mode support (system theme detection)
- [ ] Message animations (slide in, fade)
- [ ] Loading skeletons (chat list, messages)
- [ ] Pull-to-refresh on chat list
- [ ] Smooth keyboard transitions
- [ ] Haptic feedback on interactions

### 7.2 Advanced Features (+2 points)
- [ ] Message reactions (👍 ❤️ 😂 🔥)
- [ ] Rich link previews (unfurl URLs with metadata)
- [ ] Message search within conversations
- [ ] Voice message recording (bonus)

### 7.3 Accessibility
- [ ] VoiceOver/TalkBack support
- [ ] Dynamic text sizing
- [ ] High contrast mode
- [ ] Screen reader labels

---

## PRIORITY RANKING

### 🔴 Critical (Must Have for Excellent)
1. **Offline Message Queuing** (PHASE 1) - 12 pts
2. **Push Notifications** (PHASE 2) - 8 pts
3. **Production Security Rules** (PHASE 5) - 5 pts
4. **Message Virtualization** (PHASE 4.1) - 12 pts
5. **Documentation** (PHASE 6) - 5 pts

### 🟡 Important (Needed for Excellent)
6. **Image Support** (PHASE 3.1) - 12 pts
7. **Profile Photos** (PHASE 3.2) - 5 pts
8. **Performance Optimization** (PHASE 4.2-4.3) - 12 pts

### 🟢 Nice to Have (Bonus Points)
9. **Dark Mode** (PHASE 7.1) - +3 pts
10. **Message Reactions** (PHASE 7.2) - +2 pts
11. **Link Previews** (PHASE 7.2) - bonus polish

---

## ESTIMATED EFFORT

| Phase | Priority | Days | Points at Stake |
|-------|----------|------|-----------------|
| PHASE 1: Offline-First | 🔴 Critical | 2.5 | 12 pts |
| PHASE 2: Push Notifications | 🔴 Critical | 1.5 | 8 pts |
| PHASE 3: Media & Photos | 🟡 Important | 2.0 | 17 pts |
| PHASE 4: Performance | 🔴 Critical | 1.5 | 12 pts |
| PHASE 5: Security | 🔴 Critical | 0.5 | 5 pts |
| PHASE 6: Documentation | 🔴 Critical | 1.0 | 5 pts |
| PHASE 7: Polish | 🟢 Bonus | 1.0 | +6 pts |
| **TOTAL** | | **10 days** | **59 + 6 bonus** |

---

## SUCCESS METRICS

### Core Messaging (35/35 points)
- [ ] Message delivery <200ms on good network
- [ ] Zero lag during 20+ rapid messages
- [ ] All 5 offline scenarios pass tests
- [ ] Group chat smooth with 5+ active users

### Mobile App Quality (20/20 points)
- [ ] Push notifications working when app closed
- [ ] App launch <2 seconds
- [ ] 60 FPS scrolling through 1000+ messages
- [ ] Images load progressively

### Technical Implementation (10/10 points)
- [ ] Production security rules deployed
- [ ] Local SQLite database working
- [ ] Profile photos implemented
- [ ] Data sync handles conflicts

### Documentation (5/5 points)
- [ ] README with step-by-step setup
- [ ] Architecture diagrams
- [ ] Code well-commented
- [ ] Deployed to Expo Go

### Bonus (+6 points)
- [ ] Dark mode working
- [ ] Message reactions
- [ ] Link previews

---

## NOTES

- **Local Database is Critical**: Without SQLite, you can't achieve "Excellent" in offline support or data management sections
- **Push Notifications are Required**: Foreground notifications alone won't get excellent scores
- **Performance Testing**: Must test with 1000+ messages to verify virtualization
- **Security Rules**: Development rules expire Nov 19 - must implement production rules
- **Real Device Testing**: Emulators don't accurately test lifecycle, notifications, or performance

**Total Points Available (Non-AI)**: 70 base + 10 bonus = 80 points
**Current Implementation**: ~40 points (estimated)
**This Epic**: +30 points + 6 bonus = **76/80 points (Excellent tier)**


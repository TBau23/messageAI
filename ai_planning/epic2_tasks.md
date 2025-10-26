# Epic 2: Core Translation Infrastructure - Task List

**Goal:** Implement real-time translation with preview, language detection, and formality adjustment

**Features Delivered:**
- Feature #1: Real-time translation (inline) with preview
- Feature #2: Language detection & auto-translate
- Feature #4: Formality level adjustment

**Progress:** 9/12 tasks complete

---

## Task 1: Create Translation Firebase Function ✅ COMPLETE

**Goal:** Build the core translation function with formality adjustment

**Steps:**
1. Create `functions/src/translate.js`:
   - Use `createAIFunction` template with 'translations' rate limit
   - Accept: `{ text, targetLanguage, formality }` (formality: 'casual' | 'formal' | 'neutral')
   - Combine translation + tone adjustment in single prompt
   - Return: `{ translatedText, detectedSourceLanguage }`
2. Use language detection to auto-detect source language
3. Build prompt that handles both translation and formality adjustment
4. Add validation: max 5000 characters
5. Export function in `functions/index.js`

**Test:** Call from profile screen test button with sample text

**Deliverable:** Working `translateText` function in emulator

---

## Task 2: Translation Caching System ✅ COMPLETE

**Goal:** Cache translations in Firestore to avoid redundant API calls

**Steps:**
1. Create cache key: hash of `sourceText + targetLanguage + formality`
2. In `translate.js`, check cache before calling OpenAI:
   ```js
   const cacheKey = createCacheKey(text, targetLang, formality);
   const cached = await getCachedTranslation(cacheKey);
   if (cached) return cached;
   ```
3. After successful translation, store in Firestore:
   - Collection: `translationCache/{cacheKey}`
   - Fields: `sourceText`, `translatedText`, `sourceLang`, `targetLang`, `formality`, `createdAt`
   - TTL: 7 days (manual cleanup or Cloud Function scheduled delete)
4. Add helper functions: `getCachedTranslation()`, `setCachedTranslation()`

**Test:** Translate same text twice, verify second call is instant (check logs for cache hit)

**Deliverable:** Translation caching working with measurable speedup

---

## Task 3: Compose UI - Translation Toggle & Language Selector ✅ COMPLETE

**Goal:** Add UI controls to enable translation in compose area

**Steps:**
1. In `app/(main)/chat/[id].js`, add state:
   ```js
   const [translationEnabled, setTranslationEnabled] = useState(false);
   const [targetLanguage, setTargetLanguage] = useState('es');
   const [formality, setFormality] = useState('neutral');
   ```
2. Add translation toggle button next to send button (icon: 🌐)
3. When enabled, show language selector modal with:
   - Language picker: en, es, fr, zh, ja, ar
   - Formality selector: Casual / Neutral / Formal
4. Style to match existing compose area design
5. Only show when translation is enabled

**Test:** Toggle translation on/off, select different languages and formality levels

**Deliverable:** Translation controls integrated into compose area

---

## Task 4: Debounced Translation Preview ✅ COMPLETE

**Goal:** Show translation preview after user pauses typing

**Steps:**
1. Add state for preview:
   ```js
   const [translationPreview, setTranslationPreview] = useState(null);
   const [isTranslating, setIsTranslating] = useState(false);
   ```
2. Create debounced function (1000ms delay) that:
   - Triggers when user stops typing
   - Calls `translateText` function
   - Updates preview state
3. Cancel pending translation if user continues typing
4. Display preview below TextInput (light gray background, smaller text)
5. Show loading indicator while translating
6. Handle errors gracefully (show error message, allow retry)

**Implementation hint:**
```js
const debouncedTranslate = useCallback(
  debounce(async (text) => {
    if (!text.trim() || !translationEnabled) return;
    setIsTranslating(true);
    try {
      const result = await translateText({ text, targetLanguage, formality });
      setTranslationPreview(result.translatedText);
    } catch (error) {
      console.error('Translation preview failed:', error);
    } finally {
      setIsTranslating(false);
    }
  }, 1000),
  [translationEnabled, targetLanguage, formality]
);
```

**Test:** 
- Type message, wait 1s, see preview
- Continue typing, preview should update
- Verify <2s response time

**Deliverable:** Real-time translation preview working with debounce

---

## Task 5: Send Translated Message ✅ COMPLETE

**Goal:** When translation enabled, send the translated version

**Steps:**
1. Modify `handleSendMessage` in chat screen:
   - If translation enabled and preview exists, send preview text
   - Store original text in message metadata (optional, for reference)
   - Clear preview after sending
2. Maintain existing optimistic UI behavior
3. Reset translation toggle after send (or keep enabled based on UX preference)

**Implementation Notes:**
- Modified `handleSend()` to check if translation is enabled and preview exists
- Sends `translationPreview` text instead of original `inputText` when translation active
- Clears all translation state (preview, error, isTranslating) after sending
- Clears pending translation timeout to prevent race conditions
- Keeps translation toggle enabled for next message (better UX for continued conversation)
- Added cleanup for translation timeout in component unmount

**Test:** Enable translation, type message, wait for preview, send - verify translated text appears in chat

**Deliverable:** Translated messages send successfully

---

## Task 6: Language Detection for Received Messages ✅ COMPLETE

**Goal:** Auto-detect language of incoming messages and show "Translate" button

**Steps:**
1. Create `detectMessageLanguage` Firebase Function:
   - Use `languageDetect.js` helper
   - Accept: `{ text }`
   - Return: `{ language, languageName, confidence }`
   - No rate limiting (quick operation)
2. In chat screen, when new message received:
   - Detect language client-side or call function
   - Compare to user's preferred language (from settings or default 'en')
   - If different, show "Translate" button on message bubble
3. Store detected language in message state

**Implementation Notes:**
- Created `functions/src/detectLanguage.js` with `detectMessageLanguage` function
- Uses franc-min library for fast client-side-like detection (server-side)
- Added state management for `messageLanguages` (messageId → language code)
- Added `userPreferredLanguage` state (defaults to 'en', TODO: integrate with user settings)
- useEffect hook detects language for all received messages in parallel
- Only detects for messages with 10+ characters from other users
- Shows "🌐 Translate" button when message language differs from user's preferred language
- Styled translate button with green accent matching app theme
- Function has no rate limiting (fast, lightweight operation <100ms)

**Optimization:** Detect on send, store in message document to avoid repeated detection (Future task)

**Test:** Send message in Spanish, verify "Translate" button appears for English user

**Deliverable:** Language detection working on received messages

---

## Task 7: Translate Received Messages on Demand ✅ COMPLETE

**Goal:** User can tap "Translate" to see message in their language

**Steps:**
1. Add translation state to messages:
   ```js
   const [translatedMessages, setTranslatedMessages] = useState({});
   ```
2. Add "Translate" button to message bubbles (conditionally shown)
3. On tap:
   - Call `translateText` function
   - Cache result in local state
   - Show translated text below original (or toggle between them)
4. Show loading spinner while translating
5. Add "Show Original" button to toggle back
6. Cache translations in SQLite for offline viewing

**Implementation Notes:**
- Added `translatedMessages` state object mapping messageId → { text, isVisible, sourceLanguage, cached }
- Added `translatingMessageId` state to track currently loading translation
- Created `handleTranslateMessage()` function that:
  - Checks if translation exists and toggles visibility
  - Calls `translateText` Firebase Function with neutral formality
  - Stores result in state for quick re-display
  - Shows error Alert if translation fails
- Updated message rendering:
  - Shows translated text below original in a bordered container
  - Dims original text (60% opacity) when translation is visible
  - Translation has green "TRANSLATION:" label
- Enhanced translate button:
  - Shows "⏳ Translating..." during loading (button disabled)
  - Shows "📄 Show Original" when translation is visible (green background)
  - Shows "🌐 Translate" by default (white background)
  - Button toggles between showing translation and original
- Styles: Clean separation between original and translated text with divider
- Translation caching: Leverages existing Firestore cache from translateText function

**Note:** SQLite offline caching will be implemented in Task 8

**Test:** Receive Spanish message, tap Translate, verify English translation appears

**Deliverable:** On-demand translation of received messages

---

## Task 8: Translation State Persistence ✅ COMPLETE (Lightweight Version)

**Goal:** Remember translation preferences and cache translated messages

**Implementation: Lightweight Version (User Preferences Only)**

**What Was Implemented:**
1. **Profile Screen UI:**
   - Added "Preferred Language" section to profile screen
   - Language selector with 6 languages (English, Spanish, French, Chinese, Japanese, Arabic)
   - Flag emojis + language names with selection checkmarks
   - Edit/cancel flow matching existing display name pattern
   - Loading state while fetching settings
   - Description: "Used for automatic message translation detection"

2. **Backend Integration:**
   - Uses existing `updateUserSettings` and `getUserSettings` functions (from Epic 1)
   - Stores preference in Firestore: `users/{uid}/settings/preferences.defaultLanguage`
   - Validates language codes server-side

3. **Chat Screen Integration:**
   - Loads user's preferred language on mount via `getUserSettings`
   - Uses `userPreferredLanguage` state to determine when to show "Translate" button
   - Messages in different language than user's preference show translate button

**Benefits:**
- ✅ Preferences persist across sessions (Firestore)
- ✅ Fast to implement (~30 mins)
- ✅ Clean UI integration in profile tab
- ✅ Leverages existing Epic 1 infrastructure
- ✅ No schema migrations needed

**What Was Skipped (Future Enhancement):**
- SQLite caching of translated message text
- Offline viewing of previously translated messages
- (Translation caching still works via Firestore from Task 2)

**Test:** 
1. Go to Profile → Preferred Language → Select Spanish
2. Have another user send English message
3. Verify "Translate" button appears (detects language mismatch)
4. Restart app → preference persists

**Deliverable:** User language preferences persist and drive translation detection

---

## Task 9: Offline Mode Handling ✅ COMPLETE

**Goal:** Gracefully disable translation when offline, show cached translations

**Steps:**
1. Use existing `useNetworkStore` to detect offline state
2. Disable translation toggle when offline (show gray + tooltip)
3. Hide "Translate" buttons on received messages when offline
4. Show cached translations from SQLite even when offline
5. ~~Queue translation requests when offline~~ **SKIPPED** - Translation is online-only

**Implementation Notes:**
1. **Network Store Integration:**
   - Imported `useNetworkStore` from existing network monitoring
   - Uses `isOnline` state to control translation availability

2. **Translation Toggle Disabled When Offline:**
   - Button becomes grayed out (50% opacity) when offline
   - Disabled state prevents clicking
   - Shows Alert: "Translation is unavailable while offline" if tapped
   - Visual styles: `translationButtonDisabled` and `translationButtonTextDisabled`

3. **Translation Preview Disabled:**
   - Added `isOnline` check to translation preview logic
   - Preview won't trigger when offline
   - Existing preview cleared when going offline

4. **Auto-Disable on Network Loss:**
   - useEffect monitors `isOnline` state
   - When offline detected:
     - Clears translation preview
     - Disables translation toggle
     - Clears pending translation timeouts
     - Logs "Translation disabled - offline"

5. **Translate Button Hidden on Received Messages:**
   - `shouldShowTranslateButton` includes `isOnline` check
   - No translate buttons shown on foreign language messages when offline

6. **Cached Translations Still Visible:**
   - Already-translated messages (in `translatedMessages` state) remain visible
   - Users can still toggle between translated and original text
   - Only new translation requests are blocked

**User Experience:**
- Clear visual feedback when offline (grayed out button)
- Helpful alert message if user tries to translate while offline
- Already-translated messages remain accessible
- Seamless re-enabling when connection restored

**Test:** 
- ✅ Go offline (airplane mode or toggle network)
- ✅ Verify translation globe button is grayed out
- ✅ Verify translate buttons disappear from received messages
- ✅ Verify previously translated messages still visible and toggleable
- ✅ Tap translation button → see "unavailable while offline" alert
- ✅ Go back online → translation features re-enable automatically

**Deliverable:** Graceful offline handling for translations

---

## Task 10: UI Polish & Error Handling

**Goal:** Professional UI and clear error messages

**Steps:**
1. Add error states for translation failures:
   - Network errors: "Translation unavailable - check connection"
   - Rate limit: "Daily translation limit reached (100/day). Resets at midnight UTC."
   - API errors: "Translation failed - try again"
2. Add loading states:
   - Preview: Subtle spinner or "Translating..." text
   - On-demand: Skeleton loader in message bubble
3. Style translation preview:
   - Light background, italic text, smaller font
   - Language indicator: "Spanish → English"
4. Smooth animations for show/hide translation
5. Accessibility: Proper labels for screen readers

**Test:** Trigger each error scenario, verify clear messaging

**Deliverable:** Polished UI with comprehensive error handling

---

## Task 11: Performance Optimization

**Goal:** Ensure translation meets <2s target consistently

**Steps:**
1. Implement streaming for translation preview (optional):
   - Use AI SDK streaming
   - Show partial translation as it generates
2. Measure and log response times
3. Optimize prompt length (shorter = faster)
4. Batch translate multiple messages? (Future optimization)
5. Test under poor network conditions

**Test:** 
- Translate 10 different messages
- Verify average response time <2s
- Check cache hit rate in logs

**Deliverable:** Translation consistently meets performance targets

---

## Task 12: Integration Testing & Refinement

**Goal:** End-to-end testing of all translation features

**Test Scenarios:**
1. **Outbound Translation:**
   - Enable translation, select Spanish, type in English
   - Verify preview appears within 2s
   - Send message, verify Spanish text in chat
   - Check Firestore cache for stored translation

2. **Inbound Translation:**
   - Have another user send Spanish message
   - Verify "Translate" button appears
   - Tap button, verify English translation
   - Toggle between original and translated

3. **Formality Levels:**
   - Translate same message with Casual/Neutral/Formal
   - Verify tone differences in output

4. **Caching:**
   - Translate same text twice
   - Second should be instant (check logs)

5. **Offline:**
   - Disable network, verify UI handles gracefully
   - Previously translated messages still visible

6. **Rate Limiting:**
   - Make 101 translation requests in one day
   - Verify limit enforced with clear error

7. **Edge Cases:**
   - Very long text (4900 chars)
   - Empty text
   - Emoji-only messages
   - Mixed language text

**Deliverable:** All features working reliably, documented test results

---

## Epic 2 Acceptance Criteria

**Feature Checklist:**
- [ ] Translation preview works with <2s response time
- [ ] Can send translated messages in 6 supported languages
- [ ] Formality adjustment (Casual/Neutral/Formal) works correctly
- [ ] Language detection identifies incoming message languages
- [ ] "Translate" button appears on foreign language messages
- [ ] Can view translations of received messages
- [ ] Translation cache reduces repeat translation time to <500ms
- [ ] Offline mode disables translation gracefully
- [ ] Previously translated messages visible offline (SQLite cache)
- [ ] Rate limiting enforces 100 translations/day
- [ ] Clear error messages for all failure scenarios
- [ ] UI is polished and matches existing design

**Performance Targets:**
- [ ] Translation preview: <2 seconds (95th percentile)
- [ ] Cached translation: <500ms
- [ ] Language detection: <100ms
- [ ] No UI blocking during translation

**Time Estimate:** 6-8 hours

**Next Epic:** Epic 3 - Cultural Intelligence Features


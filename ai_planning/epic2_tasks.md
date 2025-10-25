# Epic 2: Core Translation Infrastructure - Task List

**Goal:** Implement real-time translation with preview, language detection, and formality adjustment

**Features Delivered:**
- Feature #1: Real-time translation (inline) with preview
- Feature #2: Language detection & auto-translate
- Feature #4: Formality level adjustment

**Progress:** 4/12 tasks complete

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

## Task 5: Send Translated Message

**Goal:** When translation enabled, send the translated version

**Steps:**
1. Modify `handleSendMessage` in chat screen:
   - If translation enabled and preview exists, send preview text
   - Store original text in message metadata (optional, for reference)
   - Clear preview after sending
2. Maintain existing optimistic UI behavior
3. Reset translation toggle after send (or keep enabled based on UX preference)

**Test:** Enable translation, type message, wait for preview, send - verify translated text appears in chat

**Deliverable:** Translated messages send successfully

---

## Task 6: Language Detection for Received Messages

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

**Optimization:** Detect on send, store in message document to avoid repeated detection

**Test:** Send message in Spanish, verify "Translate" button appears for English user

**Deliverable:** Language detection working on received messages

---

## Task 7: Translate Received Messages on Demand

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

**Test:** Receive Spanish message, tap Translate, verify English translation appears

**Deliverable:** On-demand translation of received messages

---

## Task 8: Translation State Persistence

**Goal:** Remember translation preferences and cache translated messages

**Steps:**
1. Extend SQLite schema to store:
   - User's default target language (new table or existing users table)
   - Translated message text (new column in messages table)
2. Load translation preferences on app start
3. When message translated, save to SQLite:
   ```js
   await database.upsertMessage({
     ...message,
     translatedText,
     translatedLanguage: targetLanguage
   });
   ```
4. On message load, if `translatedText` exists, show translation immediately (offline support)

**Test:** Translate message, force quit app, reopen - translated text should be visible

**Deliverable:** Translation state persists across app restarts

---

## Task 9: Offline Mode Handling

**Goal:** Gracefully disable translation when offline, show cached translations

**Steps:**
1. Use existing `useNetworkStore` to detect offline state
2. Disable translation toggle when offline (show gray + tooltip)
3. Hide "Translate" buttons on received messages when offline
4. Show cached translations from SQLite even when offline
5. Queue translation requests when offline? (Optional - may skip for simplicity)

**Test:** 
- Go offline (airplane mode)
- Verify translation controls are disabled
- Verify cached translations still visible

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


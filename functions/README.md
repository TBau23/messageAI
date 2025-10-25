# MessageAI Cloud Functions

Firebase Cloud Functions for AI-powered messaging features.

## Quick Start

### 1. Install Dependencies
```bash
cd functions
npm install
```

### 2. Configure Environment
Create `functions/.env` file:
```
OPENAI_API_KEY=sk-proj-your-key-here
```

### 3. Start Emulators (Development)
From project root:
```bash
npm run emulators
```

Or:
```bash
firebase emulators:start
```

Emulator UI: http://localhost:4000

### 4. Deploy to Production
```bash
firebase deploy --only functions
```

---

## Available Functions

### Core Functions

#### `testAI`
- **Purpose:** Test OpenAI API connection
- **Auth:** Required
- **Rate Limit:** None (test function)
- **Usage:**
  ```js
  const testAI = httpsCallable(functions, 'testAI');
  const result = await testAI({});
  ```

#### `updateUserSettings`
- **Purpose:** Update user's AI preferences (language, etc.)
- **Auth:** Required
- **Parameters:** `{ defaultLanguage: 'en' | 'es' | 'fr' | 'zh' | 'ja' | 'ar' }`

#### `getUserSettings`
- **Purpose:** Get user's AI preferences
- **Auth:** Required
- **Returns:** `{ defaultLanguage, ... }`

#### `getAIUsage`
- **Purpose:** Get current AI usage and quota information
- **Auth:** Required
- **Returns:** `{ usage, limits, remaining, date }`

---

## Project Structure

```
functions/
├── index.js              # Main exports
├── .env                  # Environment variables (DO NOT COMMIT)
├── package.json          # Dependencies
└── src/
    ├── testAI.js         # Test function
    ├── userSettings.js   # User preferences
    ├── aiUsage.js        # Usage tracking
    ├── rateLimit.js      # Rate limiting logic
    ├── languageDetect.js # Language detection
    ├── template.js       # Reusable function template
    └── logger.js         # Logging utilities
```

---

## Adding New AI Functions

Use the `createAIFunction` template for consistent auth, rate limiting, and error handling:

```javascript
// functions/src/myNewFeature.js
const { createAIFunction, validateRequest } = require('./template');
const { openai } = require('@ai-sdk/openai');
const { generateText } = require('ai');

exports.myNewFeature = createAIFunction('translations', async (request, context) => {
  // Validate input
  validateRequest(request.data, ['text', 'targetLanguage']);
  
  const { text, targetLanguage } = request.data;
  
  // Call OpenAI
  const { text: result } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `Translate to ${targetLanguage}: ${text}`,
  });
  
  return { result };
});

// Export in index.js
const { myNewFeature } = require('./src/myNewFeature');
exports.myNewFeature = myNewFeature;
```

---

## Rate Limits

Daily limits per user (resets at midnight UTC):

- **Translations:** 100/day
- **Explanations:** 50/day
- **Extractions:** 5/day

Rate limits are tracked in Firestore: `users/{uid}/aiUsage/{date}`

To modify limits, edit `functions/src/rateLimit.js`.

---

## Testing

### Local Testing (Emulators)

1. Start emulators: `npm run emulators`
2. Run Expo app: `npx expo start`
3. Open iOS simulator (press `i`)
4. Test functions from the app

### View Logs
- **Emulator logs:** Check terminal where emulators are running
- **Emulator UI:** http://localhost:4000 → Logs tab

### Check Firestore Data
- **Emulator UI:** http://localhost:4000 → Firestore tab

---

## Environment Variables

Required in `functions/.env`:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-proj-...
```

**Security:** 
- ✅ `.env` is in `.gitignore` - never committed
- ✅ API keys stay server-side, never exposed to React Native app
- ✅ All functions verify Firebase Auth tokens

---

## Development Workflow

### Typical Dev Session

1. **Terminal 1:** Start emulators
   ```bash
   npm run emulators
   ```

2. **Terminal 2:** Start Expo
   ```bash
   npx expo start
   ```

3. Make changes to functions → Emulators auto-reload

4. Test in iOS simulator

### Debugging

- Check emulator logs for function invocations
- Use `console.log()` liberally in functions
- Check Emulator UI for Firestore writes
- Use `functions/src/logger.js` utilities for structured logging

---

## Deployment Checklist

Before deploying to production:

- [ ] Test all functions in emulator
- [ ] Verify rate limits are appropriate
- [ ] Check Firestore security rules
- [ ] Set OpenAI API key in Firebase console:
  ```bash
  firebase functions:config:set openai.key="sk-proj-..."
  ```
- [ ] Update function to use `functions.config().openai.key` in production
- [ ] Deploy: `firebase deploy --only functions`

---

## Troubleshooting

### "Module not found" errors
```bash
cd functions
npm install
```

### Emulator connection errors
- Ensure emulators are running
- Check `firebaseConfig.js` has emulator connection code
- Verify iOS simulator can reach `127.0.0.1`

### OpenAI API errors
- Check API key in `functions/.env`
- Verify OpenAI account has credits
- Check emulator logs for detailed error messages

### Rate limit errors
- Check usage: Call `getAIUsage` function
- Clear test data from Firestore Emulator UI
- Or wait for daily reset (midnight UTC)

---

## Resources

- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [AI SDK Docs](https://sdk.vercel.ai/docs)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)


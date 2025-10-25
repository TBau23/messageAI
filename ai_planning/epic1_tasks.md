# Epic 1: Foundation & Configuration - Task List

**Goal:** Set up AI infrastructure with Firebase Emulator Suite for local development and testing on iOS simulators.

**Environment Context:**
- Testing on iOS simulators via Expo Go (can access localhost directly)
- Firebase project exists on Blaze plan
- OpenAI API key available
- Environment variables via `.env` with `EXPO_PUBLIC_` prefix

---

## Phase 1: Firebase Functions Setup

### Task 1.1: Initialize Firebase Functions Project
**Estimate:** 30 minutes

**Steps:**
1. Install Firebase CLI globally (if not already): `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`
3. Initialize Functions in project root:
   ```bash
   firebase init functions
   ```
   - Select existing Firebase project
   - Choose JavaScript (or TypeScript if preferred)
   - Install dependencies when prompted
   - Do NOT overwrite any existing files (firestore.rules, etc.)

4. Verify `/functions` directory created with:
   - `package.json`
   - `index.js`
   - `.gitignore`

**Acceptance Criteria:**
- `/functions` directory exists
- Can run `npm install` in `/functions` without errors
- `firebase.json` includes functions configuration

---

### Task 1.2: Install AI SDK and Dependencies
**Estimate:** 15 minutes

**Steps:**
1. Navigate to `/functions` directory
2. Install required packages:
   ```bash
   npm install ai @ai-sdk/openai
   npm install express cors
   npm install firebase-admin firebase-functions
   ```

3. Install dev dependencies:
   ```bash
   npm install --save-dev @types/express @types/cors
   ```

**Acceptance Criteria:**
- All packages listed in `/functions/package.json`
- No installation errors
- `node_modules` populated in `/functions`

---

### Task 1.3: Configure OpenAI API Key in Firebase Functions
**Estimate:** 15 minutes

**Steps:**
1. In project root, set Firebase Functions environment config:
   ```bash
   firebase functions:config:set openai.api_key="YOUR_OPENAI_API_KEY"
   ```

2. Create `/functions/.env.local` file for emulator (NOT committed to git):
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. Update `/functions/.gitignore` to include:
   ```
   .env.local
   .env
   ```

4. Create `/functions/.env.example` (safe to commit):
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

**Acceptance Criteria:**
- API key never committed to git
- `.env.local` exists with real key (for emulator)
- Firebase config set for production deployment (if needed later)

---

### Task 1.4: Create Base Express App with Authentication Middleware
**Estimate:** 45 minutes

**Steps:**
1. Create `/functions/src` directory
2. Create `/functions/src/middleware/auth.js`:
   ```javascript
   // Verify Firebase Auth tokens
   // Extract userId from token
   // Attach to req.user
   ```

3. Create `/functions/src/middleware/cors.js`:
   ```javascript
   // Configure CORS for Expo app
   // Allow localhost and Expo Go domains
   ```

4. Create `/functions/index.js` base structure:
   ```javascript
   const functions = require('firebase-functions');
   const express = require('express');
   const app = express();
   
   // Import middleware
   // Import route handlers
   // Export as Firebase Function
   ```

**Acceptance Criteria:**
- Middleware extracts and verifies Firebase Auth tokens
- Returns 401 for invalid/missing tokens
- Returns 403 for expired tokens
- userId available in `req.user.uid`

---

## Phase 2: Firebase Emulator Setup

### Task 2.1: Install and Configure Firebase Emulator Suite
**Estimate:** 30 minutes

**Steps:**
1. Install emulators:
   ```bash
   firebase init emulators
   ```
   - Select: Functions, Firestore
   - Use default ports (Functions: 5001, Firestore: 8080)
   - Enable Emulator UI: Yes (default port 4000)

2. Update `firebase.json` to include emulator configuration:
   ```json
   {
     "emulators": {
       "functions": {
         "port": 5001
       },
       "firestore": {
         "port": 8080
       },
       "ui": {
         "enabled": true,
         "port": 4000
       }
     }
   }
   ```

3. Create npm script in root `package.json`:
   ```json
   "scripts": {
     "emulators": "firebase emulators:start --import=./emulator-data --export-on-exit"
   }
   ```

**Acceptance Criteria:**
- Can run `npm run emulators` successfully
- Emulator UI accessible at http://localhost:4000
- Functions emulator running at http://localhost:5001
- No port conflicts

---

### Task 2.2: Configure React Native to Connect to Emulators
**Estimate:** 30 minutes

**Steps:**
1. Add to `.env` file:
   ```
   EXPO_PUBLIC_USE_EMULATOR=true
   EXPO_PUBLIC_FUNCTIONS_EMULATOR_URL=http://localhost:5001
   ```

2. Update `firebaseConfig.js` to detect emulator mode:
   ```javascript
   import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
   import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
   import Constants from 'expo-constants';
   
   const useEmulator = Constants.expoConfig?.extra?.USE_EMULATOR === 'true';
   
   if (useEmulator && __DEV__) {
     connectFunctionsEmulator(functions, 'localhost', 5001);
     connectFirestoreEmulator(db, 'localhost', 8080);
     console.log('🔧 Connected to Firebase Emulators');
   }
   ```

3. Update `app.json` to pass env vars:
   ```json
   "extra": {
     "USE_EMULATOR": process.env.EXPO_PUBLIC_USE_EMULATOR
   }
   ```

**Acceptance Criteria:**
- When emulator mode enabled, app connects to localhost
- Console logs confirm emulator connection
- Existing Firestore functionality still works with emulator
- Can toggle emulator mode via .env file

---

### Task 2.3: Test Emulator Connection End-to-End
**Estimate:** 30 minutes

**Steps:**
1. Start emulators: `npm run emulators`
2. In separate terminal, start Expo: `npx expo start`
3. Press `i` to launch iOS simulator
4. Create simple test function in `/functions/index.js`:
   ```javascript
   exports.testConnection = functions.https.onCall(async (data, context) => {
     if (!context.auth) {
       throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
     }
     return { message: 'Connection successful!', userId: context.auth.uid };
   });
   ```

5. Create test button in app (can be temporary in profile screen):
   ```javascript
   import { getFunctions, httpsCallable } from 'firebase/functions';
   
   const functions = getFunctions();
   const testConnection = httpsCallable(functions, 'testConnection');
   
   // Call and log result
   ```

6. Test on simulator

**Acceptance Criteria:**
- Test function appears in Emulator UI
- App successfully calls function
- Function receives authenticated userId
- Response logged in app console
- Can see function logs in Emulator UI

---

## Phase 3: AI Integration

### Task 3.1: Create Test OpenAI Function
**Estimate:** 45 minutes

**Steps:**
1. Create `/functions/src/ai/testOpenAI.js`:
   ```javascript
   const { openai } = require('@ai-sdk/openai');
   const { generateText } = require('ai');
   
   async function testOpenAI(prompt) {
     const { text } = await generateText({
       model: openai('gpt-4o-mini'),
       prompt: prompt,
     });
     return text;
   }
   
   module.exports = { testOpenAI };
   ```

2. Create callable function in `/functions/index.js`:
   ```javascript
   exports.testAI = functions.https.onCall(async (data, context) => {
     // Auth check
     // Call testOpenAI
     // Return result
   });
   ```

3. Add test button in app to call this function

**Acceptance Criteria:**
- Function successfully calls OpenAI API
- GPT-4o-mini responds correctly
- Response returned to app
- API key never exposed to client
- Works in emulator environment

---

### Task 3.2: Set Up Language Detection Service
**Estimate:** 1 hour

**Steps:**
1. Research lightweight language detection libraries:
   - Option A: `franc` (popular, works offline)
   - Option B: `@pemistahl/lingua` (accurate but larger)
   - Option C: Use OpenAI API for detection (simpler but costs tokens)

2. Install chosen library in `/functions`
3. Create `/functions/src/utils/languageDetection.js`:
   ```javascript
   // Detect language from text
   // Return ISO language code (en, es, fr, zh, ja, ar)
   // Handle edge cases (very short text, mixed languages)
   // Cache results for performance
   ```

4. Create test function:
   ```javascript
   exports.detectLanguage = functions.https.onCall(async (data, context) => {
     const { text } = data;
     const language = await detectLanguage(text);
     return { language, confidence: ... };
   });
   ```

5. Test with multiple languages in simulator

**Acceptance Criteria:**
- Detects English, Spanish, French, Chinese, Japanese correctly
- Response time <100ms for typical messages
- Handles edge cases gracefully (empty text, emojis only)
- Returns ISO 639-1 language codes

**Recommendation:** Start with `franc` for simplicity and speed.

---

## Phase 4: Rate Limiting & User Settings

### Task 4.1: Design User Settings Schema
**Estimate:** 30 minutes

**Steps:**
1. Design Firestore schema for user AI settings:
   ```
   users/{uid}/settings/ai:
     - defaultLanguage: string (ISO code)
     - preferredFormality: string ('casual' | 'neutral' | 'formal')
     - translationEnabled: boolean
     - createdAt: timestamp
     - updatedAt: timestamp
   ```

2. Design usage tracking schema:
   ```
   users/{uid}/aiUsage/{date}:
     - translationCount: number
     - explanationCount: number
     - extractionCount: number
     - date: string (YYYY-MM-DD)
     - resetAt: timestamp (for daily reset)
   ```

3. Document schema in `/ai_planning/schemas.md`

**Acceptance Criteria:**
- Schema documented with field types and constraints
- Schema supports all rate limiting requirements
- Schema supports user preference storage

---

### Task 4.2: Implement Rate Limiting Utility
**Estimate:** 1 hour

**Steps:**
1. Create `/functions/src/utils/rateLimiter.js`:
   ```javascript
   const admin = require('firebase-admin');
   
   const LIMITS = {
     translation: 100,    // per day
     explanation: 50,     // per day
     extraction: 5        // per day
   };
   
   async function checkRateLimit(userId, type) {
     // Get today's date (YYYY-MM-DD)
     // Query aiUsage/{date} document
     // Check current count vs limit
     // Return { allowed: boolean, remaining: number, resetAt: timestamp }
   }
   
   async function incrementUsage(userId, type) {
     // Increment count atomically
     // Create document if doesn't exist
     // Handle midnight reset
   }
   
   module.exports = { checkRateLimit, incrementUsage, LIMITS };
   ```

2. Create middleware in `/functions/src/middleware/rateLimit.js`:
   ```javascript
   // Wrapper that checks rate limit before function execution
   // Returns 429 error if limit exceeded
   // Includes retry-after header
   ```

3. Create test function to verify rate limiting works

**Acceptance Criteria:**
- Rate limits enforced per user per day
- Returns 429 with clear error message when limit hit
- Remaining quota returned in response headers
- Resets properly at midnight UTC
- Atomic increments prevent race conditions

---

### Task 4.3: Create User Settings API Endpoints
**Estimate:** 45 minutes

**Steps:**
1. Create `/functions/src/api/settings.js`:
   ```javascript
   // GET /settings - fetch user's AI settings
   // PUT /settings - update user's AI settings
   // GET /settings/usage - get current usage stats
   ```

2. Add endpoints to main function handler
3. Create helper utilities in React Native app:
   ```javascript
   // utils/aiSettings.js
   export async function fetchAISettings()
   export async function updateAISettings(settings)
   export async function getUsageStats()
   ```

4. Add settings UI to profile screen (optional for now, can be minimal)

**Acceptance Criteria:**
- Can read/write user AI settings
- Settings persist across sessions
- Can retrieve current usage stats
- Default settings created on first access

---

## Phase 5: Testing & Documentation

### Task 5.1: Create Development Workflow Documentation
**Estimate:** 30 minutes

**Steps:**
1. Create `/ai_planning/development_workflow.md`:
   - How to start emulators
   - How to start Expo dev server
   - How to view function logs
   - How to test AI functions
   - How to clear emulator data
   - Troubleshooting common issues

2. Add npm scripts to root `package.json`:
   ```json
   "scripts": {
     "dev": "concurrently \"npm run emulators\" \"npx expo start\"",
     "emulators": "firebase emulators:start --import=./emulator-data --export-on-exit",
     "emulators:clear": "rm -rf emulator-data"
   }
   ```

**Acceptance Criteria:**
- Clear step-by-step instructions for starting development
- Troubleshooting section covers common issues
- Scripts make workflow easier

---

### Task 5.2: End-to-End Validation
**Estimate:** 1 hour

**Steps:**
1. Verify checklist:
   - ✅ Firebase Functions emulator running
   - ✅ React Native app connects to emulator
   - ✅ Authentication middleware works
   - ✅ OpenAI API integration works
   - ✅ Language detection works (<100ms)
   - ✅ Rate limiting enforces limits
   - ✅ User settings can be saved/retrieved
   - ✅ Can test on iOS simulator
   - ✅ API keys secured (never in app bundle)
   - ✅ Error handling returns clear messages

2. Run through test scenarios:
   - Test authenticated API call
   - Test unauthenticated call (should fail)
   - Test OpenAI integration
   - Test language detection with 5+ languages
   - Test rate limit (make 101 calls, verify 429 error)
   - Test settings CRUD operations

3. Document any issues found

**Acceptance Criteria:**
- All checklist items passing
- All test scenarios working
- No blocking issues
- Ready to proceed to Epic 2

---

## Phase 6: Optional Enhancements

### Task 6.1: Add Request Logging (Optional)
**Estimate:** 30 minutes

**Steps:**
1. Create logging middleware for debugging
2. Log all function calls with timing
3. Log OpenAI API usage and costs
4. Store logs in Firestore (optional) or just console

**Benefits:**
- Easier debugging during development
- Track API usage and costs
- Performance monitoring

---

### Task 6.2: Add Emulator Data Seeding (Optional)
**Estimate:** 30 minutes

**Steps:**
1. Create `/functions/scripts/seedEmulator.js`
2. Generate test users with AI settings
3. Generate sample usage data
4. Run script when emulator starts

**Benefits:**
- Faster testing (don't need to create test data manually)
- Consistent test environment

---

## Summary

**Total Estimated Time:** 8-10 hours

**Critical Path:**
1. Initialize Functions + Install dependencies (45 min)
2. Set up emulators + Connect app (1 hour)
3. Test connection end-to-end (30 min)
4. Test OpenAI integration (45 min)
5. Language detection (1 hour)
6. Rate limiting (1 hour)
7. Testing & validation (1 hour)

**Non-Blocking (Can Be Done Later):**
- Settings UI in app
- Logging middleware
- Emulator data seeding

**Key Files Created:**
- `/functions/index.js` - Main function exports
- `/functions/src/middleware/auth.js` - Authentication
- `/functions/src/middleware/rateLimit.js` - Rate limiting
- `/functions/src/utils/languageDetection.js` - Language detection
- `/functions/src/utils/rateLimiter.js` - Rate limit logic
- `/functions/src/ai/testOpenAI.js` - OpenAI integration
- `/ai_planning/development_workflow.md` - Dev setup guide
- `/ai_planning/schemas.md` - Firestore schemas

**Dependencies Between Tasks:**
- Must complete 1.1-1.3 before any other tasks
- Must complete 2.1-2.2 before testing
- Task 3.1 can be done in parallel with 3.2
- Task 4.1-4.2 can be done in parallel with Phase 3

**Success Criteria for Epic 1:**
✅ Firebase Functions running locally in emulator
✅ React Native app on iOS simulator connects to emulator
✅ OpenAI API integration working
✅ Language detection <100ms response time
✅ Rate limiting enforced (100/50/5 daily limits)
✅ User settings can be saved/retrieved
✅ API keys secured (never exposed to app)
✅ Authentication middleware working
✅ Ready to build translation features in Epic 2


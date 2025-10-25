# Epic 1: Foundation & Configuration - Task List

**Environment:** iOS Simulators with Expo Go + Firebase Emulator Suite (localhost)

---

## Task 1: Initialize Firebase Functions Project

**Goal:** Set up Functions directory structure and dependencies

**Steps:**
1. Run `firebase init functions` in project root (select JavaScript or TypeScript)
2. Install dependencies:
   ```bash
   cd functions
   npm install ai openai
   npm install --save-dev firebase-functions-test
   ```
3. Verify `functions/package.json` has correct Node version (18+)
4. Update `functions/.eslintrc.js` if needed (or disable strict rules during dev)

**Deliverable:** `/functions` directory with `index.js` and `package.json`

---

## Task 2: Configure Firebase Emulators

**Goal:** Run Functions, Firestore, and Auth locally for rapid development

**Steps:**
1. Run `firebase init emulators` (select Functions, Firestore, Auth)
2. Edit `firebase.json` emulator config:
   ```json
   "emulators": {
     "functions": { "port": 5001 },
     "firestore": { "port": 8080 },
     "auth": { "port": 9099 },
     "ui": { "enabled": true, "port": 4000 }
   }
   ```
3. Test emulators: `firebase emulators:start`
4. Verify Emulator UI at http://localhost:4000

**Deliverable:** Working emulator suite accessible from simulators

---

## Task 3: Configure OpenAI API Key for Functions

**Goal:** Store OpenAI API key in Functions environment (never in React Native)

**Steps:**
1. Create `functions/.env` file:
   ```
   OPENAI_API_KEY=sk-...
   ```
2. Add to `functions/.gitignore`: `.env`
3. In `functions/index.js`, load with:
   ```js
   require('dotenv').config();
   const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
   ```
4. Install dotenv: `cd functions && npm install dotenv`

**Deliverable:** API key accessible in Functions, not exposed to React Native

---

## Task 4: Create Base Function with AI SDK

**Goal:** Test end-to-end: React Native → Firebase Function → OpenAI API

**Steps:**
1. Create `functions/src/testAI.js`:
   ```js
   const { onCall } = require('firebase-functions/v2/https');
   const { openai } = require('@ai-sdk/openai');
   const { generateText } = require('ai');

   exports.testAI = onCall(async (request) => {
     // Verify authenticated user
     if (!request.auth) {
       throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
     }

     const { text } = await generateText({
       model: openai('gpt-4o-mini'),
       prompt: 'Say hello in 3 languages',
     });

     return { result: text };
   });
   ```
2. Export in `functions/index.js`:
   ```js
   const { testAI } = require('./src/testAI');
   exports.testAI = testAI;
   ```
3. Restart emulators

**Deliverable:** Callable function `testAI` running in emulator

---

## Task 5: Configure React Native to Use Emulators

**Goal:** Point app to localhost Firebase services during development

**Steps:**
1. Update `firebaseConfig.js` to use emulators in dev:
   ```js
   import { getAuth, connectAuthEmulator } from 'firebase/auth';
   import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
   import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

   const auth = getAuth(app);
   const db = getFirestore(app);
   const functions = getFunctions(app);

   if (__DEV__) {
     connectAuthEmulator(auth, 'http://127.0.0.1:9099');
     connectFirestoreEmulator(db, '127.0.0.1', 8080);
     connectFunctionsEmulator(functions, '127.0.0.1', 5001);
   }
   ```
2. Export `functions` from `firebaseConfig.js`
3. Test: Restart Expo, open simulator, verify no errors

**Deliverable:** App connects to local emulators (check Emulator UI for connections)

---

## Task 6: Test End-to-End AI Call from React Native

**Goal:** Verify complete flow works

**Steps:**
1. Create test button in `app/(main)/profile.js`:
   ```js
   import { httpsCallable } from 'firebase/functions';
   import { functions } from '../../firebaseConfig';

   const testAI = async () => {
     const callable = httpsCallable(functions, 'testAI');
     const result = await callable({});
     console.log(result.data.result);
     Alert.alert('AI Response', result.data.result);
   };
   ```
2. Test in simulator: tap button, should see OpenAI response
3. Check Emulator UI Functions logs for invocation
4. Verify OpenAI API dashboard shows request

**Deliverable:** Working AI call from simulator through emulated function

---

## Task 7: Set Up User Settings Schema (Firestore)

**Goal:** Store user language preferences

**Steps:**
1. Create `functions/src/schemas.js`:
   ```js
   // User settings schema reference
   // users/{uid}/settings
   // {
   //   defaultLanguage: 'en',
   //   translationEnabled: true,
   //   createdAt: timestamp,
   //   updatedAt: timestamp
   // }
   ```
2. Create helper function `functions/src/userSettings.js`:
   ```js
   const { onCall } = require('firebase-functions/v2/https');
   const admin = require('firebase-admin');

   exports.updateUserSettings = onCall(async (request) => {
     const uid = request.auth.uid;
     const { defaultLanguage } = request.data;
     
     await admin.firestore()
       .collection('users')
       .doc(uid)
       .collection('settings')
       .doc('preferences')
       .set({
         defaultLanguage,
         updatedAt: admin.firestore.FieldValue.serverTimestamp()
       }, { merge: true });

     return { success: true };
   });
   ```
3. Export in `functions/index.js`

**Deliverable:** Function to save/retrieve user language preferences

---

## Task 8: Implement Rate Limiting Foundation

**Goal:** Track per-user AI usage to enforce quotas

**Steps:**
1. Create `functions/src/rateLimit.js`:
   ```js
   const admin = require('firebase-admin');

   const LIMITS = {
     translations: 100,    // per day
     explanations: 50,     // per day
     extractions: 5        // per day
   };

   async function checkRateLimit(uid, featureType) {
     const today = new Date().toISOString().split('T')[0];
     const usageRef = admin.firestore()
       .collection('users')
       .doc(uid)
       .collection('aiUsage')
       .doc(today);

     const doc = await usageRef.get();
     const usage = doc.data() || {};
     const count = usage[featureType] || 0;

     if (count >= LIMITS[featureType]) {
       throw new functions.https.HttpsError(
         'resource-exhausted',
         `Daily ${featureType} limit reached. Resets at midnight UTC.`
       );
     }

     // Increment usage
     await usageRef.set({
       [featureType]: count + 1
     }, { merge: true });

     return { remaining: LIMITS[featureType] - count - 1 };
   }

   module.exports = { checkRateLimit, LIMITS };
   ```
2. Test with temporary function that calls `checkRateLimit()`

**Deliverable:** Rate limiting helper ready to use in AI functions

---

## Task 9: Set Up Language Detection Service

**Goal:** Detect source language server-side (fast, <100ms)

**Steps:**
1. Install language detection: `cd functions && npm install franc-min`
2. Create `functions/src/languageDetect.js`:
   ```js
   const franc = require('franc-min');

   const ISO_MAP = {
     eng: 'en', spa: 'es', fra: 'fr', 
     cmn: 'zh', jpn: 'ja', arb: 'ar'
   };

   function detectLanguage(text) {
     const code = franc(text);
     return ISO_MAP[code] || 'en';
   }

   module.exports = { detectLanguage };
   ```
3. Test with sample texts in different languages

**Deliverable:** Fast language detection function (<100ms)

---

## Task 10: Create Function Template Structure

**Goal:** Standardize all AI functions with auth, rate limiting, error handling

**Steps:**
1. Create `functions/src/template.js`:
   ```js
   const { onCall } = require('firebase-functions/v2/https');
   const { checkRateLimit } = require('./rateLimit');

   // Template for AI functions
   function createAIFunction(featureType, handler) {
     return onCall(async (request) => {
       // 1. Auth check
       if (!request.auth) {
         throw new functions.https.HttpsError('unauthenticated', 'Login required');
       }

       // 2. Rate limiting
       const { remaining } = await checkRateLimit(request.auth.uid, featureType);

       // 3. Execute AI operation
       try {
         const result = await handler(request);
         return { ...result, quotaRemaining: remaining };
       } catch (error) {
         console.error(`${featureType} error:`, error);
         throw new functions.https.HttpsError('internal', error.message);
       }
     });
   }

   module.exports = { createAIFunction };
   ```

**Deliverable:** Reusable template for all AI functions

---

## Task 11: Add Development Logging & Monitoring

**Goal:** Debug AI calls easily during development

**Steps:**
1. Create `functions/src/logger.js`:
   ```js
   function logAIRequest(functionName, uid, input) {
     console.log(`[${functionName}] User: ${uid}`);
     console.log(`[${functionName}] Input:`, JSON.stringify(input, null, 2));
   }

   function logAIResponse(functionName, responseTime, tokens) {
     console.log(`[${functionName}] Response time: ${responseTime}ms`);
     console.log(`[${functionName}] Tokens used: ${tokens}`);
   }

   module.exports = { logAIRequest, logAIResponse };
   ```
2. Use in test function to verify logging in Emulator UI

**Deliverable:** Structured logging for AI operations

---

## Task 12: Deployment Scripts & Documentation

**Goal:** Easy commands for starting/stopping emulators

**Steps:**
1. Add to root `package.json`:
   ```json
   "scripts": {
     "emulators": "firebase emulators:start",
     "emulators:export": "firebase emulators:export ./emulator-data",
     "functions:shell": "cd functions && npm run shell"
   }
   ```
2. Create `functions/README.md` with:
   - Environment setup instructions
   - How to add new AI functions
   - Testing checklist
   - Emulator workflow

**Deliverable:** Quick-start commands for development

---

## Epic 1 Acceptance Criteria

**Test Checklist:**
- [ ] Firebase emulators start without errors
- [ ] OpenAI API call succeeds from emulated function
- [ ] React Native app connects to emulators (check logs)
- [ ] Test AI button in profile works on iOS simulator
- [ ] Rate limiting increments usage in Firestore
- [ ] Language detection returns correct ISO codes
- [ ] Auth middleware blocks unauthenticated calls
- [ ] Emulator UI shows all function invocations
- [ ] No API keys exposed in React Native code (verify with grep)
- [ ] `npm run emulators` starts all services

**Time Estimate:** 4-6 hours

**Next Epic:** Epic 2 - Core Translation Infrastructure


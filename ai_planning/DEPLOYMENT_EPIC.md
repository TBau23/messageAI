# Deployment Epic: Production Firebase + Expo Distribution

**Goal**: Enable two deployment paths:
1. **Expo Go Publishing** - Share app via QR code for remote testing
2. **Local Emulator Setup** - Clean instructions for reviewers to run locally

**Current State**: App runs on local emulators only. Firebase Functions, Auth, Firestore, and Storage need production setup.

---

## Prerequisites

- Firebase CLI installed: `npm install -g firebase-tools`
- EAS CLI installed: `npm install -g eas-cli`
- Firebase project created (or use existing)
- OpenAI API key for AI features

---

## Phase 1: Production Firebase Setup (Required for Both Paths)

### 1.1 Firebase Project Setup

```bash
# Login to Firebase
firebase login

# Initialize Firebase project (if not done)
firebase use --add
# Select your Firebase project, give it an alias like "production"
```

### 1.2 Deploy Firestore Security Rules

**⚠️ CRITICAL**: Current rules allow open access until Nov 2025. Update before deployment.

Edit `firestore.rules` with production-safe rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user doc
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Conversations: only participants can access
    match /conversations/{conversationId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      
      match /messages/{messageId} {
        allow read, write: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
      
      match /typingStatus/{userId} {
        allow read: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

### 1.3 Deploy Storage Rules

Edit `storage.rules` if needed, then:
```bash
firebase deploy --only storage
```

### 1.4 Configure Firebase Functions Environment

Functions require OpenAI API key. Set it:
```bash
firebase functions:config:set openai.api_key="your-openai-api-key-here"
```

Verify:
```bash
firebase functions:config:get
```

### 1.5 Deploy Firebase Functions

Your functions (8 total):
- `testAI` - AI connectivity test
- `updateUserSettings` / `getUserSettings` - User preferences
- `getAIUsage` - Usage tracking
- `translateText` - Real-time translation
- `detectMessageLanguage` - Auto language detection
- `explainIdioms` - Slang/idiom explanations
- `explainCulturalContext` - Cultural hints
- `extractCulturalInsights` - Conversation insights

Deploy:
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

**Expected output**: 8 function URLs. Note these for verification.

### 1.6 Test Production Functions

```bash
# Test AI connection
curl -X POST https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/testAI \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Test translation
curl -X POST https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/translateText \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello", "targetLanguage": "es"}'
```

### 1.7 Update App Environment Variables

Create/update `.env` (from `env.example`):
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

# Comment out or remove emulator host for production
# EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1
```

**Note**: `firebaseConfig.js` already handles dev/prod switching via `__DEV__` flag.

---

## Phase 2A: Path 1 - Expo Go Publishing

This allows others to scan a QR code and test your app using the Expo Go app.

### 2A.1 Login to EAS

```bash
eas login
# Use your Expo account (owner: tbizzer from app.json)
```

### 2A.2 Configure EAS (Optional)

Your `app.json` already has project ID `4ac49f8c-1736-4b60-90d4-d0ca261b484b`.

Optionally create `eas.json` for custom build profiles:
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "distribution": "store"
    }
  }
}
```

### 2A.3 Publish Update

With EAS Update (modern approach):
```bash
# Install EAS Update if needed
npx expo install expo-updates

# Publish to production channel
eas update --branch production --message "Initial production release"
```

Or classic Expo publish (simpler):
```bash
npx expo publish --release-channel production
```

### 2A.4 Share with Testers

1. **Get shareable link**: After publish, you'll get a URL like:
   - `exp://exp.host/@tbizzer/react-messageai?release-channel=production`

2. **Create QR code**: EAS provides QR codes automatically

3. **Testers install**:
   - Download "Expo Go" from App Store / Play Store
   - Scan QR code or open link
   - App launches in Expo Go

### 2A.5 Verify Production Backend

Test with a friend:
- Create accounts (Firebase Auth production)
- Send messages (Firestore production)
- Upload profile photo (Storage production)
- Try AI translation (Functions production)
- Test offline/online sync

---

## Phase 2B: Path 2 - Local Emulator Setup

Clean setup instructions for reviewers running on their machines.

### 2B.1 Update README

Add clear setup section (example):

````markdown
## Local Setup for Reviewers

### Prerequisites
- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator

### Installation

1. Clone repository
2. Install dependencies:
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

3. Set up environment variables:
   ```bash
   cp env.example .env
   # Add your Firebase credentials
   ```

4. Start app:
   ```bash
   npm start
   # Press 'i' for iOS Simulator
   # Press 'a' for Android Emulator
   ```

### Testing with Production Backend

The app connects to production Firebase automatically in dev mode.
AI features (translation, cultural insights) require deployed Firebase Functions.

### Testing with Local Emulators

1. Start Firebase emulators:
   ```bash
   npm run emulators
   ```

2. In `.env`, uncomment:
   ```env
   EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1
   ```

3. Start app:
   ```bash
   npm start
   ```

**Note**: AI features won't work with emulators (require OpenAI API).
````

### 2B.2 Create Test Accounts

For reviewers testing locally, pre-create test accounts:

1. Use Firebase Console → Authentication → Add User
2. Create 2-3 test accounts: `test1@example.com`, `test2@example.com`
3. Set simple passwords
4. Document in README

### 2B.3 Seed Demo Data (Optional)

You have `functions/seedEmulator.js`. Create production version:
- Script to create demo conversations
- Add to README as "Quick Start"

---

## Verification Checklist

### Both Paths
- [ ] Firebase Functions deployed and responding
- [ ] Firestore rules deployed and secure
- [ ] Storage rules deployed
- [ ] Environment variables configured
- [ ] AI features (translation) working
- [ ] Push notifications working (production only)

### Path 1 (Expo Go)
- [ ] Published to Expo
- [ ] QR code shareable
- [ ] Testers can scan and launch
- [ ] App connects to production Firebase
- [ ] Messages sync between devices

### Path 2 (Local)
- [ ] README has clear instructions
- [ ] Clone → install → run works smoothly
- [ ] App launches in simulator
- [ ] Test accounts documented
- [ ] AI features accessible

---

## Troubleshooting

**Functions deploy fails:**
```bash
# Check Node version (should be 22 per functions/package.json)
node --version

# Install dependencies
cd functions && npm install
```

**Expo publish fails:**
```bash
# Clear cache
npx expo start -c

# Verify project ID
cat app.json | grep projectId
```

**App can't connect to Firebase:**
- Verify `.env` variables match Firebase Console
- Check `__DEV__` isn't forcing emulator connection
- Verify Firebase project has Auth/Firestore enabled

**AI features fail:**
```bash
# Verify function config
firebase functions:config:get

# Check function logs
firebase functions:log --limit 50
```

---

## Cost Estimates

- **Firebase**: Free tier supports ~50K reads/day, 20K writes/day
- **Firebase Functions**: Free tier 2M invocations/month
- **OpenAI API**: ~$0.002 per translation (GPT-4o-mini)
- **EAS Updates**: Free tier 100 updates/month
- **Expo Go**: Free for testing

---

## Next Steps

After deployment working:
1. Add analytics (Firebase Analytics)
2. Monitor function costs (Firebase Console → Functions → Usage)
3. Set up error monitoring (Sentry/Firebase Crashlytics)
4. Create TestFlight/APK build for real distribution (separate epic)


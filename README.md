# MessageAI - AI-Powered Messaging App

A production-quality messaging application built with React Native, Expo, and Firebase. Features real-time messaging, group chats, offline support, read receipts, and AI-powered translation and cultural insights for international communication.

## 🎯 MVP Features

✅ **Core Messaging**
- One-on-one chat functionality
- Real-time message delivery between multiple users
- Message persistence (survives app restarts)
- Optimistic UI updates (messages appear instantly)
- Message timestamps

✅ **User Management**
- User authentication (email/password)
- User profiles with display names
- Online/offline status indicators

✅ **Group Chat**
- Create group conversations (3+ users)
- Group naming
- Message attribution (sender names in groups)
- Group participant list

✅ **Read Receipts**
- Single grey checkmark (✓) - Message sent
- Double grey checkmark (✓✓) - Message delivered to all
- Double blue checkmark (✓✓) - Message read by all
- Works in both direct and group chats

✅ **Notifications**
- Foreground notification banners for incoming messages
- Smart notifications (don't show for currently open chat)
- Tap to navigate to conversation

✅ **Offline Support**
- SQLite local cache for instant loading
- Firestore offline persistence
- Network status monitoring
- Visual network status indicators

✅ **AI Features** (International Communicator Persona)
- Real-time message translation (inline)
- Automatic language detection
- Cultural context hints and explanations
- Formality level adjustment
- Slang and idiom explanations
- Conversation insights extraction

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Expo CLI**: `npm install -g expo-cli`
- **Firebase CLI**: `npm install -g firebase-tools`
- **iOS Simulator** (macOS) or **Android Emulator**
- A **Firebase account** (free tier is sufficient)
- An **OpenAI API key** (for AI features) - Get one at https://platform.openai.com/api-keys

## 🚀 Getting Started

**Choose Your Setup Path:**

| Path | Best For | Features | Setup Time |
|------|----------|----------|------------|
| **Production Firebase** (Recommended) | Reviewers, testers, full demo | ✅ All features including AI | ~20 minutes |
| **Local Emulators** | Development without API costs | ❌ No AI features | ~5 minutes |

---

### Quick Start (Production Firebase - Recommended)

This is the easiest path and includes all AI features.

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd react-messageai
```

#### 2. Install Dependencies

```bash
npm install
cd functions
npm install
cd ..
```

#### 3. Firebase Setup

**a) Create Firebase Project**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Once created, click the web icon (</>) to add a web app
4. Copy the Firebase configuration object (you'll need this in step 4)

**b) Enable Firebase Services**

1. **Authentication**:
   - Go to Authentication → Get Started → Sign-in method
   - Enable "Email/Password" provider

2. **Firestore Database**:
   - Go to Firestore Database → Create database
   - Start in **production mode**
   - Choose `us-central1` or location close to you

3. **Storage**:
   - Go to Storage → Get Started
   - Use default security rules (we'll update them)

**c) Deploy Security Rules**

Login to Firebase CLI:
```bash
firebase login
firebase use --add
# Select your project, give it an alias like "production"
```

Deploy Firestore and Storage rules:
```bash
firebase deploy --only firestore:rules,storage
```

The rules are already configured in `firestore.rules` and `storage.rules` to ensure:
- Users can only access conversations they're participants in
- Users can only modify their own profile
- Profile photos are publicly readable but only writable by owner

**d) Set Up Firebase Functions (Required for AI Features)**

Create `functions/.env` file:
```bash
cd functions
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
cd ..
```

Deploy functions:
```bash
firebase deploy --only functions
```

This deploys 9 cloud functions:
- `translateText` - Real-time translation
- `detectMessageLanguage` - Auto language detection
- `explainIdioms` - Slang/idiom explanations
- `explainCulturalContext` - Cultural hints
- `extractCulturalInsights` - Conversation insights
- `testAI` - AI connectivity test
- Plus 3 utility functions for settings and usage tracking

**e) Create Firestore Index**

You'll need a composite index for conversations. When you first run the app and load the chat list, Firestore will display an error with a link to auto-create the index. Click that link, or manually create it:

- Go to Firestore → Indexes → Create Index
- **Collection**: `conversations`
- **Fields**:
  - `participants` (Array-contains)
  - `updatedAt` (Descending)
- Click "Create Index" (takes ~5 minutes)

#### 4. App Environment Configuration

Create `.env` file in the root directory:

```bash
cp env.example .env
```

Edit `.env` with your Firebase configuration from step 3:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

# Leave commented out for production Firebase:
# EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1
```

> **Note**: The app automatically connects to production Firebase when running. The emulator connection only happens in development mode when `EXPO_PUBLIC_EMULATOR_HOST` is set.

#### 5. Run the Application

```bash
npm start
```

Then:
- Press `i` to open in iOS Simulator
- Press `a` to open in Android Emulator
- Scan the QR code with Expo Go app on your physical device

You're done! The app will connect to your production Firebase backend with full AI features.

---

### Alternative: Local Emulator Setup (No AI Features)

If you want to run with local Firebase emulators (useful for development without OpenAI costs), follow these steps:

#### 1-2. Clone and Install (Same as above)

```bash
git clone <repository-url>
cd react-messageai
npm install
cd functions && npm install && cd ..
```

#### 3. Set Up Local Environment

Create `.env` file:
```bash
cp env.example .env
```

Edit `.env` and add **any** Firebase credentials (they don't need to be real for emulators):
```env
EXPO_PUBLIC_FIREBASE_API_KEY=demo-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Enable emulator connection:
EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1
```

#### 4. Start Firebase Emulators

In a separate terminal:
```bash
npm run emulators
```

This starts:
- Auth emulator (port 9099)
- Firestore emulator (port 8080)
- Storage emulator (port 9199)
- Functions emulator (port 5001)
- Emulator UI (http://localhost:4000)

#### 5. Run the App

In another terminal:
```bash
npm start
# Press 'i' for iOS or 'a' for Android
```

**Note**: AI features won't work with emulators since they require OpenAI API calls.

## 📱 Testing with Multiple Users

### iOS Simulators (Recommended for Testing)

1. **Open Multiple Simulators**:

```bash
# List available simulators
xcrun simctl list devices

# Boot two iPhone simulators
open -a Simulator --args -CurrentDeviceUDID <DEVICE_UDID_1>
open -a Simulator --args -CurrentDeviceUDID <DEVICE_UDID_2>
```

2. **Run Expo on Both**:
   - Start Expo: `npm start`
   - Press `i` and select the first simulator
   - Press `i` again and select the second simulator

3. **Create Test Accounts**:
   - User 1: `user1@test.com` / `password123`
   - User 2: `user2@test.com` / `password123`
   - User 3: `user3@test.com` / `password123`

4. **Test Scenarios**:
   - Sign up/sign in with different users on each simulator
   - Send messages between users
   - Create a group chat with 3+ users
   - Test offline mode (toggle airplane mode in simulator)
   - Force quit and restart to test persistence

## 🏗️ Project Structure

```
react-messageai/
├── app/                        # Expo Router screens
│   ├── (auth)/                 # Authentication screens
│   │   ├── login.js
│   │   ├── signup.js
│   │   └── profile-setup.js
│   ├── (main)/                 # Main app screens
│   │   ├── index.js            # Chat list
│   │   ├── new-chat.js         # Create chat/group
│   │   ├── profile.js          # User profile
│   │   └── chat/
│   │       └── [id].js         # Chat screen
│   └── _layout.js              # Root layout
├── components/                 # Reusable components
│   ├── Avatar.js               # Profile pictures
│   ├── NetworkBanner.js        # Network status indicator
│   ├── MessageNotification.js  # Foreground notifications
│   ├── MessageStatusIndicator.js # Read receipts UI
│   └── chat/                   # Chat-specific components
│       ├── MessageBubble.js
│       ├── InsightsModal.js    # AI cultural insights
│       ├── MemberListModal.js
│       └── EditGroupNameModal.js
├── store/                      # Zustand state management
│   ├── authStore.js            # Authentication state
│   ├── chatStore.js            # Chat/message state
│   └── notificationStore.js    # Notification state
├── utils/                      # Utility functions
│   ├── database.js             # SQLite cache
│   ├── networkMonitor.js       # Network monitoring
│   ├── notifications.js        # Push notifications
│   └── imageUtils.js           # Image handling
├── functions/                  # Firebase Cloud Functions
│   ├── src/
│   │   ├── translate.js        # Translation API
│   │   ├── detectLanguage.js   # Language detection
│   │   ├── explainIdioms.js    # Idiom explanations
│   │   ├── explainCulturalContext.js
│   │   ├── extractCulturalInsights.js
│   │   └── agentTools.js       # AI helper tools
│   └── index.js                # Function exports
├── firebaseConfig.js           # Firebase initialization
├── firestore.rules             # Security rules
└── package.json
```

## 🤖 Using AI Features

### Translation
In any chat, long-press a message to see translation options. The app will:
1. Auto-detect the source language
2. Translate to your preferred language
3. Show formality level (casual/neutral/formal)

### Cultural Insights
Tap the "Insights" button in group chats to extract:
- Key cultural references
- Idioms and their meanings
- Communication style analysis
- Conversation themes

### Language Detection
The app automatically detects message languages to provide contextual help.

### How It Works
All AI features use Firebase Cloud Functions to:
- Keep API keys secure (never exposed to the client)
- Implement rate limiting and caching
- Handle errors gracefully
- Log usage for monitoring


### Users Collection

```javascript
users/{userId}
  - displayName: string
  - email: string
  - online: boolean
  - lastSeen: timestamp
  - createdAt: timestamp
```

### Conversations Collection

```javascript
conversations/{conversationId}
  - participants: [userId1, userId2, ...]  // Array of user IDs
  - type: 'direct' | 'group'
  - name: string                           // For groups
  - lastMessage: {
      text: string,
      senderId: string,
      timestamp: timestamp
    }
  - updatedAt: timestamp
  - createdAt: timestamp

  messages/{messageId}                     // Subcollection
    - text: string
    - senderId: string
    - timestamp: timestamp
    - deliveredTo: [userId1, userId2, ...]
    - readBy: [userId1, userId2, ...]
    - status: 'sending' | 'sent' | 'delivered' | 'read'
```


### Real-Time Messaging
- [ ] User A sends message → appears on User B immediately
- [ ] User B replies → appears on User A immediately
- [ ] Rapid-fire messages (20+ quickly) maintain order
- [ ] Message ordering consistent across devices

### Persistence
- [ ] Send messages → force quit app → reopen → messages still there
- [ ] User A sends 5 messages → User B opens app → all 5 appear

### Offline Mode
- [ ] User A goes offline → User B sends messages → User A comes online → messages sync
- [ ] User A sends message offline → queued → comes online → message delivers
- [ ] App shows offline indicator when no network

### Presence
- [ ] User appears online when app is open
- [ ] User appears offline when app is closed
- [ ] "Last seen" timestamp updates correctly

### Read Receipts
- [ ] User A sends message → User B opens chat → checkmarks turn blue
- [ ] Group chat: checkmarks update as each user reads
- [ ] Single checkmark when sent
- [ ] Double grey when delivered to all
- [ ] Double blue when read by all

### Group Chat
- [ ] Create group with 3+ users
- [ ] All participants receive messages
- [ ] Sender names show in group messages
- [ ] Read receipts track all participants

### Foreground Notifications
- [ ] User B sends message → User A receives notification banner
- [ ] Tap notification → opens correct chat
- [ ] No notification for currently open chat

## 🛠️ Tech Stack

- **Frontend**: React Native 0.81.4 with React 19.1.0
- **Framework**: Expo SDK 54
- **Navigation**: Expo Router 6.0 (file-based routing)
- **State Management**: Zustand 5.0
- **Local Database**: Expo SQLite 16.0 (offline-first cache)
- **Backend**: Firebase
  - Firestore (Real-time database with long polling)
  - Authentication (Email/Password)
  - Cloud Functions (Node.js 22, Gen 2)
  - Storage (Profile photos, group photos, message images)
- **AI/ML**: 
  - OpenAI GPT-4o and GPT-4o-mini via @ai-sdk/openai
  - Vercel AI SDK for streaming and tool calling
- **Utilities**: date-fns, @react-native-community/netinfo, expo-notifications

## 🐛 Troubleshooting

### Functions Won't Deploy

**Error**: "Linting failed"
```bash
cd functions
npm run lint -- --fix
cd ..
firebase deploy --only functions
```

### Can't Connect to Emulators

**Error**: "Emulator connection refused"
- Make sure emulators are running: `npm run emulators`
- Check that `EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1` is in your `.env`
- For physical devices, use your computer's local IP instead of `127.0.0.1`

### Metro Bundler Errors

**Error**: "Unable to resolve module"
```bash
# Clear cache and reinstall
rm -rf node_modules
npm cache clean --force
npm install
npx expo start --clear
```

### Firestore Index Missing

**Error**: "The query requires an index"
- Click the link in the error message to auto-create the index
- Or manually create it in Firebase Console (see step 3e above)

### AI Features Not Working

**Checklist**:
- [ ] Functions deployed: `firebase functions:list`
- [ ] OpenAI API key set in `functions/.env`
- [ ] Check function logs: `firebase functions:log`
- [ ] Verify you have OpenAI credits: https://platform.openai.com/usage

---

## 💰 Cost Estimates (Free Tier Limits)

### Firebase (Free Spark Plan)
- **Firestore**: 50K reads/day, 20K writes/day, 20K deletes/day
- **Authentication**: Unlimited
- **Functions**: 2M invocations/month, 400K GB-seconds/month
- **Storage**: 5GB total, 1GB/day downloads

### OpenAI API
- **GPT-4o-mini**: ~$0.0015 per 10K input tokens, ~$0.006 per 10K output tokens
- **Typical translation**: ~$0.002 per message
- **Cultural insights**: ~$0.01 per conversation analysis
- **Budget recommendation**: $5-10/month for moderate testing

**Tip**: The app implements caching to minimize repeated AI calls.

---

## 📚 Additional Resources

- **Architecture Document**: See `architecture-updated.md` for detailed system design
- **Epic Planning**: Check `ai_planning/` directory for implementation phases
- **Firebase Console**: https://console.firebase.google.com/project/YOUR_PROJECT_ID
- **Expo Dashboard**: https://expo.dev/accounts/tbizzer/projects/react-messageai
- **OpenAI Platform**: https://platform.openai.com/usage

---

## 📄 License

This project was built as part of a university assignment for CS 4530 - Mobile AI Development.

---

## 🙋 Support

If you run into issues:
1. Check the **Troubleshooting** section above
2. Review Firebase Console logs
3. Check function logs: `firebase functions:log --limit 50`
4. Ensure all dependencies are installed: `npm install && cd functions && npm install`

**Common Quick Fixes**:
```bash
# Clear everything and start fresh
rm -rf node_modules functions/node_modules
npm install
cd functions && npm install && cd ..
npx expo start --clear
```


# MessageAI - WhatsApp-Style Messaging App

A production-quality messaging application built with React Native, Expo, and Firebase. Features real-time messaging, group chats, offline support, read receipts, and foreground notifications.

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
- Firestore offline persistence
- Network status monitoring
- Visual network status indicators

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Expo CLI**: `npm install -g expo-cli`
- **Xcode** (for iOS development) or **Android Studio** (for Android)
- A **Firebase** account

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd react-messageai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Setup

#### Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Once created, click on the web icon (</>) to add a web app
4. Copy the Firebase configuration object

#### Enable Firebase Services

1. **Authentication**:
   - Go to Authentication → Sign-in method
   - Enable "Email/Password" provider

2. **Firestore Database**:
   - Go to Firestore Database → Create database
   - Start in **production mode**
   - Choose a location close to your users

3. **Firestore Security Rules**:
   - Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read any user profile, write only their own
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    // Only conversation participants can read/write
    match /conversations/{conversationId} {
      allow read: if request.auth.uid in resource.data.participants;
      allow create: if request.auth.uid in request.resource.data.participants;
      allow update: if request.auth.uid in resource.data.participants;
      
      match /messages/{messageId} {
        allow read: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow create: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow update: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
    }
  }
}
```

4. **Create Firestore Indexes**:

You'll need to create a composite index for conversations. When you first run the app and try to load conversations, Firestore will log an error with a link to create the required index. Click that link or manually create:

- **Collection**: `conversations`
- **Fields**:
  - `participants` (Array)
  - `updatedAt` (Descending)

### 4. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp env.example .env
```

Edit `.env` and add your Firebase configuration:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 5. Run the Application

```bash
npm start
```

Then:
- Press `i` to open in iOS Simulator
- Press `a` to open in Android Emulator
- Scan the QR code with Expo Go app on your physical device

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
│   │   └── chat/
│   │       └── [id].js         # Chat screen
│   └── _layout.js              # Root layout
├── components/                 # Reusable components
│   ├── NetworkBanner.js        # Network status indicator
│   └── MessageNotification.js  # Foreground notifications
├── store/                      # Zustand state management
│   ├── authStore.js            # Authentication state
│   ├── chatStore.js            # Chat/message state
│   └── notificationStore.js    # Notification state
├── utils/                      # Utility functions
│   └── networkMonitor.js       # Network monitoring
├── firebaseConfig.js           # Firebase initialization
└── package.json
```

## 🔥 Firestore Data Schema

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

## 🧪 Testing Checklist

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

- **Frontend**: React Native 0.81.4
- **Framework**: Expo SDK 54
- **Navigation**: Expo Router 6.0
- **State Management**: Zustand 5.0
- **Backend**: Firebase
  - Firestore (Real-time database)
  - Authentication
  - Offline persistence
- **UI Libraries**: React Native Safe Area Context
- **Utilities**: date-fns, @react-native-community/netinfo

## 🐛 Troubleshooting

### Firebase Connection Issues

**Problem**: "Firebase: Error (auth/invalid-api-key)"
- **Solution**: Check that your `.env` file has correct Firebase credentials
- Ensure you're using `EXPO_PUBLIC_` prefix for environment variables

### Firestore Query Errors

**Problem**: "The query requires an index"
- **Solution**: Click the link in the error message to create the required index
- Or manually create composite index: `participants` (Array) + `updatedAt` (Descending)

### Simulator Not Showing Up

**Problem**: Expo can't find iOS simulator
- **Solution**: 
  ```bash
  # Make sure Xcode command line tools are installed
  xcode-select --install
  
  # Open Simulator app manually
  open -a Simulator
  ```

### Messages Not Syncing

**Problem**: Messages sent but not appearing on other devices
- **Solution**:
  - Check Firestore security rules are properly configured
  - Verify both users are authenticated
  - Check browser console for Firestore errors
  - Ensure the required Firestore index is created

### Metro Bundler Errors

**Problem**: "Unable to resolve module"
- **Solution**:
  ```bash
  # Clear cache and reinstall
  rm -rf node_modules
  npm cache clean --force
  npm install
  npx expo start --clear
  ```

## 📦 Dependencies

Key packages and versions:

```json
{
  "expo": "54.0.17",
  "react": "19.1.0",
  "react-native": "0.81.4",
  "expo-router": "^6.0.13",
  "firebase": "^12.4.0",
  "zustand": "^5.0.8",
  "@react-native-async-storage/async-storage": "2.2.0",
  "@react-native-community/netinfo": "^11.4.1",
  "date-fns": "^4.1.0"
}
```

## 🎨 Features Breakdown

### Optimistic UI Updates
Messages appear instantly when sent, then update with server confirmation. This provides a snappy, WhatsApp-like experience.

### Firestore Offline Persistence
Uses Firestore's built-in offline capabilities with `experimentalForceLongPolling`. Messages are cached locally and sync automatically when connection is restored.

### Network Monitoring
Real-time network status detection with visual banners. Users always know their connection state.

### Smart Notifications
Foreground notifications only appear for chats you're not currently viewing. Tap to navigate directly to the conversation.

### Read Receipt Logic
- Messages automatically marked as read when chat is opened
- Checkmarks update in real-time as recipients read messages
- Works identically in direct chats and groups

## 📄 License

This project is part of a coding challenge and is provided as-is for educational purposes.

## 🙏 Acknowledgments

- Built as part of the WhatsApp-style messaging app challenge
- Inspired by WhatsApp's clean, functional design
- Uses Firebase for backend infrastructure

---

**Built with ❤️ using React Native, Expo, and Firebase**


# Seeding Firebase Emulator with Test Data

This guide shows you how to populate the Firebase Emulator with test data for testing the Cultural Insights feature.

## Quick Start

1. **Start the Firebase Emulators:**
   ```bash
   firebase emulators:start
   ```

2. **In a new terminal, seed the data:**
   ```bash
   cd functions
   npm run seed
   ```

That's it! The emulator now has test users and a multilingual conversation ready to go.

## Test Accounts

| Email | Password | Language | Name |
|-------|----------|----------|------|
| `john@test.com` | `password123` | English | John Smith |
| `maria@test.com` | `password123` | Spanish | María García |
| `yuki@test.com` | `password123` | Japanese | Yuki Tanaka |

## What Gets Created

### 1. Three Test Users
- Each user has a different native language setting
- All users are members of the same group chat
- Language preferences are stored in Firestore

### 2. Multilingual Group Chat
- **Name:** "International Study Group 🌍"
- **Messages:** 27 messages mixing English, Spanish, and Japanese
- **Content includes:**
  - Cultural references (Día de los Muertos, お盆/Obon)
  - English idioms ("piece of cake", "break a leg", "over the moon")
  - Spanish idioms ("estar para chuparse los dedos", "estar en las nubes")
  - Japanese expressions (お疲れ様, 頑張って, おやすみなさい)
  - Different communication styles (Japanese politeness, Spanish warmth)

## Testing the Cultural Insights Feature

1. **Sign in** with any test account in your Expo app
2. **Open** the "International Study Group 🌍" conversation
3. **Tap** the 🧠 brain icon in the chat header
4. **Wait** ~5 seconds for the insights to generate
5. **View** personalized cultural insights!

### Expected Results by User

**John (English speaker) will see:**
- Explanations of Spanish idioms like "para chuparse los dedos"
- Japanese cultural references like お盆 (Obon festival)
- Japanese politeness patterns (お疲れ様です, ください)
- Spanish communication warmth

**María (Spanish speaker) will see:**
- English idioms like "break a leg" and "piece of cake"
- Japanese expressions and their meanings
- Cultural references from Japan (Obon)
- Differences in directness/politeness

**Yuki (Japanese speaker) will see:**
- English idioms and slang
- Spanish cultural references (Día de los Muertos)
- Western communication directness
- Spanish diminutives and expressions

## Clearing Test Data

If you want to start fresh, just **restart the emulators**:
```bash
# Stop emulators (Ctrl+C)
# Start again
firebase emulators:start
```

The emulator data is ephemeral and will be cleared on restart.

## Troubleshooting

### "User already exists" errors
- If you see these warnings, the script will skip creating the user and continue
- This is normal if you've run the seed script multiple times

### "Connection refused" errors
- Make sure the Firebase emulators are running first
- Check that ports 8080 (Firestore) and 9099 (Auth) are available

### No insights generated
- Ensure your OpenAI API key is set in `functions/.env`
- Check the functions logs in the emulator UI (http://localhost:4000)
- The conversation needs at least 10 messages (seed script creates 27)

### New messages don't appear after seeding
**Symptom**: After seeding data, you can see the conversation and old messages, but when you try to send a new message, it doesn't appear in the chat.

**Cause**: The app uses a SQLite cache for offline-first functionality. When you seed data directly into Firestore, the cache doesn't know about it, which can cause synchronization issues.

**Solutions**:
1. **Clear the SQLite cache** (Recommended):
   - In the app, go to the main chat list
   - Tap the menu button (⋮) in the top right
   - Select "Reset Database"
   - Confirm the reset
   - The app will reload all data from Firestore

2. **Force restart the app**:
   - Close the app completely
   - Reopen it
   - The cache should resync on startup

3. **Check debug logs**:
   - Look for these log patterns in the console:
     ```
     [sendMessage] Starting send for conversation <id>
     [sendMessage] Optimistic message added, new count: X
     [sendMessage] ✅ Message written to Firestore
     [subscribeToMessages] Firestore snapshot received
     [subscribeToMessages] ✅ State updated
     ```
   - If you don't see these logs, there may be a deeper issue with the subscription

## Manual Testing Alternative

If you prefer to create data manually:
1. Sign up 2-3 test accounts in the app
2. Create a group chat
3. Send 10+ messages in different languages
4. Test the insights feature

The seed script just automates this process with pre-written multilingual content!


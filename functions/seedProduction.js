/**
 * Seed script for PRODUCTION Firebase (not emulators)
 * Creates test users and conversations
 * 
 * USAGE: node seedProduction.js
 */

const admin = require("firebase-admin");

// Initialize Firebase Admin with service account
// Download service account key from Firebase Console:
// Project Settings → Service Accounts → Generate New Private Key
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

// Test users to create
const TEST_USERS = [
  {
    email: "test1@example.com",
    password: "password123",
    displayName: "Alice Chen",
  },
  {
    email: "test2@example.com",
    password: "password123",
    displayName: "Bob Martinez",
  },
  {
    email: "test3@example.com",
    password: "password123",
    displayName: "Charlie Smith",
  },
];

async function createTestUsers() {
  console.log("📝 Creating test users...");
  const userIds = [];

  for (const userData of TEST_USERS) {
    try {
      // Create Firebase Auth user
      const userRecord = await auth.createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
      });

      // Create Firestore user document
      await db.collection("users").doc(userRecord.uid).set({
        email: userData.email,
        displayName: userData.displayName,
        online: false,
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Created user: ${userData.email} (${userRecord.uid})`);
      userIds.push(userRecord.uid);
    } catch (error) {
      if (error.code === "auth/email-already-exists") {
        console.log(`⚠️  User already exists: ${userData.email}`);
        // Get existing user
        const userRecord = await auth.getUserByEmail(userData.email);
        userIds.push(userRecord.uid);
      } else {
        console.error(`❌ Error creating user ${userData.email}:`, error.message);
      }
    }
  }

  return userIds;
}

async function createTestConversations(userIds) {
  console.log("\n💬 Creating test conversations...");

  if (userIds.length < 2) {
    console.log("⚠️  Need at least 2 users to create conversations");
    return;
  }

  // Create 1-on-1 conversation between user 1 and user 2
  const directConvRef = await db.collection("conversations").add({
    type: "direct",
    participants: [userIds[0], userIds[1]],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessage: {
      text: "Hey, how are you?",
      senderId: userIds[0],
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      readBy: [userIds[0]],
    },
  });

  // Add a message to the direct conversation
  await directConvRef.collection("messages").add({
    text: "Hey, how are you?",
    senderId: userIds[0],
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    deliveredTo: [userIds[1]],
    readBy: [],
    deliveredReceipts: {
      [userIds[1]]: admin.firestore.FieldValue.serverTimestamp(),
    },
    readReceipts: {},
    status: "delivered",
  });

  console.log(`✅ Created direct conversation: ${directConvRef.id}`);

  // If we have 3+ users, create a group conversation
  if (userIds.length >= 3) {
    const groupConvRef = await db.collection("conversations").add({
      type: "group",
      name: "Test Group Chat",
      participants: userIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessage: {
        text: "Welcome to the group!",
        senderId: userIds[0],
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        readBy: [userIds[0]],
      },
    });

    // Add a message to the group conversation
    await groupConvRef.collection("messages").add({
      text: "Welcome to the group!",
      senderId: userIds[0],
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      deliveredTo: [userIds[1], userIds[2]],
      readBy: [],
      deliveredReceipts: {
        [userIds[1]]: admin.firestore.FieldValue.serverTimestamp(),
        [userIds[2]]: admin.firestore.FieldValue.serverTimestamp(),
      },
      readReceipts: {},
      status: "delivered",
    });

    console.log(`✅ Created group conversation: ${groupConvRef.id}`);
  }
}

async function seed() {
  console.log("🌱 Seeding production Firebase...\n");

  try {
    const userIds = await createTestUsers();
    await createTestConversations(userIds);

    console.log("\n✅ Seeding complete!");
    console.log("\n📱 Test credentials:");
    TEST_USERS.forEach((user) => {
      console.log(`   ${user.email} / ${user.password}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();


/**
 * Seed script for Firebase Emulator with test data
 * Run with: node seedEmulator.js
 */

require("dotenv").config();
const admin = require("firebase-admin");

// Initialize Firebase Admin for emulator
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

admin.initializeApp({
  projectId: "messageai-e0e9a",
});

const auth = admin.auth();
const db = admin.firestore();

// Test users with different language backgrounds
const testUsers = [
  {
    email: "john@test.com",
    password: "password123",
    displayName: "John Smith",
    defaultLanguage: "en",
  },
  {
    email: "maria@test.com",
    password: "password123",
    displayName: "María García",
    defaultLanguage: "es",
  },
  {
    email: "yuki@test.com",
    password: "password123",
    displayName: "Yuki Tanaka",
    defaultLanguage: "ja",
  },
];

// Multilingual test messages with cultural references and idioms
const testMessages = [
  {sender: 0, text: "Hey everyone! How's it going?", language: "en"},
  {sender: 1, text: "¡Hola! Todo bien, gracias. ¿Y tú?", language: "es"},
  {sender: 2, text: "こんにちは！元気です。", language: "ja"},
  {sender: 0, text: "I'm good! Just finished a project, feeling over the moon!",
    language: "en"},
  {sender: 1, text: "¡Qué bien! Yo también acabo de terminar un trabajo.",
    language: "es"},
  {sender: 2, text: "おめでとうございます！お疲れ様でした。", language: "ja"},
  {sender: 0, text: "Thanks! It was a piece of cake honestly.",
    language: "en"},
  {sender: 1, text: "Me alegro. Oye, ¿vamos a comer juntos mañana?",
    language: "es"},
  {sender: 2, text: "いいですね！何時がいいですか？", language: "ja"},
  {sender: 0, text: "I'm down! What time works for everyone?",
    language: "en"},
  {sender: 1, text: "¿Qué tal a las 2? Hay un restaurante que está para " +
    "chuparse los dedos.", language: "es"},
  {sender: 2, text: "2時は大丈夫です。楽しみにしています！", language: "ja"},
  {sender: 0, text: "Perfect! Break a leg with your presentation tomorrow, " +
    "Maria!", language: "en"},
  {sender: 1, text: "Gracias! Estoy un poco nerviosa, la verdad.",
    language: "es"},
  {sender: 2, text: "頑張ってください！きっとうまくいきますよ。", language: "ja"},
  {sender: 0, text: "You'll do great! Don't worry about it.",
    language: "en"},
  {sender: 1, text: "Gracias chicos. Oye, el otro día celebramos el " +
    "Día de los Muertos en mi familia.", language: "es"},
  {sender: 2, text: "それは興味深いですね。日本ではお盆がありますよ。",
    language: "ja"},
  {sender: 0, text: "That sounds really interesting! I'd love to learn more.",
    language: "en"},
  {sender: 1, text: "Es una tradición hermosa. Honramos a nuestros " +
    "antepasados.", language: "es"},
  {sender: 2, text: "お盆も似ています。先祖の霊を迎える行事です。",
    language: "ja"},
  {sender: 0, text: "It's fascinating how different cultures honor " +
    "their ancestors!", language: "en"},
  {sender: 1, text: "Sí! Cada cultura tiene sus propias costumbres.",
    language: "es"},
  {sender: 2, text: "そうですね。文化の違いは面白いです。", language: "ja"},
  {sender: 0, text: "Anyway, I've got to hit the hay. See you tomorrow!",
    language: "en"},
  {sender: 1, text: "¡Hasta mañana! Que duermas bien.", language: "es"},
  {sender: 2, text: "おやすみなさい！また明日！", language: "ja"},
];

/**
 * Seed the Firebase Emulator with test data
 * @return {Promise<void>} Promise that resolves when seeding is complete
 */
async function seedEmulator() {
  console.log("🌱 Starting emulator seed...\n");

  try {
    // Step 1: Create test users
    console.log("👥 Creating test users...");
    const userIds = [];

    for (const userData of testUsers) {
      try {
        // Create auth user
        const userRecord = await auth.createUser({
          email: userData.email,
          password: userData.password,
          displayName: userData.displayName,
        });

        userIds.push(userRecord.uid);
        console.log(`   ✓ Created user: ${userData.displayName} ` +
          `(${userData.email})`);

        // Create Firestore user document
        await db.collection("users").doc(userRecord.uid).set({
          email: userData.email,
          displayName: userData.displayName,
          photoURL: null,
          online: false,
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Set user language preference
        await db.collection("users").doc(userRecord.uid)
            .collection("settings").doc("preferences").set({
              defaultLanguage: userData.defaultLanguage,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

        console.log(`   ✓ Set language preference: ${userData.defaultLanguage}`);
      } catch (error) {
        if (error.code === "auth/email-already-exists") {
          console.log(`   ⚠ User ${userData.email} already exists, updating...`);
          // Get existing user
          const existing = await auth.getUserByEmail(userData.email);
          userIds.push(existing.uid);

          // Update Firestore user document to ensure consistency
          await db.collection("users").doc(existing.uid).set({
            email: userData.email,
            displayName: userData.displayName,
            photoURL: null,
            online: false,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});

          // Update user language preference
          await db.collection("users").doc(existing.uid)
              .collection("settings").doc("preferences").set({
                defaultLanguage: userData.defaultLanguage,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              }, {merge: true});

          console.log(`   ✓ Updated existing user with language: ${userData.defaultLanguage}`);
        } else {
          throw error;
        }
      }
    }

    console.log("\n");

    // Step 2: Create group conversation
    console.log("💬 Creating multilingual group conversation...");

    const conversationRef = db.collection("conversations").doc();
    const conversationId = conversationRef.id;

    await conversationRef.set({
      type: "group",
      name: "International Study Group 🌍",
      participants: userIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessage: {
        text: "おやすみなさい！また明日！",
        senderId: userIds[2],
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        readBy: [],
      },
    });

    console.log(`   ✓ Created conversation: ${conversationId}`);
    console.log("\n");

    // Step 3: Add multilingual messages
    console.log("📝 Adding test messages...");

    const messagesCollection = conversationRef.collection("messages");
    let messageCount = 0;

    for (const msg of testMessages) {
      const senderUid = userIds[msg.sender];
      // Use PAST timestamps (not future) to avoid issues with new message ordering
      // Subtract from current time so messages appear in the past
      const timestamp = admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - (testMessages.length - messageCount) * 60000), // 1 min apart, going backwards
      );

      // Build delivery receipts object for all participants except sender
      const deliveryReceipts = {};
      const readReceipts = {};
      userIds.filter((uid) => uid !== senderUid).forEach((uid) => {
        deliveryReceipts[uid] = timestamp;
        // Don't mark as read - let users mark messages as read naturally
      });

      await messagesCollection.add({
        text: msg.text,
        senderId: senderUid,
        timestamp: timestamp,
        deliveredTo: userIds.filter((uid) => uid !== senderUid), // All participants except sender
        readBy: [], // Start with empty - let users mark as read
        deliveredReceipts: deliveryReceipts,
        readReceipts: readReceipts,
        status: "sent", // Add status field for consistency
      });

      messageCount++;
    }

    console.log(`   ✓ Added ${messageCount} multilingual messages`);
    console.log("\n");

    // Step 4: Summary
    console.log("✅ Seed complete!\n");
    console.log("📋 Test Account Credentials:");
    console.log("   English user: john@test.com / password123");
    console.log("   Spanish user: maria@test.com / password123");
    console.log("   Japanese user: yuki@test.com / password123");
    console.log("\n");
    console.log("💡 Testing Tips:");
    console.log("   1. Sign in with any of the test accounts");
    console.log("   2. Open the 'International Study Group' conversation");
    console.log("   3. Tap the 🧠 icon to get cultural insights");
    console.log("   4. Each user will see personalized insights!");
    console.log("\n");
    console.log("🎯 Expected Insights:");
    console.log("   - Cultural references: Día de los Muertos, お盆, etc.");
    console.log("   - Idioms: 'piece of cake', 'break a leg', " +
      "'para chuparse los dedos'");
    console.log("   - Communication styles: Japanese politeness, " +
      "Spanish warmth");
    console.log("   - Language patterns: Japanese honorifics, Spanish diminutives");
    console.log("\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding emulator:", error);
    process.exit(1);
  }
}

// Run seed script
seedEmulator();


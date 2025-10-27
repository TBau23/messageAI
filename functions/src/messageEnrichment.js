const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");
const {detectLanguage, getLanguageName} = require("./languageDetect");

/**
 * Enrich messages with sender information and language detection
 * @param {Array} messages - Array of raw message objects
 * @param {string} conversationId - The conversation ID (for context)
 * @return {Promise<object>} Enriched messages with metadata
 */
async function enrichMessagesWithContext(messages, conversationId) {
  if (!messages || messages.length === 0) {
    return {
      enrichedMessages: [],
      participants: [],
      languagesDetected: [],
      dateRange: null,
      messageCount: 0,
    };
  }

  try {
    // Get unique sender IDs
    const senderIds = [...new Set(messages.map((msg) => msg.senderId))];

    // Fetch all participant user documents in parallel
    const userDocs = await Promise.all(
        senderIds.map((uid) =>
          admin.firestore().collection("users").doc(uid).get(),
        ),
    );

    // Build user data map
    const userData = {};
    const participants = [];

    userDocs.forEach((doc, index) => {
      const uid = senderIds[index];
      if (doc.exists) {
        const data = doc.data();
        userData[uid] = {
          displayName: data.displayName || "Unknown User",
          email: data.email || "",
          // Try to get user's default language from settings (if available)
          defaultLanguage: null, // Will fetch separately if needed
        };
        participants.push({
          uid,
          displayName: data.displayName || "Unknown User",
        });
      } else {
        // Handle deleted/missing users
        userData[uid] = {
          displayName: "Unknown User",
          email: "",
          defaultLanguage: null,
        };
        participants.push({
          uid,
          displayName: "Unknown User",
        });
      }
    });

    // Enrich each message with sender info and language detection
    const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          // Skip empty messages (image-only, etc.)
          if (!msg.text || msg.text.trim().length === 0) {
            return {
              id: msg.id,
              text: msg.text || "",
              senderId: msg.senderId,
              senderName: userData[msg.senderId]?.displayName || "Unknown User",
              timestamp: msg.timestamp,
              language: null,
              languageName: null,
              hasImage: !!msg.imageURL,
              isEmpty: true,
            };
          }

          // Detect language for non-empty messages
          const language = await detectLanguage(msg.text, "en");
          const languageName = getLanguageName(language);

          return {
            id: msg.id,
            text: msg.text,
            senderId: msg.senderId,
            senderName: userData[msg.senderId]?.displayName || "Unknown User",
            timestamp: msg.timestamp,
            language,
            languageName,
            hasImage: !!msg.imageURL,
            isEmpty: false,
          };
        }),
    );

    // Extract unique languages (excluding null)
    const languagesDetected = [
      ...new Set(
          enrichedMessages
              .filter((msg) => msg.language !== null)
              .map((msg) => msg.language),
      ),
    ];

    // Calculate date range
    const timestamps = messages
        .map((msg) => msg.timestamp?.toDate?.() || msg.timestamp)
        .filter((ts) => ts);

    let dateRange = null;
    if (timestamps.length > 0) {
      const dates = timestamps.map((ts) =>
        ts instanceof Date ? ts : new Date(ts),
      );
      const earliest = new Date(Math.min(...dates));
      const latest = new Date(Math.max(...dates));
      dateRange = {
        earliest: earliest.toISOString(),
        latest: latest.toISOString(),
      };
    }

    console.log(
        `[enrichMessagesWithContext] Enriched ${enrichedMessages.length} messages, ` +
      `${participants.length} participants, ` +
      `${languagesDetected.length} languages detected`,
    );

    return {
      enrichedMessages,
      participants,
      languagesDetected,
      dateRange,
      messageCount: enrichedMessages.length,
    };
  } catch (error) {
    console.error("[enrichMessagesWithContext] Error:", error);
    throw new HttpsError(
        "internal",
        `Failed to enrich messages: ${error.message}`,
    );
  }
}

/**
 * Get user's default language from settings
 * @param {string} uid - User ID
 * @return {Promise<string>} Language code (defaults to 'en')
 */
async function getUserDefaultLanguage(uid) {
  try {
    const settingsDoc = await admin.firestore()
        .collection("users")
        .doc(uid)
        .collection("settings")
        .doc("preferences")
        .get();

    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      return data.defaultLanguage || "en";
    }

    return "en"; // Default to English
  } catch (error) {
    console.error("[getUserDefaultLanguage] Error:", error);
    return "en"; // Fallback to English on error
  }
}

module.exports = {
  enrichMessagesWithContext,
  getUserDefaultLanguage,
};


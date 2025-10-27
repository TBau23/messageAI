const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");

/**
 * Retrieve messages from a conversation for analysis
 * @param {string} conversationId - The conversation ID
 * @param {number} limit - Maximum number of messages to retrieve (default: 100)
 * @return {Promise<Array>} Array of message objects
 * @throws {HttpsError} if conversation doesn't exist or retrieval fails
 */
async function retrieveConversationMessages(conversationId, limit = 100) {
  if (!conversationId || typeof conversationId !== "string") {
    throw new HttpsError(
        "invalid-argument",
        "Invalid conversation ID provided",
    );
  }

  try {
    // Verify conversation exists
    const conversationRef = admin.firestore()
        .collection("conversations")
        .doc(conversationId);

    const conversationDoc = await conversationRef.get();

    if (!conversationDoc.exists) {
      throw new HttpsError(
          "not-found",
          `Conversation ${conversationId} not found`,
      );
    }

    // Retrieve messages ordered by timestamp (most recent last)
    const messagesSnapshot = await conversationRef
        .collection("messages")
        .orderBy("timestamp", "asc")
        .limitToLast(limit)
        .get();

    if (messagesSnapshot.empty) {
      console.log(`[retrieveConversationMessages] No messages found in conversation ${conversationId}`);
      return [];
    }

    // Extract message data
    const messages = messagesSnapshot.docs.map((doc) => ({
      id: doc.id,
      text: doc.data().text || "",
      senderId: doc.data().senderId,
      timestamp: doc.data().timestamp,
      imageURL: doc.data().imageURL || null,
      // Include any other relevant fields
    }));

    const msgCount = messages.length;
    console.log(`[retrieveConversationMessages] Retrieved ` +
      `${msgCount} messages from conversation ${conversationId}`);

    return messages;
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error; // Re-throw HttpsErrors
    }

    console.error("[retrieveConversationMessages] Error:", error);
    throw new HttpsError(
        "internal",
        `Failed to retrieve messages: ${error.message}`,
    );
  }
}

/**
 * Get conversation metadata including participants
 * @param {string} conversationId - The conversation ID
 * @return {Promise<object>} Conversation metadata
 */
async function getConversationMetadata(conversationId) {
  try {
    const conversationDoc = await admin.firestore()
        .collection("conversations")
        .doc(conversationId)
        .get();

    if (!conversationDoc.exists) {
      throw new HttpsError(
          "not-found",
          `Conversation ${conversationId} not found`,
      );
    }

    const data = conversationDoc.data();

    return {
      id: conversationId,
      type: data.type || "direct",
      name: data.name || null,
      participants: data.participants || [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    console.error("[getConversationMetadata] Error:", error);
    throw new HttpsError(
        "internal",
        `Failed to get conversation metadata: ${error.message}`,
    );
  }
}

module.exports = {
  retrieveConversationMessages,
  getConversationMetadata,
};


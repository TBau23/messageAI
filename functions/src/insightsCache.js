const admin = require("firebase-admin");

/**
 * Cache management for conversation insights
 * Uses message count delta to determine if cache is still valid
 */

const CACHE_TTL_HOURS = 24; // Insights stay relevant longer than per-message translations
const MESSAGE_COUNT_THRESHOLD = 10; // Regenerate if 10+ new messages

/**
 * Get cached insights for a conversation and user
 * @param {string} conversationId - The conversation ID
 * @param {string} userId - The user ID
 * @param {number} currentMessageCount - Current message count
 * @param {string} userLanguage - User's language preference
 * @return {Promise<object|null>} Cached insights or null
 */
async function getCachedInsights(
    conversationId,
    userId,
    currentMessageCount,
    userLanguage,
) {
  try {
    const cacheRef = admin.firestore()
        .collection("conversationInsights")
        .doc(conversationId)
        .collection("userInsights")
        .doc(userId);

    const doc = await cacheRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    const cachedMessageCount = data.messageCount || 0;
    const cachedLanguage = data.userLanguage;
    const expiresAt = data.expiresAt?.toDate?.() || data.expiresAt;

    // Check if cache is expired
    if (expiresAt && new Date() > new Date(expiresAt)) {
      return null;
    }

    // Check if user's language preference changed
    if (cachedLanguage !== userLanguage) {
      return null;
    }

    // Check message count delta
    const messageCountDelta = currentMessageCount - cachedMessageCount;

    if (messageCountDelta >= MESSAGE_COUNT_THRESHOLD) {
      return null;
    }

    // Cache is valid!
    const createdAt = data.createdAt?.toDate?.() || data.createdAt;
    const cacheAge = createdAt ?
      Math.round((Date.now() - new Date(createdAt).getTime()) / 1000) :
      0;

    return {
      insights: data.insights,
      messageCount: cachedMessageCount,
      userLanguage: cachedLanguage,
      cacheAge,
    };
  } catch (error) {
    console.error("[getCachedInsights] Error:", error);
    return null; // Fail gracefully, just regenerate
  }
}

/**
 * Cache insights for a conversation and user
 * @param {string} conversationId - The conversation ID
 * @param {string} userId - The user ID
 * @param {number} messageCount - Number of messages analyzed
 * @param {string} userLanguage - User's language preference
 * @param {object} insights - The insights data to cache
 * @return {Promise<void>} Promise that resolves when cache is set
 */
async function setCachedInsights(
    conversationId,
    userId,
    messageCount,
    userLanguage,
    insights,
) {
  try {
    const cacheRef = admin.firestore()
        .collection("conversationInsights")
        .doc(conversationId)
        .collection("userInsights")
        .doc(userId);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);

    await cacheRef.set({
      insights,
      messageCount,
      userLanguage,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
    });

  } catch (error) {
    console.error("[setCachedInsights] Error:", error);
    // Don't throw - caching failure shouldn't break the feature
  }
}

/**
 * Clear cache for a specific conversation
 * @param {string} conversationId - The conversation ID
 * @return {Promise<void>} Promise that resolves when cache is cleared
 */
async function clearConversationCache(conversationId) {
  try {
    const cacheRef = admin.firestore()
        .collection("conversationInsights")
        .doc(conversationId)
        .collection("userInsights");

    const snapshot = await cacheRef.get();

    if (snapshot.empty) {
      return;
    }

    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

  } catch (error) {
    console.error("[clearConversationCache] Error:", error);
  }
}

module.exports = {
  getCachedInsights,
  setCachedInsights,
  clearConversationCache,
  CACHE_TTL_HOURS,
  MESSAGE_COUNT_THRESHOLD,
};


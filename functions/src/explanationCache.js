const admin = require("firebase-admin");
const {Timestamp} = require("firebase-admin/firestore");
const crypto = require("crypto");

/**
 * Create a cache key from explanation parameters
 * @param {string} text - Message text
 * @param {string} type - Explanation type ('idioms' or 'cultural')
 * @param {string} language - Detected language code
 * @return {string} Hash to use as cache key
 */
function createExplanationCacheKey(text, type, language) {
  const normalized = text.trim().toLowerCase();
  const data = `${normalized}|${type}|${language}`;
  return crypto.createHash("md5").update(data).digest("hex");
}

/**
 * Get cached explanation if it exists and is not expired
 * @param {string} text - Message text
 * @param {string} type - Explanation type ('idioms' or 'cultural')
 * @param {string} language - Detected language code
 * @return {Promise<object|null>} Cached explanation or null
 */
async function getCachedExplanation(text, type, language) {
  const cacheKey = createExplanationCacheKey(text, type, language);

  try {
    const cacheRef = admin.firestore()
        .collection("explanationCache")
        .doc(cacheKey);

    const doc = await cacheRef.get();

    if (!doc.exists) {
      return null;
    }

    const cached = doc.data();

    // Check if cache is expired (30 days TTL)
    const now = Date.now();
    const createdAtMs = (cached.createdAt && cached.createdAt.toMillis) ?
      cached.createdAt.toMillis() : 0;
    const ageInDays = (now - createdAtMs) / (1000 * 60 * 60 * 24);

    if (ageInDays > 30) {
      // Delete expired cache entry
      await cacheRef.delete();
      return null;
    }


    return {
      hasContent: cached.hasContent,
      explanation: cached.explanation,
      language: cached.language,
      type: cached.type,
      cached: true,
      cacheAge: ageInDays,
    };
  } catch (error) {
    console.error("[explanationCache] Error reading cache:", error);
    return null; // Don't fail if cache read fails
  }
}

/**
 * Store explanation in cache
 * @param {string} text - Message text
 * @param {string} type - Explanation type ('idioms' or 'cultural')
 * @param {string} language - Detected language code
 * @param {boolean} hasContent - Whether explanation has content
 * @param {string|null} explanation - Explanation text or null
 * @return {Promise<void>} Promise that resolves when cache is written
 */
async function setCachedExplanation(text, type, language, hasContent, explanation) {
  const cacheKey = createExplanationCacheKey(text, type, language);

  try {
    const cacheRef = admin.firestore()
        .collection("explanationCache")
        .doc(cacheKey);

    await cacheRef.set({
      messageText: text.trim(),
      type,
      language,
      hasContent,
      explanation: explanation || null,
      createdAt: Timestamp.now(),
      accessCount: 1,
      lastAccessed: Timestamp.now(),
    });

    console.log("[explanationCache] Cached explanation:", cacheKey, `hasContent: ${hasContent}`);
  } catch (error) {
    console.error("[explanationCache] Error writing cache:", error);
    // Don't throw - caching failure shouldn't break the explanation
  }
}

module.exports = {
  createExplanationCacheKey,
  getCachedExplanation,
  setCachedExplanation,
};


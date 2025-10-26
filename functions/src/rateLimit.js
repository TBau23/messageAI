const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");

// Daily limits per feature type
const LIMITS = {
  translations: 100,
  explanations: 50,
  extractions: 5,
  detections: 1000, // Language detection is lightweight, allow high volume
};

/**
 * Check and increment rate limit for a user and feature type
 * @param {string} uid - User ID
 * @param {string} featureType - Type of feature (translations, explanations, extractions)
 * @return {Promise<{remaining: number}>}
 * @throws {HttpsError} if rate limit exceeded
 */
async function checkRateLimit(uid, featureType) {
  if (!LIMITS[featureType]) {
    throw new Error(`Invalid feature type: ${featureType}`);
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const usageRef = admin.firestore()
      .collection("users")
      .doc(uid)
      .collection("aiUsage")
      .doc(today);

  try {
    const doc = await usageRef.get();
    const usage = doc.exists ? doc.data() : {};
    const count = usage[featureType] || 0;

    // Check if limit exceeded
    if (count >= LIMITS[featureType]) {
      throw new HttpsError(
          "resource-exhausted",
          `Daily ${featureType} limit reached (${LIMITS[featureType]}). Resets at midnight UTC.`,
      );
    }

    // Increment usage atomically
    await usageRef.set({
      [featureType]: FieldValue.increment(1),
      lastUpdated: FieldValue.serverTimestamp(),
    }, {merge: true});

    const remaining = LIMITS[featureType] - count - 1;
    console.log(`[rateLimit] User ${uid} - ${featureType}: ${count + 1}/${LIMITS[featureType]} (${remaining} remaining)`);

    return {remaining};
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error; // Re-throw rate limit errors
    }
    console.error("[rateLimit] Error:", error);
    throw new HttpsError("internal", "Rate limit check failed");
  }
}

/**
 * Get current usage for a user
 * @param {string} uid - User ID
 * @return {Promise<{usage: object, limits: object}>}
 */
async function getUserUsage(uid) {
  const today = new Date().toISOString().split("T")[0];
  const usageRef = admin.firestore()
      .collection("users")
      .doc(uid)
      .collection("aiUsage")
      .doc(today);

  try {
    const doc = await usageRef.get();
    const usage = doc.exists ? doc.data() : {};

    return {
      usage: {
        translations: usage.translations || 0,
        explanations: usage.explanations || 0,
        extractions: usage.extractions || 0,
        detections: usage.detections || 0,
      },
      limits: LIMITS,
      remaining: {
        translations: LIMITS.translations - (usage.translations || 0),
        explanations: LIMITS.explanations - (usage.explanations || 0),
        extractions: LIMITS.extractions - (usage.extractions || 0),
        detections: LIMITS.detections - (usage.detections || 0),
      },
      date: today,
    };
  } catch (error) {
    console.error("[getUserUsage] Error:", error);
    throw new HttpsError("internal", "Failed to get usage data");
  }
}

module.exports = {
  checkRateLimit,
  getUserUsage,
  LIMITS,
};


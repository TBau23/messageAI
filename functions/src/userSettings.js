const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");

/**
 * Update user's AI-related settings (language preferences, etc.)
 */
exports.updateUserSettings = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const uid = request.auth.uid;
  const {defaultLanguage} = request.data;

  // Validate language code
  const validLanguages = ["en", "es", "fr", "zh", "ja", "ar"];
  if (defaultLanguage && !validLanguages.includes(defaultLanguage)) {
    throw new HttpsError("invalid-argument", "Invalid language code");
  }

  try {
    const settingsRef = admin.firestore()
        .collection("users")
        .doc(uid)
        .collection("settings")
        .doc("preferences");

    await settingsRef.set({
      defaultLanguage: defaultLanguage || "en",
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, {merge: true});

    console.log(`[updateUserSettings] User ${uid} updated language to ${defaultLanguage}`);

    return {
      success: true,
      settings: {defaultLanguage},
    };
  } catch (error) {
    console.error("[updateUserSettings] Error:", error);
    throw new HttpsError("internal", "Failed to update settings");
  }
});

/**
 * Get user's AI-related settings
 */
exports.getUserSettings = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const uid = request.auth.uid;

  try {
    const settingsRef = admin.firestore()
        .collection("users")
        .doc(uid)
        .collection("settings")
        .doc("preferences");

    const doc = await settingsRef.get();

    if (!doc.exists) {
      // Return defaults
      return {
        success: true,
        settings: {
          defaultLanguage: "en",
        },
      };
    }

    return {
      success: true,
      settings: doc.data(),
    };
  } catch (error) {
    console.error("[getUserSettings] Error:", error);
    throw new HttpsError("internal", "Failed to get settings");
  }
});


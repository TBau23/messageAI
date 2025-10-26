const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {detectLanguage, getLanguageName} = require("./languageDetect");

/**
 * Detect the language of a message
 * Lightweight function with NO rate limiting (uses local library, not AI)
 */
exports.detectMessageLanguage = onCall({
  timeoutSeconds: 10,
  memory: "256MiB",
}, async (request) => {
  // Authentication check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const uid = request.auth.uid;

  // Validate input
  const {text} = request.data;
  if (!text || typeof text !== "string") {
    throw new HttpsError("invalid-argument", "Missing required field: text");
  }

  if (text.length > 2000) {
    throw new HttpsError("invalid-argument",
        `Text too long (${text.length} characters). Maximum: 2000`);
  }

  // If text is too short, return English as default
  if (text.trim().length < 10) {
    return {
      success: true,
      language: "en",
      languageName: "English",
      confidence: "low",
      reason: "Text too short for reliable detection",
    };
  }

  const startTime = Date.now();

  try {
    // Detect language using franc-min (local, no API cost)
    const detectedLanguage = await detectLanguage(text, "en");
    const languageName = getLanguageName(detectedLanguage);
    const responseTime = Date.now() - startTime;

    console.log(`[detectMessageLanguage] User: ${uid}, ` +
        `Detected: ${detectedLanguage} (${languageName}), ` +
        `Time: ${responseTime}ms`);

    return {
      success: true,
      language: detectedLanguage,
      languageName,
      confidence: "high",
      metadata: {
        responseTime,
        textLength: text.length,
      },
    };
  } catch (error) {
    console.error("[detectMessageLanguage] Error:", error);
    // Fallback to English on error
    return {
      success: true,
      language: "en",
      languageName: "English",
      confidence: "low",
      error: error.message,
    };
  }
});

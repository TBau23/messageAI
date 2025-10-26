const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {checkRateLimit} = require("./rateLimit");

/**
 * Create a standardized AI function with auth, rate limiting, and error handling
 *
 * @param {string} featureType - Rate limit category (translations, explanations, extractions)
 * @param {Function} handler - Async function that implements the AI logic
 *   Handler receives: (request, context) where context includes { uid, rateLimitRemaining }
 *   Handler should return: object with result data
 * @return {Function} Firebase callable function
 *
 * @example
 * exports.myAIFunction = createAIFunction('translations', async (request, context) => {
 *   const { text } = request.data;
 *   const result = await doSomethingWithAI(text);
 *   return { result };
 * });
 */
function createAIFunction(featureType, handler) {
  return onCall({
    timeoutSeconds: 60, // Allow up to 60 seconds for AI operations
    memory: "512MiB", // Adequate memory for AI SDK operations
  }, async (request) => {
    const startTime = Date.now();

    // 1. Authentication check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const uid = request.auth.uid;
    console.log(`[${featureType}] Request from user: ${uid}`);

    try {
      // 2. Rate limiting check
      const {remaining} = await checkRateLimit(uid, featureType);

      // 3. Execute AI operation
      const result = await handler(request, {uid, rateLimitRemaining: remaining});

      // 4. Log success metrics
      const duration = Date.now() - startTime;
      console.log(`[${featureType}] Success in ${duration}ms - Quota remaining: ${remaining}`);

      return {
        success: true,
        ...result,
        quotaRemaining: remaining,
        responseTime: duration,
      };
    } catch (error) {
      // Log error details
      const duration = Date.now() - startTime;
      console.error(`[${featureType}] Error after ${duration}ms:`, error);

      // Re-throw HttpsErrors (including rate limit errors)
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError(
          "internal",
          `${featureType} operation failed: ${error.message}`,
      );
    }
  });
}

/**
 * Validate required parameters in request data
 * @param {object} data - Request data object
 * @param {string[]} requiredFields - Array of required field names
 * @throws {HttpsError} if validation fails
 */
function validateRequest(data, requiredFields) {
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      throw new HttpsError(
          "invalid-argument",
          `Missing required field: ${field}`,
      );
    }
  }
}

/**
 * Validate text length
 * @param {string} text - Text to validate
 * @param {number} maxLength - Maximum allowed length
 * @throws {HttpsError} if text is too long
 */
function validateTextLength(text, maxLength = 5000) {
  if (text.length > maxLength) {
    throw new HttpsError(
        "invalid-argument",
        `Text too long (${text.length} characters). Maximum: ${maxLength}`,
    );
  }
}

module.exports = {
  createAIFunction,
  validateRequest,
  validateTextLength,
};


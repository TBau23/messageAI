const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getUserUsage } = require('./rateLimit');

/**
 * Get current AI usage and quota information for the user
 */
exports.getAIUsage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  try {
    const usageData = await getUserUsage(request.auth.uid);
    return {
      success: true,
      ...usageData
    };
  } catch (error) {
    console.error('[getAIUsage] Error:', error);
    throw new HttpsError('internal', 'Failed to get usage data');
  }
});


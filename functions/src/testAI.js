const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {openai} = require("@ai-sdk/openai");
const {generateText} = require("ai");

exports.testAI = onCall(async (request) => {
  // Verify authenticated user
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  try {
    console.log(`[testAI] User ${request.auth.uid} testing AI connection`);

    const {text} = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: "Say hello in 3 languages (English, Spanish, French)",
    });

    console.log(`[testAI] Success! Response: ${text}`);

    return {
      success: true,
      result: text,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[testAI] Error:", error);
    throw new HttpsError("internal", `AI call failed: ${error.message}`);
  }
});


const {openai} = require("@ai-sdk/openai");
const {generateText} = require("ai");
const {createAIFunction, validateRequest, validateTextLength} = require("./template");
const {detectLanguage, getLanguageName} = require("./languageDetect");
const {logAIRequest, logAIResponse} = require("./logger");
const {getCachedExplanation, setCachedExplanation} = require("./explanationCache");

/**
 * Explain cultural context, social norms, and etiquette in a message
 * Focuses on why/how phrases are used in specific cultures
 */
exports.explainCulturalContext = createAIFunction("explanations", async (request, context) => {
  // Validate input
  validateRequest(request.data, ["text"]);

  const {text} = request.data;
  const {uid} = context;

  // Validate text length (allow up to 2000 chars for explanations)
  validateTextLength(text, 2000);

  // Skip if text is too short to analyze
  if (text.trim().length < 5) {
    return {
      hasContext: false,
      explanation: null,
      message: "Text too short to analyze for cultural context",
    };
  }

  // Auto-detect language
  const language = await detectLanguage(text);
  const languageName = getLanguageName(language);

  // Check cache first
  const startTime = Date.now();
  const cached = await getCachedExplanation(text, "cultural", language);

  if (cached) {
    const cacheResponseTime = Date.now() - startTime;
    console.log(`[explainCulturalContext] Cache hit - Response time: ${cacheResponseTime}ms`);

    return {
      hasContext: cached.hasContent,
      explanation: cached.explanation,
      language,
      languageName,
      cached: true,
      metadata: {
        responseTime: cacheResponseTime,
        cacheAge: cached.cacheAge,
        fromCache: true,
      },
    };
  }

  logAIRequest("explainCulturalContext", uid, {
    textLength: text.length,
    language,
    languageName,
  });

  // Build prompt for cultural context analysis
  const prompt = `You are a cultural communication expert analyzing text for cultural context and social nuances.

Analyze the following ${languageName} text for cultural context, social norms, formality levels, and etiquette.

IMPORTANT: Keep your response CONCISE and BRIEF (2-4 sentences max).

Briefly explain:
1. How this is used in ${languageName} culture
2. Formality/politeness level
3. When appropriate to use
4. Potential cross-cultural notes if relevant

If generic text with NO significant cultural context (like "Hello"), respond with exactly: "NO_CONTEXT_FOUND"

Text to analyze:
${text}`;

  try {
    const {text: response, usage} = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      temperature: 0.5, // Slightly higher for more natural explanations
      maxTokens: 200, // Keep responses brief
    });

    const responseTime = Date.now() - startTime;
    const totalTokens = (usage && usage.totalTokens) || 0;

    // Check if no cultural context was found
    const trimmedResponse = response.trim();
    const hasContext = !trimmedResponse.includes("NO_CONTEXT_FOUND") &&
      trimmedResponse.length > 0;
    const explanation = hasContext ? trimmedResponse : null;

    logAIResponse("explainCulturalContext", responseTime, totalTokens, {
      language,
      textLength: text.length,
      hasContext,
      explanationLength: (explanation && explanation.length) || 0,
    });

    // Store in cache for future use
    await setCachedExplanation(
        text, "cultural", language, hasContext, explanation);

    return {
      hasContext,
      explanation,
      language,
      languageName,
      cached: false,
      metadata: {
        responseTime,
        tokensUsed: totalTokens,
        sourceLength: text.length,
        fromCache: false,
      },
    };
  } catch (error) {
    console.error("[explainCulturalContext] OpenAI API error:", error);
    const errMsg = `Cultural context explanation failed: ${error.message}`;
    throw new Error(errMsg);
  }
});


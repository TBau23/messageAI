const { openai } = require('@ai-sdk/openai');
const { generateText } = require('ai');
const { createAIFunction, validateRequest, validateTextLength } = require('./template');
const { detectLanguage, getLanguageName } = require('./languageDetect');
const { logAIRequest, logAIResponse } = require('./logger');
const { getCachedExplanation, setCachedExplanation } = require('./explanationCache');

/**
 * Explain idioms, slang, and expressions in a message
 * Focuses on literal vs. figurative meaning and regional/cultural context
 */
exports.explainIdioms = createAIFunction('explanations', async (request, context) => {
  // Validate input
  validateRequest(request.data, ['text']);
  
  const { text } = request.data;
  const { uid } = context;
  
  // Validate text length (allow up to 2000 chars for explanations)
  validateTextLength(text, 2000);
  
  // Skip if text is too short to contain idioms
  if (text.trim().length < 5) {
    return {
      hasIdioms: false,
      explanation: null,
      message: 'Text too short to analyze for idioms'
    };
  }
  
  // Auto-detect language
  const language = await detectLanguage(text);
  const languageName = getLanguageName(language);
  
  // Check cache first
  const startTime = Date.now();
  const cached = await getCachedExplanation(text, 'idioms', language);
  
  if (cached) {
    const cacheResponseTime = Date.now() - startTime;
    console.log(`[explainIdioms] Cache hit - Response time: ${cacheResponseTime}ms`);
    
    return {
      hasIdioms: cached.hasContent,
      explanation: cached.explanation,
      language,
      languageName,
      cached: true,
      metadata: {
        responseTime: cacheResponseTime,
        cacheAge: cached.cacheAge,
        fromCache: true
      }
    };
  }
  
  logAIRequest('explainIdioms', uid, {
    textLength: text.length,
    language,
    languageName
  });
  
  // Build prompt for idiom analysis
  const prompt = `You are an expert linguist analyzing text for idioms, slang, and figurative expressions.

Analyze the following ${languageName} text and identify any idioms, slang, colloquialisms, or figurative expressions.

IMPORTANT: Keep your response CONCISE and BRIEF (2-3 sentences max).

For each idiom found:
1. Name the phrase
2. Brief literal meaning
3. What it actually means
4. Quick cultural note if relevant

If NO idioms found, respond with exactly: "NO_IDIOMS_FOUND"

Text to analyze:
${text}`;

  try {
    const { text: response, usage } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      temperature: 0.5, // Slightly higher for more natural explanations
      maxTokens: 200, // Keep responses brief
    });
    
    const responseTime = Date.now() - startTime;
    const totalTokens = (usage && usage.totalTokens) || 0;
    
    // Check if no idioms were found
    const trimmedResponse = response.trim();
    const hasIdioms = !trimmedResponse.includes("NO_IDIOMS_FOUND") &&
      trimmedResponse.length > 0;
    const explanation = hasIdioms ? trimmedResponse : null;
    
    logAIResponse("explainIdioms", responseTime, totalTokens, {
      language,
      textLength: text.length,
      hasIdioms,
      explanationLength: (explanation && explanation.length) || 0,
    });
    
    // Store in cache for future use
    await setCachedExplanation(
        text, "idioms", language, hasIdioms, explanation);
    
    return {
      hasIdioms,
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
    console.error("[explainIdioms] OpenAI API error:", error);
    throw new Error(`Idiom explanation failed: ${error.message}`);
  }
});


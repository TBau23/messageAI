const { openai } = require('@ai-sdk/openai');
const { generateText } = require('ai');
const { createAIFunction, validateRequest, validateTextLength } = require('./template');
const { detectLanguage, getLanguageName } = require('./languageDetect');
const { logAIRequest, logAIResponse } = require('./logger');
const { getCachedTranslation, setCachedTranslation } = require('./translationCache');

/**
 * Translate text with formality adjustment
 * Combines translation and tone adjustment in a single API call
 */
exports.translateText = createAIFunction('translations', async (request, context) => {
  // Validate input
  validateRequest(request.data, ['text', 'targetLanguage']);
  
  const { text, targetLanguage, formality = 'neutral' } = request.data;
  const { uid } = context;
  
  // Validate text length
  validateTextLength(text, 5000);
  
  // Validate formality level
  const validFormality = ['casual', 'neutral', 'formal'];
  if (!validFormality.includes(formality)) {
    throw new Error(`Invalid formality level. Must be: ${validFormality.join(', ')}`);
  }
  
  // Validate target language
  const validLanguages = ['en', 'es', 'fr', 'zh', 'ja', 'ar'];
  if (!validLanguages.includes(targetLanguage)) {
    throw new Error(`Unsupported target language: ${targetLanguage}`);
  }
  
  // Auto-detect source language
  const sourceLanguage = await detectLanguage(text);
  
  // Skip translation if source and target are the same
  if (sourceLanguage === targetLanguage) {
    return {
      translatedText: text,
      sourceLanguage,
      targetLanguage,
      formality,
      skipped: true,
      message: 'Source and target languages are the same'
    };
  }
  
  // Check cache first
  const startTime = Date.now();
  const cached = await getCachedTranslation(text, targetLanguage, formality);
  
  if (cached) {
    const cacheResponseTime = Date.now() - startTime;
    console.log(`[translateText] Cache hit - Response time: ${cacheResponseTime}ms`);
    
    return {
      translatedText: cached.translatedText,
      sourceLanguage: cached.sourceLanguage,
      targetLanguage: cached.targetLanguage,
      formality: cached.formality,
      skipped: false,
      cached: true,
      metadata: {
        responseTime: cacheResponseTime,
        cacheAge: cached.cacheAge,
        fromCache: true
      }
    };
  }
  
  logAIRequest('translateText', uid, {
    textLength: text.length,
    sourceLanguage,
    targetLanguage,
    formality
  });
  
  // Build prompt that combines translation and formality adjustment
  const formalityInstructions = {
    casual: 'Use casual, conversational language. Use contractions and informal expressions.',
    neutral: 'Use neutral, standard language. Neither too formal nor too casual.',
    formal: 'Use formal, professional language. Avoid contractions and slang.'
  };
  
  const targetLanguageName = getLanguageName(targetLanguage);
  const sourceLanguageName = getLanguageName(sourceLanguage);
  
  const prompt = `Translate the following text from ${sourceLanguageName} to ${targetLanguageName}.

Formality level: ${formality.toUpperCase()}
${formalityInstructions[formality]}

IMPORTANT: Return ONLY the translated text, nothing else. No explanations, no labels, no extra text.

Text to translate:
${text}`;

  try {
    const { text: translatedText, usage } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      temperature: 0.3, // Lower temperature for more consistent translations
    });
    
    const responseTime = Date.now() - startTime;
    const totalTokens = (usage && usage.totalTokens) || 0;
    
    logAIResponse('translateText', responseTime, totalTokens, {
      sourceLanguage,
      targetLanguage,
      formality,
      textLength: text.length,
      translatedLength: translatedText.length
    });
    
    const trimmedTranslation = translatedText.trim();
    
    // Store in cache for future use
    await setCachedTranslation(text, trimmedTranslation, sourceLanguage, targetLanguage, formality);
    
    return {
      translatedText: trimmedTranslation,
      sourceLanguage,
      targetLanguage,
      formality,
      skipped: false,
      cached: false,
      metadata: {
        responseTime,
        tokensUsed: totalTokens,
        sourceLength: text.length,
        translatedLength: trimmedTranslation.length,
        fromCache: false
      }
    };
  } catch (error) {
    console.error('[translateText] OpenAI API error:', error);
    throw new Error(`Translation failed: ${error.message}`);
  }
});


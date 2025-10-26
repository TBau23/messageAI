const { createAIFunction, validateRequest, validateTextLength } = require('./template');
const { detectLanguage, getLanguageName } = require('./languageDetect');

/**
 * Detect the language of a message
 * Lightweight function with generous rate limiting (1000/day)
 */
exports.detectMessageLanguage = createAIFunction('detections', async (request, context) => {
  // Validate input
  validateRequest(request.data, ['text']);
  
  const { text } = request.data;
  const { uid } = context;
  
  // Validate text length (reasonable limit for language detection)
  validateTextLength(text, 2000);
  
  // If text is too short, return English as default
  if (!text || text.trim().length < 10) {
    return {
      language: 'en',
      languageName: 'English',
      confidence: 'low',
      reason: 'Text too short for reliable detection'
    };
  }
  
  const startTime = Date.now();
  
  try {
    // Detect language using franc-min
    const detectedLanguage = await detectLanguage(text, 'en');
    const languageName = getLanguageName(detectedLanguage);
    const responseTime = Date.now() - startTime;
    
    console.log(`[detectMessageLanguage] User: ${uid}, Detected: ${detectedLanguage} (${languageName}), Time: ${responseTime}ms`);
    
    return {
      language: detectedLanguage,
      languageName,
      confidence: 'high',
      metadata: {
        responseTime,
        textLength: text.length
      }
    };
  } catch (error) {
    console.error('[detectMessageLanguage] Error:', error);
    // Fallback to English on error
    return {
      language: 'en',
      languageName: 'English',
      confidence: 'low',
      error: error.message
    };
  }
});


const admin = require('firebase-admin');
const { Timestamp, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

/**
 * Create a cache key from translation parameters
 * @param {string} text - Source text
 * @param {string} targetLanguage - Target language code
 * @param {string} formality - Formality level
 * @returns {string} Hash to use as cache key
 */
function createCacheKey(text, targetLanguage, formality) {
  const normalized = text.trim().toLowerCase();
  const data = `${normalized}|${targetLanguage}|${formality}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Get cached translation if it exists and is not expired
 * @param {string} text - Source text
 * @param {string} targetLanguage - Target language code
 * @param {string} formality - Formality level
 * @returns {Promise<object|null>} Cached translation or null
 */
async function getCachedTranslation(text, targetLanguage, formality) {
  const cacheKey = createCacheKey(text, targetLanguage, formality);
  
  try {
    const cacheRef = admin.firestore()
      .collection('translationCache')
      .doc(cacheKey);
    
    const doc = await cacheRef.get();
    
    if (!doc.exists) {
      console.log('[translationCache] Cache miss:', cacheKey);
      return null;
    }
    
    const cached = doc.data();
    
    // Check if cache is expired (7 days TTL)
    const now = Date.now();
    const createdAtMs = (cached.createdAt && cached.createdAt.toMillis) ?
      cached.createdAt.toMillis() : 0;
    const ageInDays = (now - createdAtMs) / (1000 * 60 * 60 * 24);
    
    if (ageInDays > 7) {
      console.log('[translationCache] Cache expired:', cacheKey, `(${ageInDays.toFixed(1)} days old)`);
      // Delete expired cache entry
      await cacheRef.delete();
      return null;
    }
    
    console.log('[translationCache] Cache hit:', cacheKey, `(${ageInDays.toFixed(1)} days old)`);
    
    return {
      translatedText: cached.translatedText,
      sourceLanguage: cached.sourceLanguage,
      targetLanguage: cached.targetLanguage,
      formality: cached.formality,
      cached: true,
      cacheAge: ageInDays
    };
  } catch (error) {
    console.error('[translationCache] Error reading cache:', error);
    return null; // Don't fail if cache read fails
  }
}

/**
 * Store translation in cache
 * @param {string} text - Source text
 * @param {string} translatedText - Translated text
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code
 * @param {string} formality - Formality level
 * @returns {Promise<void>}
 */
async function setCachedTranslation(text, translatedText, sourceLanguage, targetLanguage, formality) {
  const cacheKey = createCacheKey(text, targetLanguage, formality);
  
  try {
    const cacheRef = admin.firestore()
      .collection('translationCache')
      .doc(cacheKey);
    
    await cacheRef.set({
      sourceText: text.trim(),
      translatedText: translatedText.trim(),
      sourceLanguage,
      targetLanguage,
      formality,
      createdAt: Timestamp.now(),
      accessCount: 1,
      lastAccessed: Timestamp.now(),
    });
    
    console.log('[translationCache] Cached translation:', cacheKey);
  } catch (error) {
    console.error('[translationCache] Error writing cache:', error);
    // Don't throw - caching failure shouldn't break the translation
  }
}

/**
 * Update cache access metrics (optional - for analytics)
 * @param {string} cacheKey - Cache document ID
 */
async function incrementCacheAccess(cacheKey) {
  try {
    const cacheRef = admin.firestore()
      .collection('translationCache')
      .doc(cacheKey);
    
    await cacheRef.update({
      accessCount: FieldValue.increment(1),
      lastAccessed: Timestamp.now(),
    });
  } catch (error) {
    // Ignore errors - this is just for metrics
    console.warn('[translationCache] Could not update access count:', error.message);
  }
}

module.exports = {
  createCacheKey,
  getCachedTranslation,
  setCachedTranslation,
  incrementCacheAccess,
};


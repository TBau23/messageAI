// Map franc's ISO 639-3 codes to ISO 639-1 codes
const ISO_MAP = {
  eng: 'en',  // English
  spa: 'es',  // Spanish
  fra: 'fr',  // French
  cmn: 'zh',  // Mandarin Chinese
  jpn: 'ja',  // Japanese
  arb: 'ar',  // Arabic
  por: 'pt',  // Portuguese
  deu: 'de',  // German
  ita: 'it',  // Italian
  kor: 'ko',  // Korean
  rus: 'ru',  // Russian
  hin: 'hi',  // Hindi
};

// Cache for franc module (loaded dynamically)
let francModule = null;

/**
 * Load franc-min module dynamically (ESM module)
 */
async function loadFranc() {
  if (!francModule) {
    francModule = await import('franc-min');
  }
  return francModule;
}

/**
 * Detect the language of a text string
 * @param {string} text - Text to analyze
 * @param {string} fallback - Default language if detection fails (default: 'en')
 * @returns {Promise<string>} ISO 639-1 language code (e.g., 'en', 'es', 'fr')
 */
async function detectLanguage(text, fallback = 'en') {
  if (!text || text.trim().length < 10) {
    // Need at least ~10 characters for reliable detection
    return fallback;
  }

  try {
    const { franc } = await loadFranc();
    const franc3Code = franc(text, { minLength: 10 });
    
    // franc returns 'und' for undefined/unable to detect
    if (franc3Code === 'und') {
      console.log('[languageDetect] Unable to detect language, using fallback:', fallback);
      return fallback;
    }

    const iso2Code = ISO_MAP[franc3Code];
    
    if (!iso2Code) {
      console.log('[languageDetect] Detected unsupported language:', franc3Code, '- using fallback:', fallback);
      return fallback;
    }

    console.log('[languageDetect] Detected language:', iso2Code, `(${franc3Code})`);
    return iso2Code;
  } catch (error) {
    console.error('[languageDetect] Error:', error);
    return fallback;
  }
}

/**
 * Get language name from code
 * @param {string} code - ISO 639-1 language code
 * @returns {string} Human-readable language name
 */
function getLanguageName(code) {
  const names = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    zh: 'Chinese',
    ja: 'Japanese',
    ar: 'Arabic',
    pt: 'Portuguese',
    de: 'German',
    it: 'Italian',
    ko: 'Korean',
    ru: 'Russian',
    hi: 'Hindi',
  };
  return names[code] || code.toUpperCase();
}

module.exports = { 
  detectLanguage,
  getLanguageName,
  SUPPORTED_LANGUAGES: Object.values(ISO_MAP)
};


/**
 * Firebase Cloud Functions for MessageAI
 * AI-powered translation and communication features
 */

// Load environment variables (including OPENAI_API_KEY)
require("dotenv").config();

// Initialize Firebase Admin SDK (must be done before importing other modules)
const admin = require("firebase-admin");
admin.initializeApp();

const {setGlobalOptions} = require("firebase-functions/v2");

// Set global options for cost control
setGlobalOptions({maxInstances: 10});

// Import AI functions
const {testAI} = require("./src/testAI");
const {updateUserSettings, getUserSettings} = require("./src/userSettings");
const {getAIUsage} = require("./src/aiUsage");
const {translateText} = require("./src/translate");
const {detectMessageLanguage} = require("./src/detectLanguage");
const {explainIdioms} = require("./src/explainIdioms");
const {explainCulturalContext} = require("./src/explainCulturalContext");
const {extractCulturalInsights} = require("./src/extractCulturalInsights");

// Export functions
exports.testAI = testAI;
exports.updateUserSettings = updateUserSettings;
exports.getUserSettings = getUserSettings;
exports.getAIUsage = getAIUsage;
exports.translateText = translateText;
exports.detectMessageLanguage = detectMessageLanguage;
exports.explainIdioms = explainIdioms;
exports.explainCulturalContext = explainCulturalContext;
exports.extractCulturalInsights = extractCulturalInsights;

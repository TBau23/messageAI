/**
 * Firebase Cloud Functions for MessageAI
 * AI-powered translation and communication features
 */

// Load environment variables (including OPENAI_API_KEY)
require('dotenv').config();

const { setGlobalOptions } = require("firebase-functions/v2");

// Set global options for cost control
setGlobalOptions({ maxInstances: 10 });

// Import AI functions
const { testAI } = require('./src/testAI');
const { updateUserSettings, getUserSettings } = require('./src/userSettings');
const { getAIUsage } = require('./src/aiUsage');

// Export functions
exports.testAI = testAI;
exports.updateUserSettings = updateUserSettings;
exports.getUserSettings = getUserSettings;
exports.getAIUsage = getAIUsage;

/**
 * Logging utilities for AI operations
 * Provides structured logging for debugging and monitoring
 */

/**
 * Log an AI request with input details
 * @param {string} functionName - Name of the AI function
 * @param {string} uid - User ID
 * @param {object} input - Input parameters (sanitized - no sensitive data)
 */
function logAIRequest(functionName, uid, input) {
  const timestamp = new Date().toISOString();
  console.log(`[${functionName}] ${timestamp}`);
  console.log(`[${functionName}] User: ${uid}`);
  console.log(`[${functionName}] Input:`, JSON.stringify(input, null, 2));
}

/**
 * Log an AI response with performance metrics
 * @param {string} functionName - Name of the AI function
 * @param {number} responseTime - Time taken in milliseconds
 * @param {number} tokens - Number of tokens used (if available)
 * @param {object} metadata - Additional metadata
 */
function logAIResponse(functionName, responseTime, tokens = null, metadata = {}) {
  console.log(`[${functionName}] Response time: ${responseTime}ms`);
  
  if (tokens !== null) {
    console.log(`[${functionName}] Tokens used: ${tokens}`);
    
    // Estimate cost (approximate, for monitoring)
    const estimatedCost = estimateOpenAICost(tokens, metadata.model);
    if (estimatedCost) {
      console.log(`[${functionName}] Estimated cost: $${estimatedCost.toFixed(6)}`);
    }
  }

  if (Object.keys(metadata).length > 0) {
    console.log(`[${functionName}] Metadata:`, JSON.stringify(metadata, null, 2));
  }
}

/**
 * Log an AI error with context
 * @param {string} functionName - Name of the AI function
 * @param {Error} error - Error object
 * @param {object} context - Additional context about the error
 */
function logAIError(functionName, error, context = {}) {
  console.error(`[${functionName}] ❌ ERROR`);
  console.error(`[${functionName}] Message: ${error.message}`);
  console.error(`[${functionName}] Stack:`, error.stack);
  
  if (Object.keys(context).length > 0) {
    console.error(`[${functionName}] Context:`, JSON.stringify(context, null, 2));
  }
}

/**
 * Estimate OpenAI API cost based on tokens and model
 * @param {number} tokens - Total tokens used
 * @param {string} model - Model name
 * @returns {number|null} Estimated cost in USD
 */
function estimateOpenAICost(tokens, model = 'gpt-4o-mini') {
  // Approximate pricing (as of 2024, subject to change)
  const pricing = {
    'gpt-4o-mini': {
      input: 0.15 / 1000000,   // $0.15 per 1M input tokens
      output: 0.60 / 1000000,  // $0.60 per 1M output tokens
    },
    'gpt-4o': {
      input: 2.50 / 1000000,   // $2.50 per 1M input tokens
      output: 10.00 / 1000000, // $10.00 per 1M output tokens
    },
  };

  const modelPricing = pricing[model];
  if (!modelPricing) {
    return null;
  }

  // Assume 50/50 split if not specified separately
  const avgPrice = (modelPricing.input + modelPricing.output) / 2;
  return tokens * avgPrice;
}

/**
 * Create a performance timer
 * @returns {object} Timer with start time and elapsed() method
 */
function createTimer() {
  const startTime = Date.now();
  return {
    elapsed: () => Date.now() - startTime,
    log: (message) => console.log(`⏱️  ${message}: ${Date.now() - startTime}ms`)
  };
}

module.exports = {
  logAIRequest,
  logAIResponse,
  logAIError,
  estimateOpenAICost,
  createTimer,
};


const {HttpsError} = require("firebase-functions/v2/https");

/**
 * Format enriched messages into a readable conversation transcript for agent analysis
 * @param {Array} enrichedMessages - Array of enriched message objects
 * @param {string} userLanguage - User's native language code
 * @param {object} metadata - Additional conversation metadata
 * @return {string} Formatted conversation transcript
 */
function formatConversationForAgent(
    enrichedMessages,
    userLanguage,
    metadata = {},
) {
  if (!enrichedMessages || enrichedMessages.length === 0) {
    throw new HttpsError(
        "invalid-argument",
        "No messages provided for formatting",
    );
  }

  const {participants = [], languagesDetected = [], dateRange = null} = metadata;

  // Build conversation header with context
  let transcript = "=== CONVERSATION CONTEXT ===\n\n";

  // Date range
  if (dateRange) {
    const start = new Date(dateRange.earliest).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const end = new Date(dateRange.latest).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    transcript += `Date Range: ${start} to ${end}\n`;
  }

  // Participants
  if (participants.length > 0) {
    transcript += `Participants: ${participants.map((p) => p.displayName).join(", ")}\n`;
  }

  // Languages detected
  if (languagesDetected.length > 0) {
    const languageNames = languagesDetected.map((lang) => {
      const names = {
        en: "English",
        es: "Spanish",
        fr: "French",
        zh: "Chinese",
        ja: "Japanese",
        ar: "Arabic",
      };
      return names[lang] || lang;
    });
    transcript += `Languages: ${languageNames.join(", ")}\n`;
  }

  // User's perspective
  const userLanguageName = {
    en: "English",
    es: "Spanish",
    fr: "French",
    zh: "Chinese",
    ja: "Japanese",
    ar: "Arabic",
  }[userLanguage] || userLanguage;

  transcript += `\nUser's Native Language: ${userLanguageName}\n`;
  transcript += `Focus: Identify content from OTHER languages/cultures ` +
    `that may be unfamiliar to a ${userLanguageName} speaker.\n`;

  transcript += "\n=== CONVERSATION TRANSCRIPT ===\n\n";

  // Format each message
  enrichedMessages.forEach((msg) => {
    // Skip empty messages (image-only, etc.)
    if (msg.isEmpty || !msg.text) {
      return;
    }

    // Format timestamp
    let timeStr = "";
    if (msg.timestamp) {
      const date = msg.timestamp.toDate ?
        msg.timestamp.toDate() :
        new Date(msg.timestamp);
      timeStr = date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // Highlight messages NOT in user's native language
    const isOtherLanguage = msg.language && msg.language !== userLanguage;
    const marker = isOtherLanguage ? "👉 " : ""; // Mark foreign language messages

    // Format: [timestamp] SenderName (Language): message text
    const langName = msg.languageName || "Unknown";
    const msgLine = `${marker}[${timeStr}] ${msg.senderName} ` +
      `(${langName}): ${msg.text}\n`;
    transcript += msgLine;
  });

  // Check token count estimate (rough estimate: ~4 chars per token)
  const estimatedTokens = transcript.length / 4;
  const MAX_TOKENS = 50000; // Keep well under context limits

  if (estimatedTokens > MAX_TOKENS) {
    console.warn(
        `[formatConversationForAgent] Transcript is very long (${estimatedTokens} tokens). ` +
        "Consider truncating to most recent messages.",
    );

    // Truncate to most recent messages if too long
    const truncateAt = Math.floor(enrichedMessages.length * 0.6);
    const truncatedMessages = enrichedMessages.slice(truncateAt);

    const fromCount = enrichedMessages.length;
    const toCount = truncatedMessages.length;

    // Rebuild with truncated messages
    return formatConversationForAgent(
        truncatedMessages,
        userLanguage,
        {...metadata, messageCount: truncatedMessages.length},
    );
  }

  const msgCount = enrichedMessages.length;
  const tokenCount = Math.round(estimatedTokens);
  console.log(
      `[formatConversationForAgent] Formatted ${msgCount} messages ` +
      `(~${tokenCount} tokens) for ${userLanguageName} speaker`,
  );

  return transcript;
}

/**
 * Build system message for the agent based on user's perspective
 * @param {string} userLanguage - User's native language code
 * @param {Array} languagesDetected - Languages found in conversation
 * @return {string} System message for agent
 */
function buildSystemMessage(userLanguage, languagesDetected = []) {
  const userLanguageName = {
    en: "English",
    es: "Spanish",
    fr: "French",
    zh: "Chinese",
    ja: "Japanese",
    ar: "Arabic",
  }[userLanguage] || userLanguage;

  const otherLanguages = languagesDetected
      .filter((lang) => lang !== userLanguage)
      .map((lang) => {
        const names = {
          en: "English",
          es: "Spanish",
          fr: "French",
          zh: "Chinese",
          ja: "Japanese",
          ar: "Arabic",
        };
        return names[lang] || lang;
      });

  const systemMessage = `You are a cultural communication expert helping ` +
  `a ${userLanguageName} speaker understand a multilingual conversation.

Your task: Analyze the conversation from a native ` +
  `${userLanguageName} speaker perspective and identify:
1. Cultural references from other cultures that may be unfamiliar
2. Idioms and expressions from other languages that don't translate directly
3. Communication style differences (formality, directness, politeness)
4. Interesting language patterns worth learning

${
  otherLanguages.length > 0 ?
  `Focus especially on content from: ${otherLanguages.join(", ")}\n` : ""
}
IMPORTANT GUIDELINES:
- Keep insights CONCISE (2-3 sentences per item)
- Focus on what the ${userLanguageName} speaker might NOT understand
- Explain practical cultural/linguistic value
- Skip generic observations
- ALWAYS return the expected JSON structure with all 4 arrays
- If no insights found in a category, return an empty array [] for that category
- Never omit any of the 4 required arrays

OUTPUT FORMAT:
You MUST return a JSON object with exactly these 4 arrays (even if empty):
- culturalReferences: []
- idioms: []
- communicationStyles: []
- learningOpportunities: []

Be educational and helpful, not overwhelming.`;

  return systemMessage;
}

module.exports = {
  formatConversationForAgent,
  buildSystemMessage,
};


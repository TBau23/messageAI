const {z} = require("zod");

/**
 * Agent function calling tools for cultural conversation analysis
 * These tools allow the agent to extract different types of insights
 */

/**
 * Schema for cultural references
 */
const culturalReferencesSchema = z.object({
  references: z.array(z.object({
    phrase: z.string().describe("The cultural reference or concept mentioned"),
    context: z.string().describe("Who said it and when"),
    explanation: z.string().describe(
        "Brief explanation (2-3 sentences) of what it means and why it matters",
    ),
    culture: z.string().describe("Which culture/language it comes from"),
  })).describe("Array of cultural references found"),
});

/**
 * Schema for idioms and expressions
 */
const idiomsSchema = z.object({
  idioms: z.array(z.object({
    phrase: z.string().describe("The idiom or expression used"),
    context: z.string().describe("Who said it and when"),
    literalMeaning: z.string().describe("What the words literally mean"),
    actualMeaning: z.string().describe(
        "What it actually means in that language/culture",
    ),
    language: z.string().describe("Which language it's from"),
  })).describe("Array of idioms and expressions found"),
});

/**
 * Schema for communication styles
 */
const communicationStylesSchema = z.object({
  observations: z.array(z.object({
    pattern: z.string().describe("The communication pattern observed"),
    participants: z.string().describe(
        "Which participants exhibit this pattern",
    ),
    explanation: z.string().describe(
        "Brief explanation of what this means culturally (2-3 sentences)",
    ),
    culturalContext: z.string().describe("Why this style is used in that culture"),
  })).describe("Array of communication style observations"),
});

/**
 * Schema for learning opportunities
 */
const learningOpportunitiesSchema = z.object({
  opportunities: z.array(z.object({
    phrase: z.string().describe("The word or phrase worth learning"),
    language: z.string().describe("Which language it's from"),
    explanation: z.string().describe(
        "What it means and why it's useful to know (2-3 sentences)",
    ),
    usage: z.string().describe("How/when to use it appropriately"),
  })).describe("Array of learning opportunities"),
});

/**
 * Get combined schema for structured output
 * @return {object} Zod schema for all insights
 */
function getCombinedInsightsSchema() {
  return z.object({
    culturalReferences: z.array(z.object({
      phrase: z.string().describe("The cultural reference or concept mentioned"),
      context: z.string().optional().default("").describe("Who said it and in what context"),
      explanation: z.string().describe("Brief explanation (2-3 sentences)"),
      culture: z.string().describe("Which culture/language (e.g., Spanish, Japanese)"),
    })).default([]).describe(
        "Cultural references from other cultures that may be unfamiliar. " +
        "Return empty array if none found.",
    ),
    idioms: z.array(z.object({
      phrase: z.string().describe("The idiom or expression used"),
      context: z.string().optional().default("").describe("Who said it and in what context"),
      literalMeaning: z.string().describe("What the words literally mean"),
      actualMeaning: z.string().describe("What it actually means"),
      language: z.string().describe("Which language (e.g., English, Spanish)"),
    })).default([]).describe(
        "Idioms and expressions that don't translate literally. " +
        "Return empty array if none found.",
    ),
    communicationStyles: z.array(z.object({
      pattern: z.string().optional().default("General communication style").describe(
          "The communication pattern observed (e.g., formal, polite, direct)",
      ),
      participants: z.string().describe("Which participants exhibit this"),
      explanation: z.string().describe("Brief explanation (2-3 sentences)"),
      culturalContext: z.string().describe("Why this style is used in that culture"),
    })).default([]).describe(
        "Communication style patterns observed. " +
        "Return empty array if none found.",
    ),
    learningOpportunities: z.array(z.object({
      phrase: z.string().describe("The word or phrase worth learning"),
      language: z.string().describe("Which language"),
      explanation: z.string().describe("What it means and why it's useful"),
      usage: z.string().optional().default("").describe("How/when to use it appropriately"),
    })).default([]).describe(
        "Interesting language patterns worth learning. " +
        "Return empty array if none found.",
    ),
  });
}

/**
 * Format structured output into user-friendly insights
 * @param {object} structuredOutput - Structured output from generateObject
 * @return {object} Formatted insights with totals
 */
function formatStructuredOutput(structuredOutput) {
  // Ensure all arrays exist and filter out any invalid entries
  const insights = {
    culturalReferences: (structuredOutput.culturalReferences || []).filter(
        (item) => item && item.phrase && item.explanation,
    ),
    idioms: (structuredOutput.idioms || []).filter(
        (item) => item && item.phrase && item.literalMeaning && item.actualMeaning,
    ),
    communicationStyles: (structuredOutput.communicationStyles || []).filter(
        (item) => item && item.participants && item.explanation,
    ),
    learningOpportunities: (structuredOutput.learningOpportunities || []).filter(
        (item) => item && item.phrase && item.explanation,
    ),
    totalInsights: 0,
  };

  // Calculate total
  insights.totalInsights =
    insights.culturalReferences.length +
    insights.idioms.length +
    insights.communicationStyles.length +
    insights.learningOpportunities.length;

  return insights;
}

module.exports = {
  getCombinedInsightsSchema,
  formatStructuredOutput,
  // Export individual schemas for reference
  culturalReferencesSchema,
  idiomsSchema,
  communicationStylesSchema,
  learningOpportunitiesSchema,
};


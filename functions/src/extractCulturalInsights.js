const {openai} = require("@ai-sdk/openai");
const {generateObject} = require("ai");
const {createAIFunction, validateRequest} = require("./template");
const {retrieveConversationMessages} = require("./conversationRetrieval");
const {
  enrichMessagesWithContext,
  getUserDefaultLanguage,
} = require("./messageEnrichment");
const {
  formatConversationForAgent,
  buildSystemMessage,
} = require("./conversationFormatter");
const {
  getCombinedInsightsSchema,
  formatStructuredOutput,
} = require("./agentTools");
const {logAIRequest, logAIResponse} = require("./logger");
const {
  getCachedInsights,
  setCachedInsights,
} = require("./insightsCache");

/**
 * Extract personalized cultural insights from multilingual conversations
 * Uses GPT-4o with agent framework and function calling
 */
exports.extractCulturalInsights = createAIFunction(
    "extractions",
    async (request, context) => {
      // Validate input
      validateRequest(request.data, ["conversationId"]);

      const {conversationId} = request.data;
      const {uid} = context;

      const startTime = Date.now();

      try {
        // Step 1: Get user's default language
        const userLanguage = await getUserDefaultLanguage(uid);

        // Step 2: Retrieve messages from conversation
        const messages = await retrieveConversationMessages(
            conversationId,
            100,
        );

        if (messages.length === 0) {
          return {
            hasInsights: false,
            message: "No messages found in this conversation",
            insights: null,
          };
        }

        if (messages.length < 10) {
          return {
            hasInsights: false,
            message:
              "Not enough messages to analyze. Need at least 10 messages.",
            insights: null,
            messagesFound: messages.length,
          };
        }

        // Step 3: Check cache first
        const cached = await getCachedInsights(
            conversationId,
            uid,
            messages.length,
            userLanguage,
        );

        if (cached) {
          const cacheResponseTime = Date.now() - startTime;

          return {
            hasInsights: true,
            insights: cached.insights,
            userLanguage,
            cached: true,
            metadata: {
              responseTime: cacheResponseTime,
              messagesAnalyzed: cached.messageCount,
              fromCache: true,
              cacheAge: cached.cacheAge,
            },
          };
        }

        // Step 4: Enrich messages with language detection and sender info
        const enrichmentResult = await enrichMessagesWithContext(
            messages,
            conversationId,
        );

        const {
          enrichedMessages,
          participants,
          languagesDetected,
          dateRange,
        } = enrichmentResult;

        // Check if conversation is monolingual (same as user's language)
        const otherLanguages = languagesDetected.filter(
            (lang) => lang !== userLanguage,
        );

        if (otherLanguages.length === 0) {
          return {
            hasInsights: false,
            message:
              `This conversation is in ${userLanguage} only. ` +
              "Insights work best with multilingual conversations.",
            insights: null,
            userLanguage,
          };
        }

        // Step 5: Format conversation for agent
        const conversationTranscript = formatConversationForAgent(
            enrichedMessages,
            userLanguage,
            {participants, languagesDetected, dateRange},
        );

        // Step 6: Build system message
        const systemMessage = buildSystemMessage(
            userLanguage,
            languagesDetected,
        );

        logAIRequest("extractCulturalInsights", uid, {
          conversationId,
          messageCount: messages.length,
          userLanguage,
          languagesDetected,
          participantCount: participants.length,
        });

        // Step 7: Call agent with structured output
        const insightsSchema = getCombinedInsightsSchema();

        let structuredOutput;
        let usage;

        try {
          const result = await generateObject({
            model: openai("gpt-4o"), // Use GPT-4o for advanced reasoning
            system: systemMessage,
            prompt: conversationTranscript,
            schema: insightsSchema,
            temperature: 0.5,
            mode: "json", // Explicitly use JSON mode for better compatibility
          });

          structuredOutput = result.object;
          usage = result.usage;

          // Validate that all required keys exist
          const requiredKeys = [
            "culturalReferences",
            "idioms",
            "communicationStyles",
            "learningOpportunities",
          ];
          const missingKeys = requiredKeys.filter(
              (key) => !(key in structuredOutput),
          );
          if (missingKeys.length > 0) {
            console.error(
                `[extractCulturalInsights] Missing keys in response:`,
                missingKeys,
            );
            // Add missing keys with empty arrays as fallback
            missingKeys.forEach((key) => {
              structuredOutput[key] = [];
            });
          }
        } catch (schemaError) {
          console.error(
              `[extractCulturalInsights] Schema validation failed:`,
              schemaError,
          );
          console.error(
              `[extractCulturalInsights] Error name:`,
              schemaError.name,
          );
          console.error(
              `[extractCulturalInsights] Error message:`,
              schemaError.message,
          );
          if (schemaError.cause) {
            console.error(
                `[extractCulturalInsights] Error cause:`,
                JSON.stringify(schemaError.cause, null, 2),
            );
          }
          throw new Error(
              `No object generated: response did not match schema. ` +
              `This may indicate the AI response format was unexpected. ` +
              `Details: ${schemaError.message}`,
          );
        }

        // Step 8: Format structured output into insights
        const insights = formatStructuredOutput(structuredOutput);

        const responseTime = Date.now() - startTime;
        const totalTokens = usage?.totalTokens || 0;

        logAIResponse("extractCulturalInsights", responseTime, totalTokens, {
          conversationId,
          messageCount: messages.length,
          userLanguage,
          totalInsights: insights.totalInsights,
        });

        // Check if we got any insights
        if (insights.totalInsights === 0) {
          return {
            hasInsights: false,
            message:
              "No significant cultural insights found in this conversation.",
            insights: null,
            userLanguage,
            metadata: {
              responseTime,
              messagesAnalyzed: messages.length,
              languagesDetected,
            },
          };
        }

        // Step 9: Cache results for future requests
        await setCachedInsights(
            conversationId,
            uid,
            messages.length,
            userLanguage,
            insights,
        );

        return {
          hasInsights: true,
          insights,
          userLanguage,
          cached: false,
          metadata: {
            responseTime,
            tokensUsed: totalTokens,
            messagesAnalyzed: messages.length,
            languagesDetected,
            participantCount: participants.length,
            fromCache: false,
          },
        };
      } catch (error) {
        console.error("[extractCulturalInsights] Error:", error);
        throw new Error(
            `Cultural insights extraction failed: ${error.message}`,
        );
      }
    },
);


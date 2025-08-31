import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { Document } from "@langchain/core/documents";
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";
import { z } from "zod";

// Validation schema for user profile
const UserProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  title: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  skills: z.array(z.string()).optional().default([]),
  interests: z.array(z.string()).optional().default([]),
  preferences: z.object({
    mentor: z.boolean(),
    invest: z.boolean(),
    discuss: z.boolean(),
    collaborate: z.boolean(),
    hire: z.boolean(),
  }),
});

export class ProfileIntelligenceService {
  private llmWithTools: ChatGoogleGenerativeAI;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private searchTool: TavilySearchResults;
  private supabaseClient: any;
  private vectorStore: SupabaseVectorStore;
  private tools: any[];
  private toolNode: ToolNode;

  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY environment variable is required");
    }

    if (!process.env.TAVILY_API_KEY) {
      throw new Error("TAVILY_API_KEY environment variable is required");
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      throw new Error("Supabase environment variables are required");
    }

    // Initialize Tavily search tool using the official LangChain approach
    this.searchTool = new TavilySearchResults({
      maxResults: 5, // More focused results
    });

    console.log(
      "🔍 TavilySearchResults initialized with LangChain standard approach"
    );

    // Define tools for the agent - Tavily is natively compatible with LangChain
    this.tools = [this.searchTool];
    this.toolNode = new ToolNode(this.tools);

    // Initialize LLM with tools bound
    const baseLLM = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.7,
    });

    this.llmWithTools = baseLLM.bindTools(this.tools) as ChatGoogleGenerativeAI;

    console.log("🤖 LLM initialized with tools bound");

    // Initialize embeddings
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: "embedding-001",
    });

    // Initialize Supabase client
    this.supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Initialize vector store
    this.vectorStore = new SupabaseVectorStore(this.embeddings, {
      client: this.supabaseClient,
      tableName: "documents",
      queryName: "match_documents",
    });
  }

  /**
   * System prompt for the profile intelligence agent
   */
  private getSystemPrompt(): SystemMessage {
    return new SystemMessage({
      content: `You are a professional profile intelligence analyst. Your task is to research and analyze professionals for business networking purposes.

  IMPORTANT: You MUST use the tavily_search_results_json tool to gather information. Do not provide analysis without searching first.

  Available tools:
  - tavily_search_results_json: Use this to search for comprehensive professional information about people and companies

  Your workflow:
  1. ALWAYS start by using tavily_search_results_json to find information about the person
  2. Search for their professional background, current role, and company
  3. Look for recent achievements, projects, or news
  4. Search for industry insights and company information
  5. Validate and expand on provided skills and interests through targeted searches
  6. Based on your comprehensive research, provide analysis

  Search strategy:
  - Search for: "{person_name} {title} {company} professional background"
  - Search for: "{company_name} company information business"
  - Search for: "{person_name} achievements projects career"
  - Search for: "{person_name} LinkedIn professional experience"
  - Search for: "{person_name} {location} professional network"
  - Search for: "{website_domain} about team leadership"
  - Search for: "{person_name} {skills} expertise experience" (when skills provided)
  - Search for: "{person_name} {interests} involvement activities" (when interests provided)
  - Search for: "{person_name} {industry} expertise skills"

  After completing your searches, provide your analysis in this exact JSON format:

  FOR SUCCESSFUL SEARCHES (regardless of information quality):
  {
    "success": true,
    "summary": "A concise 2-3 sentence professional summary based on available information from your research, highlighting key skills and professional interests",
    "analysis": "Detailed analysis covering: Professional Background, Company Information, Skills & Professional Interests, Industry Standing, Recent Activities, and Networking Potential - based on whatever information you found in the search results."
  }

  FOR FAILED SEARCHES (only when search operations encounter technical errors):
  {
    "success": false,
    "error": "Specific technical error message explaining why the search operation failed (e.g., 'Search API returned an error', 'Search operation timed out', 'Search operation too many requests', etc.)"
  }

  Guidelines:
  - Use tavily_search multiple times to gather comprehensive information
  - Always provide analysis based on whatever information you find, even if limited
  - If searches return little or irrelevant information search more deeply, still provide summary and analysis with available data
  - Only return success: false for actual technical search failures, not for lack of information
  - Be factual and professional, citing what you found in searches
  - Focus on business networking relevance with emphasis on skills alignment and shared interests
  - When skills and interests are provided, validate them through research and suggest related areas
  - Aim for 300-500 words in the detailed analysis
  - Always search before analyzing`,
    });
  }

  /**
   * LLM node that can call tools or respond
   */
  private async llmCall(state: typeof MessagesAnnotation.State) {
    console.log("🤖 LLM processing with", state.messages.length, "messages");

    const result = await this.llmWithTools.invoke([
      this.getSystemPrompt(),
      ...state.messages,
    ]);

    console.log("🔧 LLM response:");
    console.log(
      "- Content:",
      result.content
        ? String(result.content).substring(0, 200) + "..."
        : "No content"
    );
    console.log("- Tool calls:", result.tool_calls?.length || 0);

    if (result.tool_calls && result.tool_calls.length > 0) {
      console.log(
        "🔧 Tool calls details:",
        JSON.stringify(result.tool_calls, null, 2)
      );
    } else {
      console.log("⚠️ No tool calls made by LLM");
    }

    return {
      messages: [result],
    };
  }

  /**
   * Conditional edge to route to tools or end
   */
  private shouldContinue(state: typeof MessagesAnnotation.State) {
    const messages = state.messages;
    const lastMessage = messages.at(-1) as AIMessage;

    console.log("🔀 Checking if should continue...");
    console.log("- Last message type:", lastMessage?.constructor.name);
    console.log("- Has tool_calls property:", "tool_calls" in lastMessage);

    if (lastMessage?.tool_calls?.length) {
      console.log("🔧 Tool calls detected:", lastMessage.tool_calls.length);
      console.log("🔧 First tool call:", lastMessage.tool_calls[0]);
      return "tools";
    }

    console.log("⭐ No tool calls - ending workflow");
    return END;
  }

  /**
   * Create the agent workflow
   */
  private createAgent() {
    return new StateGraph(MessagesAnnotation)
      .addNode("llmCall", this.llmCall.bind(this))
      .addNode("tools", this.toolNode)
      .addEdge(START, "llmCall")
      .addConditionalEdges("llmCall", this.shouldContinue.bind(this), {
        tools: "tools",
        [END]: END,
      })
      .addEdge("tools", "llmCall")
      .compile();
  }

  /**
   * Extract structured response from LLM output
   */
  private extractStructuredResponse(content: string): {
    success: boolean;
    summary: string;
    analysis: string;
    error?: string;
  } {
    console.log("🔍 Extracting structured response from content...");

    try {
      // Try to parse as JSON first
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log("📋 Found JSON structure, attempting to parse...");
        const parsed = JSON.parse(jsonMatch[0]);

        // Handle new format with success field
        if (parsed.success !== undefined) {
          console.log(
            "✅ Successfully parsed new JSON format with success field"
          );

          if (parsed.success === true) {
            // Success case - should have summary and analysis
            return {
              success: true,
              summary: parsed.summary || "No summary provided",
              analysis: parsed.analysis || "No analysis provided",
            };
          } else {
            // Failure case - should have error message
            return {
              success: false,
              summary: "Analysis failed",
              analysis: "Analysis could not be completed",
              error: parsed.error || "Analysis failed for unknown reason",
            };
          }
        }

        // Handle legacy format
        if (parsed.summary && parsed.analysis) {
          console.log("✅ Successfully parsed legacy JSON response");
          return {
            success: true,
            summary: parsed.summary,
            analysis: parsed.analysis,
          };
        }

        console.log("⚠️ JSON found but missing required fields");
      }
    } catch (error) {
      console.log("⚠️ JSON parsing failed:", error);
    }

    // Try to find JSON with different patterns
    const patterns = [
      /```json\s*(\{[\s\S]*?\})\s*```/,
      /```\s*(\{[\s\S]*?\})\s*```/,
      /(\{[\s\S]*?"success"[\s\S]*?\})/,
      /(\{[\s\S]*?"summary"[\s\S]*?"analysis"[\s\S]*?\})/,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          console.log("📋 Trying alternative JSON pattern...");
          const parsed = JSON.parse(match[1]);

          // Handle new format
          if (parsed.success !== undefined) {
            console.log(
              "✅ Successfully parsed alternative JSON format with success field"
            );
            return {
              success: parsed.success === true,
              summary: parsed.summary || "No summary provided",
              analysis: parsed.analysis || "No analysis provided",
              error:
                parsed.error && parsed.error !== "null"
                  ? parsed.error
                  : undefined,
            };
          }

          // Handle legacy format
          if (parsed.summary && parsed.analysis) {
            console.log(
              "✅ Successfully parsed alternative legacy JSON format"
            );
            return {
              success: true,
              summary: parsed.summary,
              analysis: parsed.analysis,
            };
          }
        } catch (error) {
          console.log("⚠️ Alternative JSON parsing failed");
        }
      }
    }

    // Fallback to text extraction
    console.log("🔍 Using text extraction fallback...");

    // Enhanced regex patterns for better extraction
    const summaryPatterns = [
      /summary["']?\s*:\s*["']([^"']+?)["']/i,
      /"summary"\s*:\s*"([^"]+?)"/i,
      /summary:\s*([^}\n]+)/i,
      /##?\s*summary\s*:?\s*\n?(.*?)(?=\n##|\n\*\*|\nanalysis|$)/i,
    ];

    const analysisPatterns = [
      /analysis["']?\s*:\s*["']([^"']+?)["']/i,
      /"analysis"\s*:\s*"([^"]+?)"/i,
      /analysis:\s*([^}]+)/i,
      /##?\s*analysis\s*:?\s*\n?(.*?)(?=\n##|\n\*\*|$)/i,
    ];

    let summary =
      "Profile intelligence analysis could not be extracted from response";
    let analysis = "Detailed analysis could not be extracted from response";

    // Try summary patterns
    for (const pattern of summaryPatterns) {
      const match = content.match(pattern);
      if (match && match[1] && match[1].trim().length > 10) {
        summary = match[1].trim();
        console.log("✅ Found summary using pattern");
        break;
      }
    }

    // Try analysis patterns
    for (const pattern of analysisPatterns) {
      const match = content.match(pattern);
      if (match && match[1] && match[1].trim().length > 50) {
        analysis = match[1].trim();
        console.log("✅ Found analysis using pattern");
        break;
      }
    }

    // If still no good content, consider this a failure
    const isValidResponse =
      summary !==
        "Profile intelligence analysis could not be extracted from response" ||
      analysis !== "Detailed analysis could not be extracted from response";

    console.log("📊 Text extraction results:");
    console.log("- Summary found:", summary.length > 50);
    console.log("- Analysis found:", analysis.length > 100);

    return {
      success: isValidResponse,
      summary,
      analysis,
      error: !isValidResponse
        ? "Could not extract meaningful analysis from AI response"
        : undefined,
    };
  }

  /**
   * Generate semantic tags for better search filtering
   */
  private generateSemanticTags(userProfile: any): string[] {
    const tags = [];

    // Role tags
    if (userProfile.title) {
      const roleKeywords = [
        "engineer",
        "manager",
        "director",
        "ceo",
        "cto",
        "developer",
        "analyst",
        "consultant",
        "founder",
        "lead",
        "designer",
        "product",
        "marketing",
        "sales",
        "finance",
        "hr",
        "operations",
      ];
      roleKeywords.forEach((keyword) => {
        if (userProfile.title.toLowerCase().includes(keyword)) {
          tags.push(`role:${keyword}`);
        }
      });
    }

    // Company tags
    if (userProfile.company) {
      tags.push(`company:${userProfile.company.toLowerCase()}`);
    }

    // Location tags
    if (userProfile.location) {
      tags.push(`location:${userProfile.location.toLowerCase()}`);
    }

    // Skills tags
    if (userProfile.skills && Array.isArray(userProfile.skills)) {
      userProfile.skills.forEach((skill: string) => {
        tags.push(`skill:${skill.toLowerCase()}`);
      });
    }

    // Interests tags
    if (userProfile.interests && Array.isArray(userProfile.interests)) {
      userProfile.interests.forEach((interest: string) => {
        tags.push(`interest:${interest.toLowerCase()}`);
      });
    }

    // Preference tags
    Object.entries(userProfile.preferences).forEach(([key, value]) => {
      if (value) {
        tags.push(`preference:${key}`);
      }
    });

    return tags;
  }

  /**
   * Store profile intelligence in vector database
   */
  private async storeEmbedding(
    userProfile: any,
    analysis: string,
    summary: string
  ) {
    try {
      const embeddingContent = `
Name: ${userProfile.name}
Title: ${userProfile.title || "Not specified"}
Company: ${userProfile.company || "Not specified"}
Location: ${userProfile.location || "Not specified"}
Website: ${userProfile.website || "Not specified"}
Bio: ${userProfile.bio || "Not specified"}
Skills: ${userProfile.skills?.join(", ") || "Not specified"}
Interests: ${userProfile.interests?.join(", ") || "Not specified"}
Preferences: ${Object.entries(userProfile.preferences)
        .filter(([_, value]) => value)
        .map(([key, _]) => key)
        .join(", ")}
        

Professional Summary:
${summary}

Detailed Analysis:
${analysis}
`;

      // Remove existing document
      const { data: existingDocs } = await this.supabaseClient
        .from("documents")
        .select("id")
        .eq("user_id", userProfile.id)
        .eq("metadata->>type", "profile_intelligence");

      if (existingDocs && existingDocs.length > 0) {
        await this.supabaseClient
          .from("documents")
          .delete()
          .eq("user_id", userProfile.id)
          .eq("metadata->>type", "profile_intelligence");
      }

      // Create and store new embedding
      const embedding = await this.embeddings.embedQuery(embeddingContent);

      const { error: insertError } = await this.supabaseClient
        .from("documents")
        .insert({
          user_id: userProfile.id,
          content: embeddingContent,
          metadata: {
            user_id: userProfile.id,
            name: userProfile.name,
            title: userProfile.title,
            company: userProfile.company,
            location: userProfile.location,
            website: userProfile.website,
            skills: userProfile.skills || [],
            interests: userProfile.interests || [],
            
            // Normalized versions for easier searching
            skills_normalized: (userProfile.skills || []).map((skill: string) =>
              skill.toLowerCase()
            ),
            interests_normalized: (userProfile.interests || []).map(
              (interest: string) => interest.toLowerCase()
            ),
            // Simple location parsing for better matching
            location_city: userProfile.location?.split(',')[0]?.trim().toLowerCase() || "",
            location_state: userProfile.location?.split(',')[1]?.trim().toLowerCase() || "",
            type: "profile_intelligence",
            created_at: new Date().toISOString(),
            preferences: userProfile.preferences,
            // Enhanced metadata for better filtering
            semantic_tags: this.generateSemanticTags(userProfile),
            title_keywords: userProfile.title?.toLowerCase().split(" ") || [],
            company_keywords:
              userProfile.company?.toLowerCase().split(" ") || [],
            skills_keywords: (userProfile.skills || []).flatMap(
              (skill: string) =>
                skill
                  .toLowerCase()
                  .split(/[\/\s-]+/)
                  .filter((word) => word.length > 2)
            ),
            interests_keywords: (userProfile.interests || []).flatMap(
              (interest: string) =>
                interest
                  .toLowerCase()
                  .split(/[\/\s-]+/)
                  .filter((word) => word.length > 2)
            ),
          },
          embedding: embedding,
        });

      if (insertError) {
        throw new Error(`Error inserting document: ${insertError.message}`);
      }

      console.log(
        `✅ Successfully stored vector embedding for user ${userProfile.id}`
      );
    } catch (error) {
      console.error("Error storing embedding:", error);
      throw error;
    }
  }

  /**
   * Find similar profiles for networking
   */
  async findSimilarProfiles(
    userProfile: any,
    limit: number = 10,
    minSimilarity: number = 0.6
  ): Promise<
    Array<{
      user_id: string;
      name: string;
      title: string;
      company: string;
      location: string;
      similarity: number;
      content: string;
      metadata: any;
    }>
  > {
    try {
      // Create search query from user profile
      const searchQuery = `${userProfile.name} ${userProfile.title} ${
        userProfile.company
      } ${userProfile.bio} ${Object.entries(userProfile.preferences)
        .filter(([_, value]) => value)
        .map(([key, _]) => key)
        .join(" ")}`;

      console.log(`🔍 Searching for similar profiles to: ${userProfile.name}`);

      // Perform similarity search
      const results = await this.vectorStore.similaritySearchWithScore(
        searchQuery,
        limit * 2 // Get more results to filter
      );

      // Filter and format results
      const filteredResults = results
        .filter(([doc, score]) => {
          // Exclude the user's own profile
          return (
            doc.metadata.user_id !== userProfile.id && score >= minSimilarity
          );
        })
        .slice(0, limit)
        .map(([doc, score]) => ({
          user_id: doc.metadata.user_id,
          name: doc.metadata.name,
          title: doc.metadata.title || "Not specified",
          company: doc.metadata.company || "Not specified",
          location: doc.metadata.location || "Not specified",
          similarity: score,
          content: doc.pageContent.substring(0, 300) + "...",
          metadata: doc.metadata,
        }));

      console.log(`✅ Found ${filteredResults.length} similar profiles`);
      return filteredResults;
    } catch (error) {
      console.error("Error finding similar profiles:", error);
      return [];
    }
  }

  /**
   * Find networking matches based on specific networking intent
   */
  async findNetworkingMatches(
    userProfile: any,
    searchType:
      | "mentor"
      | "collaborate"
      | "invest"
      | "hire"
      | "discuss" = "collaborate",
    limit: number = 10
  ): Promise<
    Array<{
      user_id: string;
      name: string;
      title: string;
      company: string;
      location: string;
      similarity: number;
      matchType: string;
      content: string;
    }>
  > {
    try {
      console.log(`🎯 Finding ${searchType} matches for: ${userProfile.name}`);

      // Create targeted search queries based on networking intent
      const searchQueries = {
        mentor: `experienced ${userProfile.title} mentor advisor senior leadership guidance ${userProfile.company}`,
        collaborate: `${
          userProfile.title
        } collaboration partnership project team work ${Object.entries(
          userProfile.preferences
        )
          .filter(([_, v]) => v)
          .map(([k, _]) => k)
          .join(" ")}`,
        invest: `investor funding startup entrepreneur business development investment capital`,
        hire: `hiring recruiter talent acquisition ${userProfile.title} ${userProfile.location} employment`,
        discuss: `discussion networking professional ${userProfile.title} industry insights knowledge sharing`,
      };

      const searchQuery = searchQueries[searchType];

      // Perform similarity search
      const results = await this.vectorStore.similaritySearchWithScore(
        searchQuery,
        limit * 2
      );

      // Filter and format results
      const matches = results
        .filter(([doc, score]) => {
          // Exclude self and apply quality threshold
          return doc.metadata.user_id !== userProfile.id && score >= 0.5;
        })
        .slice(0, limit)
        .map(([doc, score]) => ({
          user_id: doc.metadata.user_id,
          name: doc.metadata.name,
          title: doc.metadata.title || "Not specified",
          company: doc.metadata.company || "Not specified",
          location: doc.metadata.location || "Not specified",
          similarity: score,
          matchType: searchType,
          content: doc.pageContent.substring(0, 300) + "...",
        }));

      console.log(`✅ Found ${matches.length} ${searchType} matches`);
      return matches;
    } catch (error) {
      console.error("Error finding networking matches:", error);
      return [];
    }
  }

  /**
   * Search profiles by company or industry
   */
  async searchByCompany(
    companyName: string,
    excludeUserId?: string,
    limit: number = 10
  ): Promise<Array<any>> {
    try {
      console.log(`🏢 Searching profiles from company: ${companyName}`);

      const searchQuery = `${companyName} company work employee professional`;

      const results = await this.vectorStore.similaritySearchWithScore(
        searchQuery,
        limit * 2
      );

      const companyMatches = results
        .filter(([doc, score]) => {
          const matchesCompany = doc.metadata.company
            ?.toLowerCase()
            .includes(companyName.toLowerCase());
          const notSelf = excludeUserId
            ? doc.metadata.user_id !== excludeUserId
            : true;
          return matchesCompany && notSelf && score >= 0.4;
        })
        .slice(0, limit)
        .map(([doc, score]) => ({
          user_id: doc.metadata.user_id,
          name: doc.metadata.name,
          title: doc.metadata.title,
          company: doc.metadata.company,
          similarity: score,
        }));

      console.log(
        `✅ Found ${companyMatches.length} profiles from ${companyName}`
      );
      return companyMatches;
    } catch (error) {
      console.error("Error searching by company:", error);
      return [];
    }
  }

  /**
   * Main method to process profile intelligence
   */
  async processProfileIntelligence(userProfile: any): Promise<{
    success: boolean;
    analysis?: string;
    summary?: string;
    error?: string;
  }> {
    try {
      const validatedProfile = UserProfileSchema.parse(userProfile);

      console.log(
        `🧠 Starting profile intelligence for user: ${validatedProfile.name}`
      );

      // Create user message for analysis
      const userMessage = new HumanMessage({
        content: `IMPORTANT: You must use the tavily_search_results_json tool to research this person before providing analysis.

Analyze this professional profile for business networking purposes:

Name: ${validatedProfile.name}
Title: ${validatedProfile.title || "Not specified"}
Company: ${validatedProfile.company || "Not specified"}
Location: ${validatedProfile.location || "Not specified"}
Bio: ${validatedProfile.bio || "Not specified"}
Website: ${validatedProfile.website || "Not specified"}
Skills: ${
          validatedProfile.skills?.length
            ? validatedProfile.skills.join(", ")
            : "Not specified"
        }
Interests: ${
          validatedProfile.interests?.length
            ? validatedProfile.interests.join(", ")
            : "Not specified"
        }
Professional Interests: ${
          Object.entries(validatedProfile.preferences)
            .filter(([_, value]) => value)
            .map(([key, _]) => key)
            .join(", ") || "Not specified"
        }

Step 1: Search for "${validatedProfile.name} ${validatedProfile.title} ${
          validatedProfile.company
        }" using the tavily_search_results_json tool
Step 2: Search for "${
          validatedProfile.company
        } company information" using the tavily_search_results_json tool
Step 3: Search for "${validatedProfile.name} ${
          validatedProfile.location || "professional"
        } career achievements" using the tavily_search_results_json tool
${
  validatedProfile.skills?.length
    ? `Step 4: Search for "${validatedProfile.skills.slice(0, 3).join(" ")} ${
        validatedProfile.name
      } expertise experience" using the tavily_search_results_json tool
Step 5: Search for "${validatedProfile.interests?.slice(0, 3).join(" ")} ${
        validatedProfile.name
      } professional involvement" using the tavily_search_results_json tool
Step 6: Search for "${
        validatedProfile.website
          ? validatedProfile.website.replace(/https?:\/\//, "").split("/")[0] +
            " about team"
          : validatedProfile.name + " professional profile"
      }" using the tavily_search_results_json tool
Step 7: Based on your comprehensive research, provide your analysis in the specified JSON format.`
    : `Step 4: Search for "${
        validatedProfile.website
          ? validatedProfile.website.replace(/https?:\/\//, "").split("/")[0] +
            " about team"
          : validatedProfile.name + " professional profile"
      }" using the tavily_search_results_json tool
Step 5: Based on your comprehensive research, provide your analysis in the specified JSON format.`
}

You MUST use the tavily_search_results_json tool multiple times before providing any analysis.`,
      });

      // Create and run the agent
      const agent = this.createAgent();
      const result = await agent.invoke({
        messages: [userMessage],
      });

      console.log(
        "🔄 Agent completed with",
        result.messages.length,
        "messages"
      );

      // Check if any searches were actually performed
      const hasToolCalls = result.messages.some(
        (msg: any) => msg.tool_calls && msg.tool_calls.length > 0
      );

      if (!hasToolCalls) {
        console.log(
          "⚠️ No tool calls detected in agent workflow - performing manual search"
        );

        // Manual fallback search
        const searchQuery = `"${validatedProfile.name}" "${validatedProfile.company}" "${validatedProfile.title}"`;
        console.log("🔍 Manual search query:", searchQuery);

        try {
          const searchResults = await this.searchTool.invoke(searchQuery);

          // TavilySearchResults returns a formatted string ready for LLM consumption
          console.log(
            "🔍 Manual search completed, result length:",
            searchResults.length
          );

          // Add search results to the conversation and get analysis
          const searchMessage = new HumanMessage({
            content: `Here are the search results for ${validatedProfile.name}:

${searchResults}

Based on this information, please provide your analysis in the specified JSON format.`,
          });

          const finalResult = await this.llmWithTools.invoke([
            this.getSystemPrompt(),
            userMessage,
            searchMessage,
          ]);

          result.messages.push(finalResult);
        } catch (searchError) {
          console.log("⚠️ Manual search failed:", searchError);
        }
      }

      // Extract the final response
      const finalMessage = result.messages.at(-1);
      if (!finalMessage || !finalMessage.content) {
        throw new Error("No response generated from agent");
      }

      console.log("📄 Final message content preview:");
      console.log("- Length:", String(finalMessage.content).length);
      console.log(
        "- First 500 chars:",
        String(finalMessage.content).substring(0, 500)
      );
      console.log(
        "- Contains 'summary':",
        String(finalMessage.content).toLowerCase().includes("summary")
      );
      console.log(
        "- Contains 'analysis':",
        String(finalMessage.content).toLowerCase().includes("analysis")
      );

      // Extract structured response with new format
      const { success, summary, analysis, error } =
        this.extractStructuredResponse(finalMessage.content as string);

      console.log("📊 Extracted response:");
      console.log("- Success:", success);
      console.log("- Summary length:", summary.length);
      console.log("- Analysis length:", analysis.length);
      console.log("- Error:", error);
      console.log("- Summary preview:", summary.substring(0, 100) + "...");
      console.log("- Analysis preview:", analysis.substring(0, 100) + "...");

      // Check if analysis was successful
      if (!success) {
        console.log("❌ Profile intelligence failed - insufficient data");
        return {
          success: false,
          error:
            error ||
            "Profile intelligence analysis failed - insufficient data found",
        };
      }

      // Store in vector database only if successful
      await this.storeEmbedding(validatedProfile, analysis, summary);

      console.log(
        `✅ Profile intelligence completed for user: ${validatedProfile.name}`
      );

      return {
        success: true,
        analysis,
        summary,
      };
    } catch (error) {
      console.error("Error in profile intelligence process:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

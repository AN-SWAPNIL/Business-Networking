import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
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
import { tool } from "@langchain/core/tools";

// Enhanced User Interface for matching
interface MatchingUser {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  bio?: string;
  skills: string[];
  interests: string[];
  preferences: {
    mentor: boolean;
    invest: boolean;
    discuss: boolean;
    collaborate: boolean;
    hire: boolean;
  };
  connections?: number;
  profileIntelligence?: {
    summary: string;
    analysis: string;
  };
}

// Enhanced Match Result with AI Reasoning
interface EnhancedMatch {
  user: MatchingUser;
  compatibilityScore: number;
  matchReasons: string[];
  sharedInterests: string[];
  complementarySkills: string[];
  semanticSimilarity: number;
  aiReasoning: string;
  matchingCategory: string;
  recommendationStrength: "high" | "medium" | "low";
}

// Matching Request Schema
const MatchingRequestSchema = z.object({
  userId: z.string(),
  matchingType: z.enum([
    "mentorship",
    "collaboration",
    "investment",
    "hiring",
    "discussion",
    "all",
  ]),
  maxResults: z.number().min(1).max(50).default(10),
  minCompatibility: z.number().min(0).max(100).default(40),
  locationPreference: z
    .enum(["local", "regional", "national", "global"])
    .default("global"),
  includeProfileIntelligence: z.boolean().default(true),
});

type MatchingRequest = z.infer<typeof MatchingRequestSchema>;

export class RAGMatchingAgent {
  private llm: ChatGoogleGenerativeAI;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private supabaseClient: any;
  private vectorStore: SupabaseVectorStore;
  private tools: any[];
  private toolNode: ToolNode;

  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY environment variable is required");
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      throw new Error("Supabase environment variables are required");
    }

    // Initialize LLM
    this.llm = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.7, // Lower temperature for more consistent matching
      maxOutputTokens: 4096, // Increase max output tokens for longer responses
    });

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

    // Define tools for the matching agent
    this.tools = [
      this.createVectorSearchTool(),
      this.createUserProfileTool(),
      this.createCompatibilityAnalysisTool(),
    ];

    this.toolNode = new ToolNode(this.tools);

    console.log("🤖 RAG Matching Agent initialized successfully");
  }

  /**
   * Check if cached matches exist and are valid
   */
  private async checkCachedMatches(userId: string): Promise<{
    cached: boolean;
    matches?: any[];
    cacheAge?: number;
    metadata?: any;
  }> {
    try {
      console.log(`🔍 Checking cache for user ${userId}`);

      const { data, error } = await this.supabaseClient.rpc(
        "get_cached_matches",
        {
          p_user_id: userId,
        }
      );

      if (error) {
        console.error("❌ Cache check error:", error);
        return { cached: false };
      }

      if (!data || data.length === 0) {
        console.log("📭 No cached matches found");
        return { cached: false };
      }

      const cacheEntry = data[0];
      console.log(
        `✅ Found cached matches: ${cacheEntry.total_matches} matches, ${cacheEntry.cache_age_minutes} minutes old`
      );

      return {
        cached: true,
        matches: cacheEntry.matches_data || [],
        cacheAge: cacheEntry.cache_age_minutes,
        metadata: cacheEntry.cache_metadata,
      };
    } catch (error) {
      console.error("❌ Cache check failed:", error);
      return { cached: false };
    }
  }

  /**
   * Store matches in cache
   */
  private async storeCachedMatches(
    userId: string,
    matches: any[],
    processingTime?: number,
    totalProfilesAnalyzed?: number,
    cacheHours: number = 24
  ): Promise<boolean> {
    try {
      console.log(
        `💾 Storing ${matches.length} matches in cache for user ${userId}`
      );

      const cacheMetadata = {
        ai_processing_time: processingTime || 0,
        total_profiles_analyzed: totalProfilesAnalyzed || 0,
        cache_version: "1.0",
        cached_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabaseClient.rpc(
        "upsert_matches_cache",
        {
          p_user_id: userId,
          p_matching_type: "all", // Still send but ignored by simplified function
          p_matches_data: matches,
          p_total_matches: matches.length,
          p_cache_metadata: cacheMetadata,
          p_cache_hours: cacheHours,
        }
      );

      if (error) {
        console.error("❌ Cache storage error:", error);
        return false;
      }

      console.log(`✅ Cached matches stored successfully (ID: ${data})`);
      return true;
    } catch (error) {
      console.error("❌ Cache storage failed:", error);
      return false;
    }
  }

  /**
   * Check if cache should be refreshed based on age and user activity
   */
  private shouldRefreshCache(
    cacheAge: number,
    forceRefresh: boolean = false
  ): boolean {
    if (forceRefresh) return true;

    // Refresh if cache is older than 6 hours (configurable)
    const maxCacheAge = 6 * 60; // 6 hours in minutes
    return cacheAge > maxCacheAge;
  }

  /**
   * Vector Search Tool for finding similar profiles
   */
  private createVectorSearchTool() {
    return tool(
      async ({ query, filters, maxResults }) => {
        try {
          console.log(`🔍 Vector search: ${query}`);

          const searchResults =
            await this.vectorStore.similaritySearchWithScore(
              query,
              maxResults || 20
            );

          console.log(
            `🔍 Vector search found ${searchResults.length} profiles`
          );
          if (searchResults.length > 0) {
            console.log(`🔍 Sample result:`, {
              id: searchResults[0][0].metadata.user_id,
              name: searchResults[0][0].metadata.name,
              score: searchResults[0][1],
              fullMetadata: searchResults[0][0].metadata,
            });
          } else {
            console.log(
              `⚠️  No vector embeddings found - trying different approach`
            );
            // Try searching all documents without query
            const allDocs = await this.supabaseClient
              .from("documents")
              .select("*, metadata")
              .limit(maxResults || 20);

            if (allDocs.data && allDocs.data.length > 0) {
              console.log(
                `🔍 Found ${allDocs.data.length} documents in database`
              );
              const formattedResults = allDocs.data
                .filter((doc: any) => {
                  if (
                    filters?.excludeUserId &&
                    doc.user_id === filters.excludeUserId
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((doc: any) => {
                  const metadata =
                    typeof doc.metadata === "string"
                      ? JSON.parse(doc.metadata)
                      : doc.metadata;
                  return {
                    userId: doc.user_id,
                    name: metadata.name || "Unknown",
                    title: metadata.title || "Professional",
                    company: metadata.company || "Company",
                    location: metadata.location || "Location",
                    skills: metadata.skills || [],
                    interests: metadata.interests || [],
                    preferences: metadata.preferences || {},
                    semanticTags: metadata.semantic_tags || [],
                    similarityScore: 0.7, // Default similarity
                    profileContent:
                      doc.content?.substring(0, 500) || "Profile content",
                  };
                });

              return {
                success: true,
                results: formattedResults,
                totalFound: formattedResults.length,
              };
            }

            return {
              success: true,
              results: [],
              totalFound: 0,
            };
          }

          const formattedResults = searchResults
            .filter(([doc, score]) => {
              // Apply filters
              if (
                filters?.excludeUserId &&
                doc.metadata.user_id === filters.excludeUserId
              ) {
                return false;
              }
              if (filters?.minSimilarity && score < filters.minSimilarity) {
                return false;
              }
              return true;
            })
            .map(([doc, score]) => ({
              userId: doc.metadata.user_id,
              name: doc.metadata.name,
              title: doc.metadata.title,
              company: doc.metadata.company,
              location: doc.metadata.location,
              skills: doc.metadata.skills || [],
              interests: doc.metadata.interests || [],
              preferences: doc.metadata.preferences || {},
              semanticTags: doc.metadata.semantic_tags || [],
              similarityScore: score,
              profileContent: doc.pageContent.substring(0, 500),
            }));

          console.log(`🔍 Vector search formatted results:`, JSON.stringify(formattedResults.slice(0, 2), null, 2));

          return {
            success: true,
            results: formattedResults,
            totalFound: formattedResults.length,
          };
        } catch (error) {
          console.error("Vector search error:", error);
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Vector search failed",
            results: [],
          };
        }
      },
      {
        name: "vector_search_profiles",
        description: `Search for similar user profiles using vector similarity. This tool finds real users from the database based on semantic similarity. 

USAGE EXAMPLES:
- query: "software engineer AI machine learning startup" (combines skills and interests)
- query: "fintech blockchain cryptocurrency trading" (industry-specific terms)
- query: "project manager agile scrum team leadership" (role and skills)
- filters: {excludeUserId: "requesting_user_id", minSimilarity: 0.6}

RETURNS: Real user IDs and profile data from the database. Use these user IDs in subsequent tool calls.`,
        schema: z.object({
          query: z
            .string()
            .describe("Search query combining skills, interests, industry terms, and roles"),
          filters: z
            .object({
              excludeUserId: z.string().optional().describe("User ID to exclude from results"),
              minSimilarity: z.number().optional().describe("Minimum similarity score (0-1)"),
              location: z.string().optional().describe("Location filter"),
            })
            .optional(),
          maxResults: z
            .number()
            .optional()
            .describe("Maximum number of results to return (default 20)"),
        }),
      }
    );
  }

  /**
   * Fallback vector search using LangChain
   */
  private async fallbackVectorSearch(
    query: string,
    filters: any,
    maxResults: number
  ) {
    try {
      console.log(`🔄 Using LangChain fallback for vector search`);

      const searchResults = await this.vectorStore.similaritySearchWithScore(
        query,
        maxResults || 20
      );

      console.log(
        `🔍 LangChain vector search found ${searchResults.length} profiles`
      );

      if (searchResults.length > 0) {
        console.log(`🔍 Sample result:`, {
          id: searchResults[0][0].metadata.user_id,
          name: searchResults[0][0].metadata.name,
          score: searchResults[0][1],
        });
      } else {
        console.log(`⚠️ No vector embeddings found in LangChain store`);
        return {
          success: true,
          results: [],
          totalFound: 0,
        };
      }

      const formattedResults = searchResults
        .filter(([doc, score]) => {
          // Apply filters
          if (
            filters?.excludeUserId &&
            doc.metadata.user_id === filters.excludeUserId
          ) {
            return false;
          }
          if (filters?.minSimilarity && score < filters.minSimilarity) {
            return false;
          }
          return true;
        })
        .map(([doc, score]) => ({
          userId: doc.metadata.user_id,
          name: doc.metadata.name,
          title: doc.metadata.title,
          company: doc.metadata.company,
          location: doc.metadata.location,
          skills: doc.metadata.skills || [],
          interests: doc.metadata.interests || [],
          preferences: doc.metadata.preferences || {},
          semanticTags: doc.metadata.semantic_tags || [],
          similarityScore: score,
          profileContent: doc.pageContent.substring(0, 500),
        }));

      return {
        success: true,
        results: formattedResults,
        totalFound: formattedResults.length,
      };
    } catch (error) {
      console.error("❌ Fallback vector search failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Vector search failed",
        results: [],
        totalFound: 0,
      };
    }
  }

  /**
   * User Profile Tool for getting detailed user information
   */
  private createUserProfileTool() {
    return tool(
      async ({ userId }) => {
        try {
          const { data: user, error } = await this.supabaseClient
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();

          if (error || !user) {
            return {
              success: false,
              error: "User not found",
            };
          }

          return {
            success: true,
            user: {
              id: user.id,
              name: user.name,
              title: user.title,
              company: user.company,
              location: user.location,
              bio: user.bio,
              skills: user.skills || [],
              interests: user.interests || [],
              preferences: user.preferences || {},
              connections: user.stats?.connections || 0,
            },
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Failed to fetch user",
          };
        }
      },
      {
        name: "get_user_profile",
        description: `Get detailed user profile information from the database. Use this tool multiple times:
        
1. FIRST: Get the requesting user's profile to understand their background
2. THEN: Get profiles for each user found by vector_search_profiles
3. Use the returned data for compatibility analysis

RETURNS: Real user data including skills, interests, preferences, company, location, etc.`,
        schema: z.object({
          userId: z.string().describe("Real user ID from database (never create fake IDs)"),
        }),
      }
    );
  }

  /**
   * Compatibility Analysis Tool using AI reasoning
   */
  private createCompatibilityAnalysisTool() {
    return tool(
      async ({ currentUser, targetUser, matchingType }) => {
        try {
          const analysisPrompt = `
Analyze the compatibility between these two professionals for ${matchingType} purposes:

CURRENT USER:
Name: ${currentUser.name}
Title: ${currentUser.title}
Company: ${currentUser.company}
Location: ${currentUser.location}
Skills: ${currentUser.skills.join(", ")}
Interests: ${currentUser.interests.join(", ")}
Preferences: ${Object.entries(currentUser.preferences)
            .filter(([_, value]) => value)
            .map(([key, _]) => key)
            .join(", ")}

TARGET USER:
Name: ${targetUser.name}
Title: ${targetUser.title}
Company: ${targetUser.company}
Location: ${targetUser.location}
Skills: ${targetUser.skills.join(", ")}
Interests: ${targetUser.interests.join(", ")}
Preferences: ${Object.entries(targetUser.preferences)
            .filter(([_, value]) => value)
            .map(([key, _]) => key)
            .join(", ")}

Provide a detailed compatibility analysis with:
1. Compatibility score (0-100)
2. Match reasons (specific, actionable reasons)
3. Shared interests
4. Complementary skills
5. AI reasoning (2-3 sentences explaining the match quality)
6. Recommendation strength (high/medium/low)

Return as JSON format.`;

          const response = await this.llm.invoke([
            new HumanMessage(analysisPrompt),
          ]);
          const content = response.content as string;

          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            return {
              success: true,
              analysis,
            };
          }

          // Fallback analysis
          return {
            success: true,
            analysis: {
              compatibilityScore: 50,
              matchReasons: ["Professional networking opportunity"],
              sharedInterests: [],
              complementarySkills: [],
              aiReasoning: "Basic professional compatibility detected.",
              recommendationStrength: "medium",
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Analysis failed",
          };
        }
      },
      {
        name: "analyze_compatibility",
        description:
          "Analyze compatibility between two users using AI reasoning",
        schema: z.object({
          currentUser: z.object({
            name: z.string(),
            title: z.string(),
            company: z.string(),
            location: z.string(),
            skills: z.array(z.string()),
            interests: z.array(z.string()),
            preferences: z.record(z.boolean()),
          }),
          targetUser: z.object({
            name: z.string(),
            title: z.string(),
            company: z.string(),
            location: z.string(),
            skills: z.array(z.string()),
            interests: z.array(z.string()),
            preferences: z.record(z.boolean()),
          }),
          matchingType: z.string(),
        }),
      }
    );
  }

  /**
   * System prompt for the matching agent
   */
  private getSystemPrompt(): SystemMessage {
    return new SystemMessage({
      content: `You are an intelligent professional networking matching agent. You have access to tools that provide real data from the database. You MUST use these tools and then analyze the results to create matches.

� CRITICAL WORKFLOW - FOLLOW EXACTLY:

1. FIRST: Call get_user_profile(userId: "requesting_user_id") to understand who is requesting matches
2. SECOND: Call vector_search_profiles with a query based on the user's skills/interests  
3. THIRD: Analyze the vector search results and select the best candidates
4. FOURTH: Return a JSON array with real user IDs from the vector search results

🎯 EXAMPLE WORKFLOW:

When you get vector search results like:
[{userId: "63b42074-e408-4362-a874-035ea22da5f1", name: "Ahmmad Nur Swapnil", skills: ["JavaScript", "Node.js"], ...}]

You MUST return matches using those EXACT user IDs:
[
  {
    "user_id": "63b42074-e408-4362-a874-035ea22da5f1",
    "compatibilityScore": 75,
    "reasoning": "Both have JavaScript skills and share interest in DevOps",
    "commonInterests": ["DevOps", "JavaScript"],
    "complementarySkills": ["Node.js", "Data Science"]
  }
]

🔧 CRITICAL RULES:
- NEVER return empty array [] unless vector search finds NO users
- ALWAYS use real user_id values from vector search tool results
- NEVER create fake UUIDs or placeholder data
- Base compatibilityScore on actual shared skills/interests from tool data
- Include specific reasoning based on the actual user profiles

� MATCHING CRITERIA:
- Skills overlap (JavaScript, Python, etc.)
- Interest alignment (AI, DevOps, Fintech, etc.) 
- Complementary experience levels
- Geographic proximity
- Professional context (company, industry)

🎯 FINAL OUTPUT FORMAT:
After using tools and finding users, return this JSON structure with REAL user IDs:

[
  {
    "user_id": "real_uuid_from_vector_search",
    "compatibilityScore": 85,
    "reasoning": "Specific match reasoning based on tool data",
    "commonInterests": ["Actual shared interests"],
    "complementarySkills": ["Actual complementary skills"]
  }
]

🚨 REMEMBER: Use the tool results to create meaningful matches. Don't return empty arrays when users are found!`,
    });
  }

  /**
   * Enrich AI analysis with complete user data from database
   */
  private async enrichMatchesWithUserData(
    aiAnalysis: any[]
  ): Promise<EnhancedMatch[]> {
    if (!aiAnalysis || aiAnalysis.length === 0) {
      return [];
    }

    try {
      // Extract user IDs from AI analysis
      const userIds = aiAnalysis
        .map((match) => match.user_id)
        .filter((id) => id && typeof id === "string");

      console.log(`🔍 AI Analysis user IDs:`, userIds);
      console.log(`🔍 Full AI Analysis:`, JSON.stringify(aiAnalysis, null, 2));

      if (userIds.length === 0) {
        console.log("⚠️  No valid user IDs found in AI analysis");
        return [];
      }

      console.log(`🔍 Fetching user data for ${userIds.length} users`);

      // Fetch complete user profiles from database
      const { data: users, error } = await this.supabaseClient
        .from("users")
        .select(
          `
          id,
          name,
          title,
          company,
          location,
          bio,
          avatar_url,
          preferences,
          skills,
          interests,
          stats,
          created_at
        `
        )
        .in("id", userIds);

      if (error) {
        console.error("Database error fetching users:", error);
        return [];
      }

      if (!users || users.length === 0) {
        console.log("⚠️  No users found in database");
        return [];
      }

      console.log(`✅ Fetched ${users.length} user profiles from database`);

      // Merge AI analysis with database user data
      const enhancedMatches = aiAnalysis
        .map((analysis) => {
          const user = users.find((u: any) => u.id === analysis.user_id);
          if (!user) {
            console.log(`⚠️  User ${analysis.user_id} not found in database`);
            return null;
          }

          return {
            user: {
              id: user.id,
              name: user.name || "Unknown",
              title: user.title || "Professional",
              company: user.company || "Company",
              location: user.location || "Location not specified",
              bio: user.bio || `${user.title} at ${user.company}`,
              avatar: user.avatar_url || "/placeholder-user.jpg", // Changed from avatar_url to avatar
              phone: user.phone || "",
              website: user.website || "",
              preferences: user.preferences || {
                mentor: false,
                invest: false,
                discuss: true,
                collaborate: true,
                hire: false,
              },
              skills: user.skills || [],
              interests: user.interests || [],
              connections: user.stats?.connections || 0,
              collaborations: user.stats?.collaborations || 0,
              mentorships: user.stats?.mentorships || 0,
              investments: user.stats?.investments || 0,
              discussions: user.stats?.discussions || 0,
              joinedDate: user.created_at
                ? new Date(user.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })
                : "Recently",
              isAdmin: user.is_admin || false,
              settings: user.settings || {},
            },
            compatibilityScore: analysis.compatibilityScore || 75,
            matchReasons: [analysis.reasoning || "Professional compatibility"], // Changed from reasoning to matchReasons array
            sharedInterests: analysis.commonInterests || [], // Changed from matchedInterests to sharedInterests
            complementarySkills: analysis.complementarySkills || [], // Keep complementarySkills as is
            matchType: "collaboration",
            confidence: analysis.compatibilityScore || 75,
            // Add missing fields for EnhancedMatch type
            semanticSimilarity: analysis.compatibilityScore / 100 || 0.75,
            profileStrength: 0.8, // Default value
            networkRelevance: 0.7, // Default value
            locationCompatibility: 0.8, // Default value
            aiReasoning: analysis.reasoning || "Professional compatibility",
            matchingCategory: "collaboration", // Default category
            recommendationStrength: (analysis.compatibilityScore >= 80
              ? "high"
              : analysis.compatibilityScore >= 60
              ? "medium"
              : "low") as "high" | "medium" | "low",
          };
        })
        .filter((match) => match !== null);

      console.log(`✅ Created ${enhancedMatches.length} enhanced matches`);
      return enhancedMatches as EnhancedMatch[];
    } catch (error) {
      console.error("Error enriching matches with user data:", error);
      return [];
    }
  }

  /**
   * LLM node that can call tools or respond
   */
  private async agentNode(state: typeof MessagesAnnotation.State) {
    console.log("---CALL AGENT---");
    
    // Bind tools to the LLM
    const llmWithTools = this.llm.bindTools(this.tools);
    
    const response = await llmWithTools.invoke([
      this.getSystemPrompt(),
      ...state.messages,
    ]);
    
    return { messages: [response] };
  }

  /**
   * Conditional edge to route to tools or end
   */
  private shouldContinue(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1];
    console.log("---DECIDE TO CONTINUE---");
    
    // Check for tool calls in the message
    if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
      console.log("---DECISION: USE TOOLS---");
      return "tools";
    }
    
    console.log("---DECISION: END---");
    return END;
  }

  /**
   * Create the matching agent workflow
   */
  private createAgent() {
    const workflow = new StateGraph(MessagesAnnotation)
      .addNode("agent", this.agentNode.bind(this))
      .addNode("tools", this.toolNode)
      .addEdge(START, "agent")
      .addConditionalEdges("agent", this.shouldContinue.bind(this))
      .addEdge("tools", "agent");

    return workflow.compile();
  }

  /**
   * Main method to find matches using RAG agent
   */
  async findMatches(
    request: MatchingRequest,
    forceRefresh: boolean = false
  ): Promise<{
    success: boolean;
    matches?: EnhancedMatch[];
    totalFound?: number;
    processingTime?: number;
    cacheUsed?: boolean;
    cacheAge?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      console.log(
        `🎯 Finding ${request.matchingType} matches for user: ${request.userId}`
      );

      // Validate request
      const validatedRequest = MatchingRequestSchema.parse(request);

      // Check for cached matches first (unless force refresh)
      if (!forceRefresh) {
        const cacheResult = await this.checkCachedMatches(
          validatedRequest.userId
        );

        if (cacheResult.cached) {
          // Check if cache is still valid (not expired)
          const maxCacheAge = 6 * 60; // 6 hours in minutes
          if (cacheResult.cacheAge! < maxCacheAge) {
            console.log(
              `🚀 Returning cached matches (${cacheResult.cacheAge} minutes old)`
            );
            const processingTime = Date.now() - startTime;

            return {
              success: true,
              matches: cacheResult.matches || [],
              totalFound: cacheResult.matches?.length || 0,
              processingTime,
              cacheUsed: true,
              cacheAge: cacheResult.cacheAge,
            };
          } else {
            console.log(
              `⏰ Cache expired (${cacheResult.cacheAge} minutes old), generating fresh matches`
            );
          }
        }
      } else {
        console.log(`🔄 Force refresh requested, bypassing cache`);
      }

      console.log(`🤖 Running AI agent to find fresh matches...`);

      // Create the agent
      const agent = this.createAgent();

      // Prepare the matching query
      const matchingQuery = new HumanMessage({
        content: `Find professional matches for user ${validatedRequest.userId} using these criteria:

- Matching Type: ${validatedRequest.matchingType}
- Max Results: ${validatedRequest.maxResults}
- Min Compatibility: ${validatedRequest.minCompatibility}%
- Location Preference: ${validatedRequest.locationPreference}

STEP-BY-STEP INSTRUCTIONS:
1. Call get_user_profile(userId: "${validatedRequest.userId}") to get the requesting user's details
2. Call vector_search_profiles with a query based on their skills and interests
3. Review the vector search results - if users are found, create matches using their user IDs
4. Return JSON array with real user IDs from vector search results

IMPORTANT: If vector search finds users (like in the examples showing 15 profiles found), you MUST create matches from those results. Do NOT return an empty array when real users are available!

Create meaningful matches based on the actual tool results!`,
      });

      // Execute the agent
      const result = await agent.invoke({
        messages: [matchingQuery],
      });

      // Extract matches from the agent response
      const lastMessage = result.messages[result.messages.length - 1];
      console.log("🔍 Last message type:", typeof lastMessage.content);
      console.log("🔍 Last message content:", lastMessage.content);
      
      // Handle different content types
      let responseContent: string;
      if (typeof lastMessage.content === 'string') {
        responseContent = lastMessage.content;
      } else if (Array.isArray(lastMessage.content)) {
        // Handle array of content blocks
        responseContent = lastMessage.content
          .map(block => {
            if (typeof block === 'string') return block;
            if (typeof block === 'object' && block !== null) {
              // Handle different block types
              if ('text' in block) return block.text;
              if ('content' in block) return String(block.content);
              return JSON.stringify(block);
            }
            return String(block);
          })
          .join('\n');
      } else {
        // Convert to string as fallback
        responseContent = String(lastMessage.content);
      }

      // Parse the agent's response to extract AI analysis
      const aiAnalysis = this.parseMatchingResponse(responseContent);

      // Fetch complete user profiles from database
      const enhancedMatches = await this.enrichMatchesWithUserData(aiAnalysis);

      const processingTime = Date.now() - startTime;

      console.log(
        `✅ Found ${enhancedMatches.length} matches in ${processingTime}ms`
      );

      // Store matches in cache for future requests (don't wait for completion)
      this.storeCachedMatches(
        validatedRequest.userId,
        enhancedMatches,
        processingTime,
        enhancedMatches.length
      ).catch((error) => {
        console.warn("⚠️ Failed to cache matches:", error);
      });

      return {
        success: true,
        matches: enhancedMatches,
        totalFound: enhancedMatches.length,
        processingTime,
        cacheUsed: false,
        cacheAge: 0,
      };
    } catch (error) {
      console.error("Error in RAG matching:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Matching failed",
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Parse the agent's response to extract structured matches
   */
  private parseMatchingResponse(response: string | any): any[] {
    try {
      // Ensure response is a string
      const responseStr = typeof response === 'string' ? response : String(response);
      
      console.log("🔍 Raw agent response:", responseStr.substring(0, 2000) + (responseStr.length > 2000 ? "..." : ""));

      // First try to parse the entire response as JSON
      try {
        const parsed = JSON.parse(responseStr);
        if (Array.isArray(parsed)) {
          console.log("✅ Successfully parsed full response as JSON array:", parsed.length);
          return parsed;
        } else {
          console.log("⚠️ Parsed response is not an array:", typeof parsed);
        }
      } catch (e) {
        console.log("❌ Failed to parse full response as JSON:", e instanceof Error ? e.message : String(e));
      }

      // Try to extract JSON array with more flexible patterns
      const patterns = [
        /\[[\s\S]*?\]/g, // Match any array
        /```json\s*(\[[\s\S]*?\])\s*```/g, // Match code blocks
        /```\s*(\[[\s\S]*?\])\s*```/g, // Match code blocks without json
        /"matches":\s*(\[[\s\S]*?\])/g, // Match matches property
      ];

      for (const pattern of patterns) {
        const matches = [...responseStr.matchAll(pattern)];
        for (const match of matches) {
          try {
            const jsonStr = match[1] || match[0];
            console.log("🔍 Trying to parse extracted JSON:", jsonStr.substring(0, 1000) + (jsonStr.length > 1000 ? "..." : ""));
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log("✅ Successfully parsed matches from pattern:", parsed.length);
              // Validate that items have user_id
              const hasUserIds = parsed.some(item => item && typeof item === 'object' && item.user_id);
              if (hasUserIds) {
                console.log("✅ Parsed items contain user_id fields");
                return parsed;
              } else {
                console.log("⚠️ Parsed items missing user_id fields:", parsed[0]);
              }
            }
          } catch (e) {
            console.log("❌ Failed to parse pattern match:", e instanceof Error ? e.message : String(e));
            continue;
          }
        }
      }

      // Try to clean up the response and parse again
      let cleanResponse = responseStr
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .replace(/^[^[\{]*/, "") // Remove text before JSON
        .replace(/[^}\]]*$/, ""); // Remove text after JSON

      console.log("🔍 Trying cleaned response:", cleanResponse.substring(0, 1000) + (cleanResponse.length > 1000 ? "..." : ""));

      try {
        const parsed = JSON.parse(cleanResponse);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log("✅ Successfully parsed cleaned response:", parsed.length);
          // Validate that items have user_id
          const hasUserIds = parsed.some(item => item && typeof item === 'object' && item.user_id);
          if (hasUserIds) {
            console.log("✅ Cleaned items contain user_id fields");
            return parsed;
          } else {
            console.log("⚠️ Cleaned items missing user_id fields:", JSON.stringify(parsed[0], null, 2));
          }
        }
      } catch (e) {
        console.log("❌ Failed to parse cleaned response:", e instanceof Error ? e.message : String(e));
      }

      // If all else fails, try to extract individual match objects
      console.log("🔍 Trying to extract individual match objects...");
      const objectMatches = [
        ...responseStr.matchAll(/\{[^{}]*"user_id"[^{}]*\}/g),
      ];
      
      if (objectMatches.length > 0) {
        console.log(`🔍 Found ${objectMatches.length} potential match objects`);
        const extractedMatches = [];
        for (const objMatch of objectMatches) {
          try {
            console.log("🔍 Trying to parse object:", objMatch[0].substring(0, 100) + "...");
            const parsed = JSON.parse(objMatch[0]);
            if (parsed.user_id) {
              extractedMatches.push(parsed);
              console.log("✅ Successfully parsed match object with user_id:", parsed.user_id);
            }
          } catch (e) {
            console.log("❌ Failed to parse object:", e instanceof Error ? e.message : String(e));
            continue;
          }
        }
        if (extractedMatches.length > 0) {
          console.log("✅ Extracted individual matches:", extractedMatches.length);
          return extractedMatches;
        }
      }

      console.warn("⚠️ Could not parse any valid matches from agent response");
      console.log("Full response for debugging:", responseStr);
      return [];
    } catch (error) {
      console.error("❌ Error parsing matching response:", error);
      const responseStr = typeof response === 'string' ? response : String(response);
      console.log("Response that failed parsing:", responseStr.substring(0, 2000) + (responseStr.length > 2000 ? "..." : ""));
      return [];
    }
  }

  /**
   * Batch process multiple matching requests
   */
  async batchFindMatches(requests: MatchingRequest[]): Promise<{
    success: boolean;
    results: Array<{
      userId: string;
      matches: EnhancedMatch[];
      error?: string;
    }>;
  }> {
    const results = [];

    for (const request of requests) {
      const result = await this.findMatches(request);
      results.push({
        userId: request.userId,
        matches: result.matches || [],
        error: result.error,
      });
    }

    return {
      success: true,
      results,
    };
  }

  /**
   * Get user's networking recommendations based on their profile
   */
  async getNetworkingRecommendations(userId: string): Promise<{
    success: boolean;
    recommendations?: {
      mentorship: EnhancedMatch[];
      collaboration: EnhancedMatch[];
      investment: EnhancedMatch[];
      hiring: EnhancedMatch[];
      discussion: EnhancedMatch[];
    };
    error?: string;
  }> {
    try {
      const matchingTypes: Array<MatchingRequest["matchingType"]> = [
        "mentorship",
        "collaboration",
        "investment",
        "hiring",
        "discussion",
      ];

      const recommendations: any = {};

      for (const type of matchingTypes) {
        const result = await this.findMatches({
          userId,
          matchingType: type,
          maxResults: 5,
          minCompatibility: 50,
          locationPreference: "global",
          includeProfileIntelligence: true,
        });

        recommendations[type] = result.matches || [];
      }

      return {
        success: true,
        recommendations,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get recommendations",
      };
    }
  }
}

export type { MatchingRequest, EnhancedMatch, MatchingUser };

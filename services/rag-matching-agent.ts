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
  avatar?: string;
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
  matchTypes: string[]; // AI-determined match types (e.g., ["Mentor", "Collaborator"])
  recommendationStrength: "high" | "medium" | "low";
}

// Matching Request Schema
const MatchingRequestSchema = z.object({
  userId: z.string(),
  maxResults: z.number().min(1).max(50).default(10),
  minCompatibility: z.number().min(10).max(100).default(40),
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
      temperature: 0.3, // Lower temperature for more consistent matching
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
      this.createUserVectorContentTool(),
    ];

    this.toolNode = new ToolNode(this.tools);

    console.log("🤖 RAG Matching Agent initialized successfully");
  }

  /**
   * Validate user IDs against database to filter out fake/invalid IDs and exclude current user
   */
  private async validateUserIds(
    userIds: string[],
    excludeUserId?: string
  ): Promise<string[]> {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    try {
      console.log(`🔍 Validating ${userIds.length} user IDs against database`);

      const { data: validUsers, error } = await this.supabaseClient
        .from("users")
        .select("id")
        .in("id", userIds);

      if (error) {
        console.error("❌ Error validating user IDs:", error);
        return userIds.filter((id) => id !== excludeUserId); // Return all except current user if validation fails
      }

      const validIds = validUsers?.map((user: any) => user.id) || [];

      // Filter out the current user from valid IDs
      const filteredIds = excludeUserId
        ? validIds.filter((id: string) => id !== excludeUserId)
        : validIds;

      const invalidIds = userIds.filter((id) => !validIds.includes(id));
      const excludedCount = validIds.length - filteredIds.length;

      if (invalidIds.length > 0) {
        console.log(
          `⚠️  Filtered out ${invalidIds.length} invalid user IDs:`,
          invalidIds
        );
      }

      if (excludedCount > 0) {
        console.log(`🚫 Excluded current user from matches: ${excludeUserId}`);
      }

      console.log(
        `✅ Validated ${filteredIds.length} user IDs (excluding current user)`
      );
      return filteredIds;
    } catch (error) {
      console.error("❌ User ID validation failed:", error);
      return userIds; // Return all if validation fails
    }
  }

  /**
   * Check if cached AI analysis exists and is valid
   */
  /**
   * Check if cached AI analysis exists and is valid
   */
  private async checkCachedMatches(userId: string): Promise<{
    cached: boolean;
    aiAnalysis?: any[];
    cacheAge?: number;
    metadata?: any;
  }> {
    try {
      console.log(`🔍 Checking AI analysis cache for user ${userId}`);

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
        console.log("📭 No cached AI analysis found");
        return { cached: false };
      }

      const cacheEntry = data[0];
      console.log(
        `✅ Found cached AI analysis: ${cacheEntry.total_matches} matches, ${cacheEntry.cache_age_minutes} minutes old`
      );

      return {
        cached: true,
        aiAnalysis: cacheEntry.matches_data || [],
        cacheAge: cacheEntry.cache_age_minutes,
        metadata: cacheEntry.cache_metadata,
      };
    } catch (error) {
      console.error("❌ Cache check failed:", error);
      return { cached: false };
    }
  }

  /**
   * Store AI analysis in cache (without user data enrichment)
   */
  private async storeCachedAIAnalysis(
    userId: string,
    aiAnalysis: any[],
    processingTime?: number,
    totalProfilesAnalyzed?: number,
    cacheHours: number = 24
  ): Promise<boolean> {
    try {
      // Validate user IDs before caching (exclude current user from matches)
      const userIds = aiAnalysis
        .map((match) => match.user_id)
        .filter((id) => id && typeof id === "string");

      const validUserIds = await this.validateUserIds(userIds, userId);

      // Filter AI analysis to only include validated user IDs
      const validAIAnalysis = aiAnalysis.filter((match) =>
        validUserIds.includes(match.user_id)
      );

      if (validAIAnalysis.length === 0) {
        console.log(
          "⚠️ No valid user IDs found after validation, skipping cache"
        );
        return false;
      }

      console.log(
        `💾 Storing ${validAIAnalysis.length} AI analysis results in cache for user ${userId} (filtered from ${aiAnalysis.length})`
      );

      const cacheMetadata = {
        ai_processing_time: processingTime || 0,
        total_profiles_analyzed: totalProfilesAnalyzed || 0,
        cache_version: "2.0",
        cached_at: new Date().toISOString(),
        original_count: aiAnalysis.length,
        validated_count: validAIAnalysis.length,
      };

      const { data, error } = await this.supabaseClient.rpc(
        "upsert_matches_cache",
        {
          p_user_id: userId,
          p_matching_type: "all", // Still send but ignored by simplified function
          p_matches_data: validAIAnalysis, // Only store AI analysis, not enriched data
          p_total_matches: validAIAnalysis.length,
          p_cache_metadata: cacheMetadata,
          p_cache_hours: cacheHours,
        }
      );

      if (error) {
        console.error("❌ Cache storage error:", error);
        return false;
      }

      console.log(`✅ AI analysis cached successfully (ID: ${data})`);
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

          console.log(
            `🔍 Vector search formatted results:`,
            JSON.stringify(formattedResults.slice(0, 2), null, 2)
          );

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
        description: `Search for similar user profiles using vector similarity with SEMANTIC UNDERSTANDING. This tool finds real users based on meaning, context, and professional synergy - not just exact keyword matches.

🧠 SEMANTIC STRATEGIES: Combine related technologies, conceptual terms, context words, ecosystem terms, locations, roles, and industries.

✨ COMPREHENSIVE QUERY EXAMPLES:
- "software engineer San Francisco startup JavaScript React frontend web development"
- "data scientist New York fintech machine learning python analytics AI banking"
- "product manager London healthcare startup user experience design strategy"
- "DevOps engineer Berlin cloud infrastructure automation AWS docker kubernetes"

🎯 INCLUDE IN QUERIES: Skills + Location + Industry/Company type + Role for best semantic matching.

RETURNS: Real user profiles with semantic similarity scores including location, title, company context.`,
        schema: z.object({
          query: z
            .string()
            .describe(
              "Comprehensive search query combining skills, interests, location, title/role, industry, and company context for semantic matching"
            ),
          filters: z
            .object({
              excludeUserId: z
                .string()
                .optional()
                .describe("User ID to exclude from results"),
              minSimilarity: z
                .number()
                .optional()
                .describe("Minimum similarity score (0-1)"),
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
          userId: z
            .string()
            .describe("Real user ID from database (never create fake IDs)"),
        }),
      }
    );
  }

  /**
   * User Vector Content Tool - Get comprehensive profile intelligence and vector embeddings
   */
  private createUserVectorContentTool() {
    return tool(
      async ({ userId }) => {
        try {
          console.log(`🔍 Fetching vector content for user: ${userId}`);

          // Get all documents for this user (including profile intelligence)
          const { data: documents, error: docError } = await this.supabaseClient
            .from("documents")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (docError) {
            console.error("Error fetching user documents:", docError);
            return {
              success: false,
              error: "Failed to fetch user documents",
            };
          }

          if (!documents || documents.length === 0) {
            console.log(
              `⚠️ No vector documents found for user ${userId}, falling back to user profile`
            );

            // Fallback to user profile when no vector content exists
            try {
              const { data: user, error: userError } = await this.supabaseClient
                .from("users")
                .select("*")
                .eq("id", userId)
                .single();

              if (userError || !user) {
                return {
                  success: false,
                  error:
                    "No vector content found and user profile fetch failed",
                };
              }

              // Return just content as fallback (user profile doesn't have rich content)
              return {
                success: true,
                content: `Name: ${user.name || "Unknown"}
Title: ${user.title || "Professional"}
Company: ${user.company || ""}
Location: ${user.location || ""}
Bio: ${user.bio || "Not specified"}
Email: ${user.email || ""}
Phone: ${user.phone || ""}
Website: ${user.website || ""}
Skills: ${(user.skills || []).join(", ")}
Interests: ${(user.interests || []).join(", ")}
Preferences: ${Object.entries(user.preferences || {})
                  .filter(([_, value]) => value)
                  .map(([key, _]) => key)
                  .join(", ")}
Avatar: ${user.avatar_url || ""}
Connections: ${user.stats?.connections || 0}
Collaborations: ${user.stats?.collaborations || 0}
Mentorships: ${user.stats?.mentorships || 0}
Investments: ${user.stats?.investments || 0}
Discussions: ${user.stats?.discussions || 0}
Joined: ${
                  user.created_at
                    ? new Date(user.created_at).toLocaleDateString()
                    : "Recently"
                }`,
                totalDocuments: 0,
                hasProfileIntelligence: false,
                fallbackUsed: true,
                fallbackSource: "user_profile",
              };
            } catch (fallbackError) {
              return {
                success: false,
                error: "Both vector content and user profile fetch failed",
              };
            }
          }

          console.log(
            `✅ Found ${documents.length} documents for user ${userId}`
          );

          // Parse and organize the documents
          const profileIntelligence = documents.find(
            (doc: any) =>
              doc.metadata?.type === "profile_intelligence" ||
              doc.content?.includes("Professional Summary:")
          );

          const semanticProfile = documents.find(
            (doc: any) =>
              doc.metadata?.semantic_tags &&
              Array.isArray(doc.metadata.semantic_tags)
          );

          // Return only the content directly
          return {
            success: true,
            content: profileIntelligence?.content || null,
            totalDocuments: documents.length,
            hasProfileIntelligence: !!profileIntelligence,
          };
        } catch (error) {
          console.error("Error in vector content tool:", error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Vector content fetch failed",
          };
        }
      },
      {
        name: "get_user_vector_content",
        description: `Get complete profile intelligence content for the REQUESTING USER ONLY. 

🎯 RETURNS: Full profile intelligence content with professional summary, analysis, and insights.

🚨 USE ONLY for requesting user. For finding others, use vector_search_profiles + get_user_profile.

✅ Auto-fallback to user profile data if no vector content exists.`,
        schema: z.object({
          userId: z
            .string()
            .describe(
              "User ID to get complete vector content and profile intelligence for"
            ),
        }),
      }
    );
  }

  /**
   * System prompt for the matching agent
   */
  private getSystemPrompt(): SystemMessage {
    return new SystemMessage({
      content: `You are an intelligent professional networking matching agent specializing in SEMANTIC SIMILARITY and creating MULTIPLE meaningful matches. When vector search finds profiles, you should analyze most of them and return several matches, not just the top one.

🔄 CRITICAL WORKFLOW - FOLLOW EXACTLY:

1. FIRST: Call get_user_vector_content(userId: "requesting_user_id") to get COMPLETE context for the REQUESTING USER ONLY (includes profile intelligence, web research, semantic tags)
2. SECOND: Call vector_search_profiles with COMPREHENSIVE SEMANTIC query based on requesting user's complete information
3. THIRD: Use vector_search_profiles multiple times as needed to find diverse matches with different semantic queries
4. FOURTH: Optionally call get_user_profile for specific users found via vector search if you need additional details
5. FIFTH: Analyze ALL vector search results and return users based on the minimum compatibility threshold provided
6. SIXTH: If fewer users meet the threshold, include lower-scored users to reach the requested number of matches

🎯 TOOL USAGE STRATEGY:
- get_user_vector_content: ONLY for requesting user (rich context with intelligence)
- vector_search_profiles: PRIMARY tool for finding matches (use multiple times with different queries)
- get_user_profile: Optional for additional details on specific found users (usually not needed)

🧠 SEMANTIC MATCHING PHILOSOPHY:
- "JavaScript" and "React" are part of the same ecosystem
- "DevOps" connects to "Infrastructure", "Cloud", "Automation"
- "Data Science" relates to "Machine Learning", "Analytics", "AI"
- "Fintech" aligns with "Banking", "Payments", "Investment"
- Different experience levels create mentoring opportunities
- BUSINESS RELATIONSHIPS: Look for investment opportunities (VCs, angels, entrepreneurs), hiring needs (CTOs, managers, specialists)
- HIRING OPPORTUNITIES: CTOs/managers seek talent, developers/specialists seek roles, company growth creates hiring needs
- INVESTMENT CONNECTIONS: Entrepreneurs need funding, VCs/angels provide capital, sector expertise matters
- PREFERENCES matter: mentor+mentee seeking, invest+funding needs, collaborate+collaborate willingness, discuss+discuss interest, hire+hiring needs
- LOCATION matters: Same city/region increases collaboration potential
- TITLE/ROLE matters: Similar roles share challenges, different roles offer perspective
- COMPANY/INDUSTRY matters: Same industry understands context, different industries bring fresh ideas

🎯 COMPATIBILITY SCORING STRATEGY:
Return users based on the provided compatibility threshold - consider SKILLS, INTERESTS, PREFERENCES, LOCATION, TITLE, and COMPANY:
- High compatibility (80-95%): Direct skill/interest overlap + preference alignment + location/industry synergy
- Medium compatibility (60-79%): Complementary skills + preference match + same location OR same industry  
- Acceptable compatibility (40-59%): Professional growth opportunities + some preference overlap + geographic feasibility
- Lower compatibility (25-39%): Include only if needed to reach the requested number of matches

🎯 MATCHING FACTORS TO CONSIDER:
1. SKILLS & INTERESTS: Technical/domain overlap and complementarity (primary factor)
2. PREFERENCES: User collaboration preferences alignment (mentor, invest, discuss, collaborate, hire)
3. LOCATION: Geographic proximity for collaboration, meetings, events
4. TITLE/ROLE: Similar roles = peer networking, different = mentoring/learning
5. COMPANY/INDUSTRY: Same industry = context understanding, different = cross-pollination
6. MATCH TYPES: AI-determined relationship types based on professional context

🎯 COMPATIBILITY ANALYSIS GUIDELINES:
For each match, analyze compatibility using these weighted factors (adjust weights based on context):
- SKILLS & INTERESTS: Technical/domain overlap and complementarity
- PREFERENCES: Alignment of collaboration preferences and professional needs
- LOCATION: Geographic proximity for collaboration, meetings, events  
- TITLE/ROLE: Experience levels and role complementarity for mutual benefit
- COMPANY/INDUSTRY: Industry context and cross-pollination opportunities

COMPATIBILITY SCORING WITH PREFERENCES:
- Same location + skill overlap + preference alignment = High compatibility (80-95%)
- Same location + complementary skills + preference match = High compatibility (75-90%)  
- Different location + strong skill overlap + preference alignment = Medium-High compatibility (70-85%)
- Same industry + location proximity + some preference overlap = Medium compatibility (65-80%)
- Cross-industry + skill complementarity + preference alignment = Medium compatibility (65-80%)
- Preference mismatch but strong skills/location match = Medium compatibility (50-65%)
- Different location + different skills but same interests + some preferences = Lower compatibility (40-55%)

🎯 MATCH TYPE ANALYSIS - Include for each match:
Determine 2-4 most relevant match types based on comprehensive analysis of experience levels, skills, interests, professional context, and needs:
- "Mentor" (experienced professional who can guide the requesting user based on career level, expertise, and industry knowledge)
- "Mentee" (someone the requesting user can guide based on their expertise and the target's learning needs)  
- "Collaborator" (peer-level partnership potential based on complementary skills and shared interests)
- "Investor" (potential funding source based on investment focus, industry, and business stage alignment)
- "Investment Opportunity" (promising venture for user's investment based on sector expertise and growth potential)
- "Hiring Manager" (could potentially hire the user based on company needs and user's skills)
- "Potential Hire" (candidate the user could potentially hire based on team needs and their qualifications)
- "Discussion Partner" (intellectual peer for meaningful professional discussions based on shared interests and expertise)
- "Professional" (valuable networking contact for industry connections and knowledge sharing, only when no other types apply)

🎯 MATCH TYPE DIVERSITY: Ensure variety across all relationship types in your matches:
- HIRING: Must include either "Hiring Manager" OR "Potential Hire" (never both for same user)
- INVESTMENT: Must include either "Investor" OR "Investment Opportunity" (never both for same user)  
- MENTORSHIP: Must include either "Mentor" OR "Mentee" (never both for same user)
- COLLABORATION: Must include either "Collaborator" OR "Discussion Partner" (can include both)
🚨 Critical: Final results must represent ALL 4 categories above - ensure diversity across hiring, investment, mentorship, and collaboration relationships.

🚨 SCORING RULES:
1. Return users based on the provided minimum compatibility threshold
2. If user count is below the 50% of the requested maximum, include lower-scored users to reach the target
3. Focus on quality over quantity - don't force exact numbers

EXAMPLE OUTPUT (json format): Include diverse match types across all categories - collaboration, mentorship, investment, hiring:

[
  {
    "user_id": "user1",
    "compatibilityScore": 90,
    "reasoning": "Direct JavaScript/React ecosystem match",
    "commonInterests": ["Web Development"],
    "complementarySkills": ["React", "Frontend"],
    "matchTypes": ["Collaborator", "Potential Hire"]
  },
  {
    "user_id": "user2", 
    "compatibilityScore": 75,
    "reasoning": "Senior developer who could mentor junior talent",
    "commonInterests": ["Technology"],
    "complementarySkills": ["Python", "Data Analysis"],
    "matchTypes": ["Mentor", "Discussion Partner"]
  },
  {
    "user_id": "user3",
    "compatibilityScore": 70,
    "reasoning": "VC focused on fintech startups matching user's sector",
    "commonInterests": ["Fintech", "Startups"],
    "complementarySkills": ["Investment", "Strategy"],
    "matchTypes": ["Investor", "Professional"]
  },
  {
    "user_id": "user4",
    "compatibilityScore": 65,
    "reasoning": "CTO at growing company needing user's skills",
    "commonInterests": ["Technology", "Scaling"],
    "complementarySkills": ["Leadership", "Team Building"],
    "matchTypes": ["Hiring Manager", "Professional"]
  }
]

🚨 CRITICAL REQUIREMENTS:
- Return matches based on the requested number and compatibility threshold
- Use REAL user IDs from vector search results
- Create different compatibility scores based on semantic similarity
- Focus on MEANING and CONTEXT, not exact keyword matches
- Include specific reasoning for each match explaining the semantic connection

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

      // Fetch only required user data from database
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
          stats
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

      // Merge AI analysis with database user data - only return required fields
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
              bio: user.bio,
              avatar: user.avatar_url || "/placeholder-user.jpg",
              skills: user.skills || [],
              interests: user.interests || [],
              preferences: user.preferences || {
                mentor: false,
                invest: false,
                discuss: true,
                collaborate: true,
                hire: false,
              },
              connections: user.stats?.connections || 0,
            },
            compatibilityScore: analysis.compatibilityScore || 75,
            matchReasons: [analysis.reasoning || "Professional compatibility"],
            sharedInterests: analysis.commonInterests || [],
            complementarySkills: analysis.complementarySkills || [],
            semanticSimilarity: analysis.compatibilityScore / 100 || 0.75,
            aiReasoning: analysis.reasoning || "Professional compatibility",
            matchingCategory: "collaboration",
            matchTypes: analysis.matchTypes || ["Professional"], // AI-determined match types
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
    if (
      "tool_calls" in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
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
      console.log(`🎯 Finding matches for user: ${request.userId}`);

      // Validate request
      const validatedRequest = MatchingRequestSchema.parse(request);

      // Check for cached AI analysis first (unless force refresh)
      if (!forceRefresh) {
        const cacheResult = await this.checkCachedMatches(
          validatedRequest.userId
        );

        if (cacheResult.cached) {
          // Check if cache is still valid (not expired)
          const maxCacheAge = 6 * 60; // 6 hours in minutes
          if (cacheResult.cacheAge! < maxCacheAge) {
            console.log(
              `🚀 Using cached AI analysis (${cacheResult.cacheAge} minutes old), enriching with fresh user data`
            );

            // Always enrich cached AI analysis with fresh user data
            const enrichedMatches = await this.enrichMatchesWithUserData(
              cacheResult.aiAnalysis || []
            );
            const processingTime = Date.now() - startTime;

            return {
              success: true,
              matches: enrichedMatches,
              totalFound: enrichedMatches.length,
              processingTime,
              cacheUsed: true,
              cacheAge: cacheResult.cacheAge,
            };
          } else {
            console.log(
              `⏰ Cache expired (${cacheResult.cacheAge} minutes old), generating fresh AI analysis`
            );
          }
        }
      } else {
        console.log(`🔄 Force refresh requested, bypassing cache`);
      }

      console.log(`🤖 Running AI agent to find fresh matches...`);

      // Create the agent
      const agent = this.createAgent();

      // Prepare the matching query with semantic emphasis and multi-match requirement
      const matchingQuery = new HumanMessage({
        content: `Find MULTIPLE professional matches for user ${validatedRequest.userId} using SEMANTIC SIMILARITY and meaning-based compatibility:

- Max Results: ${validatedRequest.maxResults}
- Min Compatibility: ${validatedRequest.minCompatibility}%

🧠 ENHANCED MULTI-MATCH STRATEGY:
1. Call get_user_vector_content(userId: "${validatedRequest.userId}") to get COMPLETE context for the REQUESTING USER including profile intelligence, web research, and semantic tags
2. Use vector_search_profiles MULTIPLE TIMES with different comprehensive semantic queries based on requesting user's COMPLETE information:
   - Query 1: Core skills + location + role (e.g., "JavaScript React frontend developer San Francisco startup")
   - Query 2: Industry + interests + location (e.g., "fintech payments technology San Francisco innovation")  
   - Query 3: Company type + domain + title (e.g., "startup founder entrepreneur technology leadership scaling")
   - Query 4: Location + complementary skills (e.g., "San Francisco UI UX design product management")
3. Optionally call get_user_profile for specific interesting users found via vector search to get additional details
4. Analyze ALL vector search results and return users based on COMPREHENSIVE compatibility including:
   - Skills & interests similarity (primary factor)
   - Location compatibility (boost score for same region)
   - Title/role synergy (same level = peers, different = mentoring/learning)
   - Company/industry context (same = understanding, different = fresh perspective)
5. Return users with compatibility ≥${validatedRequest.minCompatibility}%, including location/title/company factors in scoring

🎯 SEARCH STRATEGY: Use vector search as your PRIMARY discovery tool. Call it multiple times with different semantic queries to find diverse, relevant matches. Use the requesting user's complete intelligence to craft smart search queries.

🔧 TOOL USAGE:
- get_user_vector_content: ONLY for requesting user (rich context)
- vector_search_profiles: PRIMARY matching tool (use multiple times with filters: {excludeUserId: "${validatedRequest.userId}"})  
- get_user_profile: Optional additional details for found users

🚨 CRITICAL MATCH TYPE ASSIGNMENT - ASSIGN THESE BUSINESS RELATIONSHIP TYPES:

🔥 HIRING RELATIONSHIPS (MANDATORY):
- "Hiring Manager": CTOs, Engineering Managers, VPs, Directors, Team Leads, Founders who manage teams
- "Potential Hire": Junior developers, specialists, engineers when user is in management position

🔥 INVESTMENT RELATIONSHIPS (MANDATORY):
- "Investor": VCs, Angel Investors, Investment Partners, Startup Advisors with capital
- "Investment Opportunity": Entrepreneurs, Startup Founders, CEOs seeking funding

🔥 MENTORSHIP RELATIONSHIPS (MANDATORY):
- "Mentor": Senior professionals with 5+ years more experience than requesting user
- "Mentee": Junior professionals with less experience than requesting user

🔥 COLLABORATION RELATIONSHIPS (MANDATORY):
- "Collaborator": Peers with complementary skills at similar levels
- "Discussion Partner": Professionals with shared interests for knowledge exchange

🚨 ASSIGNMENT RULES - FOLLOW EXACTLY:
1. IF someone has title "CTO", "Engineering Manager", "Team Lead", "VP", "Director" → ALWAYS include "Hiring Manager"
2. IF someone has title "Founder", "CEO", "Entrepreneur" → ALWAYS include "Investment Opportunity" 
3. IF someone has title "VC", "Angel Investor", "Investment Partner" → ALWAYS include "Investor"
4. IF requesting user is junior/mid-level AND target is senior → ALWAYS include "Mentor" for target
5. IF requesting user is senior AND target is junior → ALWAYS include "Potential Hire" for target
6. EVERY match must have at least 2 match types for diversity
7. 🚨 NEVER use "Professional" - only use specific relationship types above

🎯 ENHANCED SEMANTIC MATCHING EXAMPLES (Skills + Location + Title + Company):
- JavaScript developer in San Francisco + React developer in San Francisco = 95% (skills + location match)
- Marketing manager in London + Product manager in London = 85% (complementary roles + same location)
- Fintech startup founder + Banking executive = 80% (industry expertise + different perspectives)
- Data scientist in NYC + AI researcher in NYC = 90% (domain overlap + location synergy)
- Remote DevOps engineer + Cloud architect = 75% (complementary technical skills)
- Healthcare startup CEO + Medical device engineer = 70% (industry + role complementarity)

🎯 LOCATION IMPACT ON SCORING:
- Same city: +10-15 points for collaboration potential
- Same region/country: +5-10 points for cultural context
- Remote-friendly roles: Location less critical, focus on skills/interests
- Different continents: Still valuable for global perspective, -5 points

🎯 EXPECTED OUTPUT:
Return ALL users with compatibility ≥${validatedRequest.minCompatibility}%. If this gives fewer than half of ${validatedRequest.maxResults} matches, include lower-scored users to reach at least half of ${validatedRequest.maxResults} total matches.

🚨 ENSURE DIVERSITY: MUST include matches from ALL categories: hiring (Hiring Manager/Potential Hire), investment (Investor/Investment Opportunity), mentorship (Mentor/Mentee), collaboration (Collaborator/Discussion Partner).

Return JSON array with MULTIPLE user IDs and semantic compatibility analysis!`,
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
      if (typeof lastMessage.content === "string") {
        responseContent = lastMessage.content;
      } else if (Array.isArray(lastMessage.content)) {
        // Handle array of content blocks
        responseContent = lastMessage.content
          .map((block) => {
            if (typeof block === "string") return block;
            if (typeof block === "object" && block !== null) {
              // Handle different block types
              if ("text" in block) return block.text;
              if ("content" in block) return String(block.content);
              return JSON.stringify(block);
            }
            return String(block);
          })
          .join("\n");
      } else {
        // Convert to string as fallback
        responseContent = String(lastMessage.content);
      }

      // Parse the agent's response to extract AI analysis
      const aiAnalysis = this.parseMatchingResponse(responseContent);

      console.log(
        `✅ AI analysis completed with ${
          aiAnalysis.length
        } potential matches in ${Date.now() - startTime}ms`
      );

      // Store AI analysis in cache for future requests (don't wait for completion)
      this.storeCachedAIAnalysis(
        validatedRequest.userId,
        aiAnalysis,
        Date.now() - startTime,
        aiAnalysis.length
      ).catch((error: any) => {
        console.warn("⚠️ Failed to cache AI analysis:", error);
      });

      // Fetch complete user profiles from database
      const enhancedMatches = await this.enrichMatchesWithUserData(aiAnalysis);

      const processingTime = Date.now() - startTime;

      console.log(
        `✅ Found ${enhancedMatches.length} matches in ${processingTime}ms`
      );

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
      const responseStr =
        typeof response === "string" ? response : String(response);

      console.log(
        "🔍 Raw agent response:",
        responseStr.substring(0, 2000) +
          (responseStr.length > 2000 ? "..." : "")
      );

      // First try to parse the entire response as JSON
      try {
        const parsed = JSON.parse(responseStr);
        if (Array.isArray(parsed)) {
          console.log(
            "✅ Successfully parsed full response as JSON array:",
            parsed.length
          );
          return parsed;
        } else {
          console.log("⚠️ Parsed response is not an array:", typeof parsed);
        }
      } catch (e) {
        console.log(
          "❌ Failed to parse full response as JSON:",
          e instanceof Error ? e.message : String(e)
        );
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
            console.log(
              "🔍 Trying to parse extracted JSON:",
              jsonStr.substring(0, 1000) + (jsonStr.length > 1000 ? "..." : "")
            );
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log(
                "✅ Successfully parsed matches from pattern:",
                parsed.length
              );
              // Validate that items have user_id
              const hasUserIds = parsed.some(
                (item) => item && typeof item === "object" && item.user_id
              );
              if (hasUserIds) {
                console.log("✅ Parsed items contain user_id fields");
                return parsed;
              } else {
                console.log(
                  "⚠️ Parsed items missing user_id fields:",
                  parsed[0]
                );
              }
            }
          } catch (e) {
            console.log(
              "❌ Failed to parse pattern match:",
              e instanceof Error ? e.message : String(e)
            );
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

      console.log(
        "🔍 Trying cleaned response:",
        cleanResponse.substring(0, 1000) +
          (cleanResponse.length > 1000 ? "..." : "")
      );

      try {
        const parsed = JSON.parse(cleanResponse);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(
            "✅ Successfully parsed cleaned response:",
            parsed.length
          );
          // Validate that items have user_id
          const hasUserIds = parsed.some(
            (item) => item && typeof item === "object" && item.user_id
          );
          if (hasUserIds) {
            console.log("✅ Cleaned items contain user_id fields");
            return parsed;
          } else {
            console.log(
              "⚠️ Cleaned items missing user_id fields:",
              JSON.stringify(parsed[0], null, 2)
            );
          }
        }
      } catch (e) {
        console.log(
          "❌ Failed to parse cleaned response:",
          e instanceof Error ? e.message : String(e)
        );
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
            console.log(
              "🔍 Trying to parse object:",
              objMatch[0].substring(0, 100) + "..."
            );
            const parsed = JSON.parse(objMatch[0]);
            if (parsed.user_id) {
              extractedMatches.push(parsed);
              console.log(
                "✅ Successfully parsed match object with user_id:",
                parsed.user_id
              );
            }
          } catch (e) {
            console.log(
              "❌ Failed to parse object:",
              e instanceof Error ? e.message : String(e)
            );
            continue;
          }
        }
        if (extractedMatches.length > 0) {
          console.log(
            "✅ Extracted individual matches:",
            extractedMatches.length
          );
          return extractedMatches;
        }
      }

      console.warn("⚠️ Could not parse any valid matches from agent response");
      console.log("Full response for debugging:", responseStr);
      return [];
    } catch (error) {
      console.error("❌ Error parsing matching response:", error);
      const responseStr =
        typeof response === "string" ? response : String(response);
      console.log(
        "Response that failed parsing:",
        responseStr.substring(0, 2000) +
          (responseStr.length > 2000 ? "..." : "")
      );
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
    recommendations?: EnhancedMatch[];
    error?: string;
  }> {
    try {
      const result = await this.findMatches({
        userId,
        maxResults: 15,
        minCompatibility: 50,
      });

      return {
        success: true,
        recommendations: result.matches || [],
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

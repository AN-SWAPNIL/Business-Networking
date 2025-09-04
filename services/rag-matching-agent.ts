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
      this.createUserVectorContentTool(),
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
   * Compatibility Analysis Tool using AI reasoning
   */
  private createCompatibilityAnalysisTool() {
    return tool(
      async ({ currentUser, targetUser, matchingType }) => {
        try {
          const analysisPrompt = `
Analyze the compatibility between these two professionals for ${matchingType} purposes, considering ALL FACTORS:

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

🎯 COMPREHENSIVE COMPATIBILITY ANALYSIS - Consider ALL factors:

1. SKILLS & INTERESTS (40% weight): Technical/domain overlap and complementarity
2. LOCATION (25% weight): Geographic proximity for collaboration, meetings, events
3. TITLE/ROLE (20% weight): Similar roles = peer networking, different = mentoring/learning
4. COMPANY/INDUSTRY (15% weight): Same industry = context, different = fresh perspectives

SCORING GUIDELINES:
- Same location + skill overlap = 80-95%
- Same location + complementary skills = 70-85%
- Different location + strong skill overlap = 65-80%
- Same industry + location proximity = 70-85%
- Cross-industry + skill complementarity = 60-75%
- Different location + different skills but same interests = 45-60%

🎯 MATCH TYPE ANALYSIS - Determine the relationship types based on professional context:

AVAILABLE MATCH TYPES:
- "Mentor" (experienced professional who can guide the user)
- "Mentee" (someone the user can mentor/guide)
- "Collaborator" (peer for joint projects/partnerships)
- "Investor" (potential funding source for user's ventures)
- "Investment Opportunity" (user could invest in their ventures)
- "Hiring Manager" (could hire the user)
- "Potential Hire" (user could hire them)
- "Discussion Partner" (intellectual peer for professional discussions)
- "Professional" (general networking contact)

Provide a detailed compatibility analysis with:
1. Compatibility score (0-100) considering ALL factors above
2. Match reasons (specific, mentioning location, skills, roles, industry)
3. Shared interests
4. Complementary skills
5. Location/collaboration benefits
6. Match types (array of 1-3 most relevant types, ordered by relevance)
7. AI reasoning (2-3 sentences explaining the match quality with location/role/company context)
8. Recommendation strength (high/medium/low)

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
              matchTypes: ["Professional"],
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
          "Analyze comprehensive compatibility between two users using AI reasoning, considering skills, interests, location proximity, title/role synergy, and company/industry context",
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
      content: `You are an intelligent professional networking matching agent specializing in SEMANTIC SIMILARITY and creating MULTIPLE meaningful matches. When vector search finds profiles, you should analyze most of them and return several matches, not just the top one.

🔄 CRITICAL WORKFLOW - FOLLOW EXACTLY:

1. FIRST: Call get_user_vector_content(userId: "requesting_user_id") to get COMPLETE context for the REQUESTING USER ONLY (includes profile intelligence, web research, semantic tags)
2. SECOND: Call vector_search_profiles with COMPREHENSIVE SEMANTIC query based on requesting user's complete information
3. THIRD: Use vector_search_profiles multiple times as needed to find diverse matches with different semantic queries
4. FOURTH: Optionally call get_user_profile for specific users found via vector search if you need additional details
5. FIFTH: Analyze ALL vector search results and return ALL users with compatibility score ≥40%
6. SIXTH: If fewer than 10 users meet the ≥40% threshold, also include users with <40% compatibility to reach approximately 10 matches

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
- LOCATION matters: Same city/region increases collaboration potential
- TITLE/ROLE matters: Similar roles share challenges, different roles offer perspective
- COMPANY/INDUSTRY matters: Same industry understands context, different industries bring fresh ideas

🎯 COMPATIBILITY SCORING STRATEGY:
Return ALL users based on compatibility score thresholds - consider SKILLS, INTERESTS, LOCATION, TITLE, and COMPANY:
- High compatibility (80-95%): Direct skill/interest overlap + location/industry synergy - ALWAYS include
- Medium compatibility (60-79%): Complementary skills + same location OR same industry - ALWAYS include  
- Acceptable compatibility (40-59%): Professional growth opportunities + geographic feasibility - ALWAYS include
- Lower compatibility (25-39%): Include ONLY if needed to reach ~10 total matches

🎯 MATCHING FACTORS TO CONSIDER:
1. SKILLS & INTERESTS: Primary semantic similarity (technical ecosystems, domains)
2. LOCATION: Same city/region = higher score, especially for collaboration/mentorship
3. TITLE/ROLE: Similar roles = peer networking, different roles = diverse perspectives
4. COMPANY/INDUSTRY: Same industry = context understanding, different = cross-pollination
5. CAREER LEVEL: Different levels = mentoring opportunities, same level = peer collaboration
6. MATCH TYPES: AI-determined relationship types based on professional context

🎯 MATCH TYPE ANALYSIS - Include for each match:
Determine 1-3 most relevant match types based on experience levels, skills, and professional context:
- "Mentor" (they can guide the requesting user)
- "Mentee" (requesting user can guide them)
- "Collaborator" (peer-level partnership potential)
- "Investor" (potential funding source)
- "Investment Opportunity" (investment target for user)
- "Hiring Manager" (could hire the user)
- "Potential Hire" (user could hire them)
- "Discussion Partner" (intellectual peer)
- "Professional" (general networking)

🚨 SCORING RULES:
1. Return ALL users with compatibility ≥40%
2. If total count < 10, include users with <40% compatibility to reach approximately 10 matches
3. Focus on quality over quantity - don't force exact numbers

EXAMPLE OUTPUT: If you find vector results with different skills/interests, return matches for MOST of them with compatibility scores 40-95% based on semantic similarity:

[
  {
    "user_id": "user1",
    "compatibilityScore": 90,
    "reasoning": "Direct JavaScript/React ecosystem match",
    "commonInterests": ["Web Development"],
    "complementarySkills": ["React", "Frontend"],
    "matchTypes": ["Collaborator", "Discussion Partner"]
  },
  {
    "user_id": "user2", 
    "compatibilityScore": 65,
    "reasoning": "Complementary technical background",
    "commonInterests": ["Technology"],
    "complementarySkills": ["Python", "Data Analysis"],
    "matchTypes": ["Mentor", "Discussion Partner"]
  }
]

🚨 CRITICAL OUTPUT REQUIREMENTS:
- Return 5-15 matches when vector search finds multiple profiles
- Use REAL user IDs from vector search results
- Create different compatibility scores (40-95) based on semantic similarity
- Focus on MEANING and CONTEXT, not exact keyword matches
- Include specific reasoning for each match explaining the semantic connection

🚨 CRITICAL: RESPOND WITH VALID JSON ARRAY ONLY - NO EXPLANATORY TEXT BEFORE OR AFTER THE JSON
🚨 FORMAT: Return ONLY the JSON array starting with [ and ending with ] - no additional text, explanations, or markdown formatting
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

      if (userIds.length === 0) {
        console.log("⚠️  No valid user IDs found in AI analysis");
        return [];
      }

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

      // Prepare the matching query with semantic emphasis and multi-match requirement
      const matchingQuery = new HumanMessage({
        content: `Find MULTIPLE professional matches for user ${validatedRequest.userId} using SEMANTIC SIMILARITY and meaning-based compatibility:

- Max Results: ${validatedRequest.maxResults}
- Min Compatibility: ${validatedRequest.minCompatibility}%

🚨 COMPATIBILITY SCORING APPROACH: Return ALL users with compatibility ≥40%. If fewer than 10 users meet this threshold, include users with <40% compatibility to reach approximately 10 matches.

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
5. Return users with compatibility ≥40%, including location/title/company factors in scoring

🎯 SEARCH STRATEGY: Use vector search as your PRIMARY discovery tool. Call it multiple times with different semantic queries to find diverse, relevant matches. Use the requesting user's complete intelligence to craft smart search queries.

🔧 TOOL USAGE:
- get_user_vector_content: ONLY for requesting user (rich context)
- vector_search_profiles: PRIMARY matching tool (use multiple times)  
- get_user_profile: Optional additional details for found users

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
Return ALL users with compatibility ≥40%. If this gives fewer than 10 matches, include lower-scored users to reach approximately 10 total matches.

🚨 CRITICAL: RESPOND WITH VALID JSON ARRAY ONLY - NO EXPLANATORY TEXT
🚨 FORMAT: Return ONLY the JSON array starting with [ and ending with ] - no additional text, explanations, or markdown formatting`,
      });

      // Execute the agent
      const result = await agent.invoke({
        messages: [matchingQuery],
      });

      // Extract matches from the agent response
      const lastMessage = result.messages[result.messages.length - 1];

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
      const responseStr =
        typeof response === "string" ? response : String(response);

      // First try to parse the entire response as JSON
      try {
        const parsed = JSON.parse(responseStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasUserIds = parsed.some(
            (item) => item && typeof item === "object" && item.user_id
          );
          if (hasUserIds) {
            return parsed;
          }
        }
      } catch (e) {
        // Continue to pattern matching
      }

      // Extract JSON from mixed content using improved patterns
      const patterns = [
        /\[[\s\S]*?\](?=\s*$|$)/g, // JSON array at end of response
        /```json\s*(\[[\s\S]*?\])\s*```/g, // JSON in code blocks
        /```\s*(\[[\s\S]*?\])\s*```/g, // Array in code blocks
        /\[[\s\S]*?\](?=\s*[^}\]]*$)/g, // JSON array before trailing text
      ];

      for (const pattern of patterns) {
        const matches = [...responseStr.matchAll(pattern)];
        for (const match of matches) {
          try {
            const jsonStr = match[1] || match[0];
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const hasUserIds = parsed.some(
                (item) => item && typeof item === "object" && item.user_id
              );
              if (hasUserIds) {
                return parsed;
              }
            }
          } catch (e) {
            continue;
          }
        }
      }

      // Clean up response by removing explanatory text before/after JSON
      let cleanResponse = responseStr
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .replace(/^[\s\S]*?(?=\[)/, "") // Remove everything before first [
        .replace(/\][\s\S]*$/, "]"); // Remove everything after last ]

      try {
        const parsed = JSON.parse(cleanResponse);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasUserIds = parsed.some(
            (item) => item && typeof item === "object" && item.user_id
          );
          if (hasUserIds) {
            return parsed;
          }
        }
      } catch (e) {
        // Final fallback - extract individual objects
      }

      // Extract individual match objects as final fallback
      const objectMatches = [
        ...responseStr.matchAll(/\{[^{}]*"user_id"[^{}]*\}/g),
      ];

      if (objectMatches.length > 0) {
        const extractedMatches = [];
        for (const objMatch of objectMatches) {
          try {
            const parsed = JSON.parse(objMatch[0]);
            if (parsed.user_id) {
              extractedMatches.push(parsed);
            }
          } catch (e) {
            continue;
          }
        }
        if (extractedMatches.length > 0) {
          return extractedMatches;
        }
      }

      console.warn("⚠️ Could not parse matches from agent response");
      return [];
    } catch (error) {
      console.error("❌ Error parsing matching response:", error);
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

import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { TavilySearch } from "@langchain/tavily";
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
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  website: z.string().optional(),
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
  private searchTool: TavilySearch;
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

    // Initialize Tavily search tool (optimized for AI agents and profile intelligence)
    this.searchTool = new TavilySearch({
      maxResults: 8,
      topic: "general",
      includeAnswer: false,
      includeRawContent: true, // Get detailed content for better analysis
      includeImages: false,
      searchDepth: "advanced", // Use advanced search for better professional results
      includeDomains: [
        "linkedin.com",
        "crunchbase.com",
        "bloomberg.com",
        "forbes.com",
        "techcrunch.com",
      ], // Focus on professional sources
    });

    console.log(
      "🔍 Tavily Search initialized with advanced settings for profile intelligence"
    );

    // Define tools for the agent - Tavily is natively compatible with LangChain
    this.tools = [this.searchTool];
    this.toolNode = new ToolNode(this.tools);

    // Initialize LLM with tools bound
    const baseLLM = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.3,
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

IMPORTANT: You MUST use the tavily_search tool to gather information. Do not provide analysis without searching first.

Available tools:
- tavily_search: Use this to search for comprehensive professional information about people and companies

Your workflow:
1. ALWAYS start by using tavily_search to find information about the person
2. Search for their professional background, current role, and company
3. Look for recent achievements, projects, or news
4. Search for industry insights and company information
5. Based on your research, provide analysis

Search strategy:
- Search for: "{person_name} {title} {company} professional background"
- Search for: "{company_name} company information business"
- Search for: "{person_name} achievements projects career"
- Search for: "{person_name} LinkedIn professional experience"

After completing your searches, provide your analysis in this exact JSON format:
{
  "summary": "A concise 2-3 sentence professional summary highlighting key networking value based on your research",
  "analysis": "Detailed analysis covering: Professional Background, Company Information, Expertise & Skills, Industry Standing, Recent Activities, and Networking Potential - all based on the search results you found"
}

Guidelines:
- Use tavily_search multiple times to gather comprehensive information
- Be factual and professional, citing what you found in searches
- Focus on business networking relevance
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
    summary: string;
    analysis: string;
  } {
    console.log("🔍 Extracting structured response from content...");

    try {
      // Try to parse as JSON first
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log("📋 Found JSON structure, attempting to parse...");
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.summary && parsed.analysis) {
          console.log("✅ Successfully parsed JSON response");
          return parsed;
        }
        console.log("⚠️ JSON found but missing summary/analysis fields");
      }
    } catch (error) {
      console.log("⚠️ JSON parsing failed:", error);
    }

    // Try to find JSON with different patterns
    const patterns = [
      /```json\s*(\{[\s\S]*?\})\s*```/,
      /```\s*(\{[\s\S]*?\})\s*```/,
      /(\{[\s\S]*?"summary"[\s\S]*?"analysis"[\s\S]*?\})/,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          console.log("📋 Trying alternative JSON pattern...");
          const parsed = JSON.parse(match[1]);
          if (parsed.summary && parsed.analysis) {
            console.log("✅ Successfully parsed alternative JSON format");
            return parsed;
          }
        } catch (error) {
          console.log("⚠️ Alternative JSON parsing failed");
        }
      }
    }

    // Fallback to text extraction
    console.log("🔍 Using text extraction fallback...");

    // More flexible regex patterns
    const summaryPatterns = [
      /summary["']?\s*:\s*["']([^"']*?)["']/i,
      /"summary"\s*:\s*"([^"]*?)"/i,
      /summary:\s*([^}\n]*)/i,
      /##?\s*summary\s*:?\s*\n?(.*?)(?=\n##|\n\*\*|$)/i,
    ];

    const analysisPatterns = [
      /analysis["']?\s*:\s*["']([^"']*?)["']/i,
      /"analysis"\s*:\s*"([^"]*?)"/i,
      /analysis:\s*([^}]*)/i,
      /##?\s*analysis\s*:?\s*\n?(.*?)(?=\n##|\n\*\*|$)/i,
    ];

    let summary = "Professional summary not available";
    let analysis = "Detailed analysis not available";

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

    // If still no good analysis, try to extract the main content
    if (
      analysis === "Detailed analysis not available" &&
      content.length > 200
    ) {
      // Remove any JSON attempts and use the plain text
      const cleanContent = content.replace(/\{[\s\S]*?\}/g, "").trim();
      if (cleanContent.length > 100) {
        analysis = cleanContent;
        console.log("✅ Using cleaned content as analysis");
      }
    }

    console.log("📊 Text extraction results:");
    console.log(
      "- Summary found:",
      summary !== "Professional summary not available"
    );
    console.log(
      "- Analysis found:",
      analysis !== "Detailed analysis not available"
    );

    return { summary, analysis };
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

Professional Summary:
${summary}

Detailed Analysis:
${analysis}

Professional Interests: ${Object.entries(userProfile.preferences)
        .filter(([_, value]) => value)
        .map(([key, _]) => key)
        .join(", ")}
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
            website: userProfile.website,
            type: "profile_intelligence",
            created_at: new Date().toISOString(),
            preferences: userProfile.preferences,
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
        content: `IMPORTANT: You must use the tavily_search tool to research this person before providing analysis.

Analyze this professional profile for business networking purposes:

Name: ${validatedProfile.name}
Title: ${validatedProfile.title || "Not specified"}
Company: ${validatedProfile.company || "Not specified"}
Location: ${validatedProfile.location || "Not specified"}
Bio: ${validatedProfile.bio || "Not specified"}
Website: ${validatedProfile.website || "Not specified"}
Professional Interests: ${
          Object.entries(validatedProfile.preferences)
            .filter(([_, value]) => value)
            .map(([key, _]) => key)
            .join(", ") || "Not specified"
        }

Step 1: Search for "${validatedProfile.name} ${validatedProfile.title} ${
          validatedProfile.company
        }" using the tavily_search tool
Step 2: Search for "${
          validatedProfile.company
        } company information" using the tavily_search tool  
Step 3: Based on your research, provide your analysis in the specified JSON format.

You MUST use the tavily_search tool before providing any analysis.`,
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
          const searchResults = await this.searchTool.invoke({
            query: searchQuery,
          });

          // Handle Tavily's structured response format
          let searchContent = "";
          if (typeof searchResults === "object" && searchResults.results) {
            console.log(
              "🔍 Manual search completed, found",
              searchResults.results.length,
              "results"
            );

            // Format Tavily results for LLM consumption
            searchContent = searchResults.results
              .map(
                (result: any, index: number) =>
                  `Result ${index + 1}:
Title: ${result.title}
URL: ${result.url}
Content: ${result.content}
---`
              )
              .join("\n\n");
          } else if (typeof searchResults === "string") {
            searchContent = searchResults;
            console.log(
              "🔍 Manual search completed, result length:",
              searchResults.length
            );
          } else {
            searchContent = JSON.stringify(searchResults);
            console.log("🔍 Manual search completed with unexpected format");
          }

          // Add search results to the conversation and get analysis
          const searchMessage = new HumanMessage({
            content: `Here are the search results for ${validatedProfile.name}:

${searchContent}

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

      // Extract structured response
      const { summary, analysis } = this.extractStructuredResponse(
        finalMessage.content as string
      );

      console.log("📊 Extracted response:");
      console.log("- Summary length:", summary.length);
      console.log("- Analysis length:", analysis.length);
      console.log("- Summary preview:", summary.substring(0, 100) + "...");
      console.log("- Analysis preview:", analysis.substring(0, 100) + "...");

      // Store in vector database
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

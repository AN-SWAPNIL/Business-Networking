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
      temperature: 0.7, // Increased for more creative and informative analysis
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
      content: `You are an expert business intelligence analyst specializing in professional networking and industry research. Your mission is to create comprehensive, actionable intelligence reports for high-value business networking.

MANDATORY: You MUST use the tavily_search_results_json tool extensively to gather current, accurate information. Never provide analysis without thorough research.

RESEARCH PROTOCOL:
1. Professional Background Search: "{person_name} {title} {company} LinkedIn career"
2. Company Intelligence: "{company_name} business model revenue industry position"
3. Industry Context: "{industry} trends leaders market dynamics"
4. Achievement & Recognition: "{person_name} awards achievements publications speaking"
5. Network Analysis: "{person_name} connections partnerships collaborations"
6. Recent Activities: "{person_name} 2024 2025 projects news updates"
7. Market Position: "{company_name} competitors market share positioning"

ANALYSIS FRAMEWORK:
Your analysis must be data-driven, specific, and networking-focused. Include:

**Professional Background**: Education, career progression, key roles, expertise depth
**Company Intelligence**: Business model, market position, growth trajectory, strategic focus
**Expertise & Skills**: Technical competencies, domain knowledge, unique capabilities
**Industry Standing**: Recognition, influence, thought leadership, market visibility
**Strategic Value**: Investment potential, partnership opportunities, advisory capacity
**Recent Developments**: Latest projects, career moves, company news, industry involvement
**Networking Potential**: Connection value, collaboration opportunities, mutual benefit scenarios

QUALITY STANDARDS:
- Use specific data points, numbers, and recent information from your searches
- Avoid generic statements - be concrete and actionable
- Focus on networking ROI and business value proposition
- Include market context and competitive landscape insights
- Highlight unique differentiators and strategic advantages

OUTPUT FORMAT:
Provide your intelligence report in this exact JSON structure:
{
  "summary": "A compelling 2-3 sentence executive summary highlighting this person's networking value proposition and key strategic advantages based on your research findings",
  "analysis": "A comprehensive 400-600 word intelligence report covering all framework elements with specific data points, market insights, and actionable networking recommendations based on your thorough research"
}

Remember: Quality over speed. Conduct thorough research before analysis. Be specific, data-driven, and networking-focused.`,
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

    // Fallback to text extraction with improved patterns
    console.log("🔍 Using enhanced text extraction fallback...");

    // Enhanced regex patterns for better extraction
    const summaryPatterns = [
      /summary["']?\s*:\s*["']([^"']+?)["']/i,
      /"summary"\s*:\s*"([^"]+?)"/i,
      /summary:\s*([^}\n]+)/i,
      /##?\s*summary\s*:?\s*\n?(.*?)(?=\n##|\n\*\*|\nanalysis|$)/i,
      /executive\s+summary[:\s]*([^\.]+\.[^\.]+\.[^\.]*\.)/i,
    ];

    const analysisPatterns = [
      /analysis["']?\s*:\s*["']([^"']+?)["']/i,
      /"analysis"\s*:\s*"([^"]+?)"/i,
      /analysis:\s*([^}]+)/i,
      /##?\s*analysis\s*:?\s*\n?(.*?)(?=\n##|\n\*\*|$)/i,
      /detailed\s+analysis[:\s]*(.{200,})/i,
    ];

    let summary = "Professional networking summary pending enhanced research";
    let analysis = "Comprehensive business intelligence analysis requires additional data gathering for accurate strategic assessment";

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
      analysis === "Comprehensive business intelligence analysis requires additional data gathering for accurate strategic assessment" &&
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
      summary !== "Professional networking summary pending enhanced research"
    );
    console.log(
      "- Analysis found:",
      analysis !== "Comprehensive business intelligence analysis requires additional data gathering for accurate strategic assessment"
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
        content: `MANDATORY RESEARCH PROTOCOL: You must conduct comprehensive research using tavily_search_results_json tool before analysis.

TARGET PROFILE FOR INTELLIGENCE ANALYSIS:

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

REQUIRED SEARCH SEQUENCE:
1. Professional Background: "${validatedProfile.name} ${validatedProfile.title} ${validatedProfile.company} LinkedIn career experience"
2. Company Intelligence: "${validatedProfile.company} business model revenue market position competitors"
3. Industry Analysis: "${validatedProfile.title} ${validatedProfile.company} industry trends 2024 2025"
4. Achievement Research: "${validatedProfile.name} awards achievements publications projects speaking"
5. Market Position: "${validatedProfile.company} financial performance growth strategy"
6. Recent Developments: "${validatedProfile.name} ${validatedProfile.company} news updates 2024 2025"
7. Network Analysis: "${validatedProfile.name} partnerships collaborations connections"

INTELLIGENCE OBJECTIVES:
- Quantify business value and networking ROI potential
- Identify strategic advantages and unique differentiators
- Assess market influence and industry standing
- Uncover collaboration and partnership opportunities
- Evaluate investment or advisory potential
- Provide actionable networking recommendations

Execute all searches systematically, then deliver comprehensive intelligence report in specified JSON format.`,
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

        // Manual fallback search with multiple queries
        const searchQueries = [
          `"${validatedProfile.name}" "${validatedProfile.company}" "${validatedProfile.title}" professional background`,
          `"${validatedProfile.company}" business model revenue market position`,
          `"${validatedProfile.name}" achievements projects career LinkedIn`,
        ];

        let allSearchResults = "";

        for (const query of searchQueries) {
          try {
            console.log("🔍 Manual search query:", query);
            const results = await this.searchTool.invoke(query);
            allSearchResults += `\n\n--- Search Results for: ${query} ---\n${results}`;
            console.log("🔍 Manual search completed, result length:", results.length);
          } catch (searchError) {
            console.log("⚠️ Search query failed:", query, searchError);
          }
        }

        if (allSearchResults) {
          try {
            // Add search results to the conversation and get analysis
            const searchMessage = new HumanMessage({
              content: `COMPREHENSIVE RESEARCH RESULTS for ${validatedProfile.name}:

${allSearchResults}

Based on this comprehensive research data, provide your detailed intelligence analysis in the specified JSON format. Focus on:
- Specific business metrics and achievements found
- Market position and competitive advantages
- Strategic networking value and ROI potential
- Actionable collaboration opportunities
- Industry influence and thought leadership indicators`,
            });

            const finalResult = await this.llmWithTools.invoke([
              this.getSystemPrompt(),
              userMessage,
              searchMessage,
            ]);

            result.messages.push(finalResult);
          } catch (analysisError) {
            console.log("⚠️ Manual analysis failed:", analysisError);
          }
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

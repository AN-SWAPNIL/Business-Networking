import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { GoogleCustomSearch } from "@langchain/community/tools/google_custom_search";
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
  private searchTool: GoogleCustomSearch;
  private supabaseClient: any;
  private vectorStore: SupabaseVectorStore;
  private tools: any[];
  private toolNode: ToolNode;

  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY environment variable is required");
    }

    if (!process.env.GOOGLE_CSE_ID) {
      throw new Error("GOOGLE_CSE_ID environment variable is required");
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      throw new Error("Supabase environment variables are required");
    }

    // Initialize search tool
    this.searchTool = new GoogleCustomSearch({
      apiKey: process.env.GOOGLE_SEARCH_API_KEY,
      googleCSEId: process.env.GOOGLE_CSE_ID,
    });

    console.log("🔍 Google Custom Search initialized");

    // Define tools for the agent
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

You have access to a Google Custom Search tool. Use it strategically to gather information about the person's:
- Professional background and current role
- Company information and recent developments  
- Industry expertise and achievements
- Networking potential and value

Based on your research, provide a comprehensive analysis in this JSON format:
{
  "summary": "A concise 2-3 sentence professional summary highlighting key networking value",
  "analysis": "Detailed analysis covering: Professional Background, Company Information, Expertise & Skills, Industry Standing, Recent Activities, and Networking Potential"
}

Guidelines:
- Search as much as needed to gather comprehensive information
- Be factual and professional
- Focus on business networking relevance
- If search results are limited, acknowledge it and work with available information
- Structure your analysis clearly with headers and sections
- Aim for 300-500 words in the detailed analysis

Remember: You can use the search tool multiple times as needed during your analysis.`,
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

    console.log(
      "🔧 LLM response has tool calls:",
      result.tool_calls?.length || 0
    );

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

    if (lastMessage?.tool_calls?.length) {
      console.log("🔧 Tool calls detected:", lastMessage.tool_calls.length);
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
    try {
      // Try to parse as JSON first
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.summary && parsed.analysis) {
          return parsed;
        }
      }
    } catch (error) {
      console.log("⚠️ JSON parsing failed, using text extraction");
    }

    // Fallback to text extraction
    const summaryMatch = content.match(/summary["']?\s*:\s*["']([^"']*?)["']/i);
    const analysisMatch = content.match(
      /analysis["']?\s*:\s*["']([^"']*?)["']/i
    );

    return {
      summary: summaryMatch?.[1] || "Professional summary not available",
      analysis: analysisMatch?.[1] || "Detailed analysis not available",
    };
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
        content: `Analyze this professional profile for business networking purposes:

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

Please search for comprehensive information about this person and provide your analysis in the specified JSON format.`,
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

      // Extract the final response
      const finalMessage = result.messages.at(-1);
      if (!finalMessage || !finalMessage.content) {
        throw new Error("No response generated from agent");
      }

      // Extract structured response
      const { summary, analysis } = this.extractStructuredResponse(
        finalMessage.content as string
      );

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

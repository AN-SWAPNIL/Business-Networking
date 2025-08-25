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
import { HumanMessage, AIMessage } from "@langchain/core/messages";
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
  private model: ChatGoogleGenerativeAI;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private searchTool: GoogleCustomSearch;
  private supabaseClient: any;
  private vectorStore: SupabaseVectorStore;
  private tools: any[];
  private toolNode: ToolNode;
  private currentProfile: any;

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
      apiKey: process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_API_KEY,
      googleCSEId: process.env.GOOGLE_CSE_ID,
    });

    // Define tools for the agent
    this.tools = [this.searchTool];
    this.toolNode = new ToolNode(this.tools);

    // Initialize LLM
    this.model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.3,
    });

    // Bind tools to model
    this.model = this.model.bindTools(this.tools) as ChatGoogleGenerativeAI;

    // Initialize embeddings
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "embedding-001",
    });

    // Initialize Supabase client with service role
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
   * Determine whether to continue with tools or end the conversation
   */
  private shouldContinue({ messages }: typeof MessagesAnnotation.State) {
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // If the LLM makes a tool call, route to the "tools" node
    if (lastMessage.tool_calls?.length) {
      return "tools";
    }
    // Otherwise, end
    return END;
  }

  /**
   * Call the model to generate search queries and execute searches
   */
  private async callModel(state: typeof MessagesAnnotation.State) {
    const response = await this.model.invoke(state.messages);
    return { messages: [response] };
  }

  /**
   * Create the LangGraph workflow
   */
  private createWorkflow() {
    const workflow = new StateGraph(MessagesAnnotation)
      .addNode("agent", this.callModel.bind(this))
      .addNode("tools", this.toolNode)
      .addEdge(START, "agent")
      .addEdge("tools", "agent")
      .addConditionalEdges("agent", this.shouldContinue.bind(this));

    return workflow.compile();
  }

  /**
   * Process search results and create analysis
   */
  private async processSearchResults(
    messages: any[],
    userProfile: any
  ): Promise<{
    analysis: string;
    summary: string;
  }> {
    // Collect all search results from tool calls
    const searchResults = messages
      .filter((msg) => msg._getType() === "tool")
      .map((msg) => msg.content)
      .join("\\n\\n---\\n\\n");

    const analysisPrompt = `
Based on the user's profile information and the search results provided, create a comprehensive professional summary.

User Profile:
- Name: ${userProfile.name}
- Title: ${userProfile.title || "Not specified"}
- Company: ${userProfile.company || "Not specified"}
- Location: ${userProfile.location || "Not specified"}
- Bio: ${userProfile.bio || "Not specified"}
- Website: ${userProfile.website || "Not specified"}
- Professional Interests: ${JSON.stringify(userProfile.preferences)}

Search Results:
${searchResults}

Create a comprehensive professional summary that includes:

1. **Professional Background**: Current role, experience, and career trajectory
2. **Company Information**: Details about their organization, industry, and recent developments
3. **Expertise & Skills**: Areas of specialization and professional competencies
4. **Industry Standing**: Recognition, achievements, and thought leadership
5. **Professional Network**: Key connections and collaborations (if found)
6. **Recent Activities**: Current projects, initiatives, or developments
7. **Networking Potential**: Assessment of their value as a professional contact based on their preferences

Guidelines:
- Be factual and professional
- Only include information that can be verified from the search results
- If information is missing or unclear, acknowledge it
- Focus on professional aspects relevant to business networking
- Structure the summary in clear, readable sections
- Aim for 300-500 words

Format the response as a well-structured professional summary.
`;

    const analysisResponse = await this.model.invoke([
      new HumanMessage(analysisPrompt),
    ]);
    const analysis = analysisResponse.content as string;

    // Create a concise summary
    const summaryPrompt = `
Based on the following comprehensive analysis, create a concise 2-3 sentence summary that captures the most important professional aspects of this person for networking purposes:

${analysis}

Focus on: their role, company, key expertise, and networking value.
`;

    const summaryResponse = await this.model.invoke([
      new HumanMessage(summaryPrompt),
    ]);
    const summary = summaryResponse.content as string;

    return { analysis, summary };
  }

  /**
   * Create and store vector embedding
   */
  private async createEmbedding(
    userProfile: any,
    analysis: string,
    summary: string
  ) {
    try {
      // Combine profile and analysis for embedding
      const embeddingContent = `
Name: ${userProfile.name}
Title: ${userProfile.title || "Not specified"}
Company: ${userProfile.company || "Not specified"}
Location: ${userProfile.location || "Not specified"}
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

      // Create document for vector store
      const document = new Document({
        pageContent: embeddingContent,
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
      });

      // Check if document already exists for this user
      const existingDocs = await this.vectorStore.similaritySearch("", 1, {
        user_id: userProfile.id,
        type: "profile_intelligence",
      });

      if (existingDocs.length > 0) {
        // Delete existing document first
        await this.supabaseClient
          .from("documents")
          .delete()
          .eq("metadata->>user_id", userProfile.id)
          .eq("metadata->>type", "profile_intelligence");
      }

      // Add new document to vector store
      await this.vectorStore.addDocuments([document]);

      console.log(
        `✅ Successfully created vector embedding for user ${userProfile.id}`
      );
    } catch (error) {
      console.error("Error creating embedding:", error);
      throw error;
    }
  }

  /**
   * Process user profile intelligence using LangGraph
   */
  async processProfileIntelligence(userProfile: any): Promise<{
    success: boolean;
    analysis?: string;
    summary?: string;
    error?: string;
  }> {
    try {
      // Validate user profile
      const validatedProfile = UserProfileSchema.parse(userProfile);

      console.log(
        `🧠 Starting profile intelligence for user: ${validatedProfile.name}`
      );

      // Create search queries prompt
      const searchPrompt = `
You are an expert research assistant. Based on the following user profile, you need to search for comprehensive information about this person, their company, and their professional background.

User Profile:
- Name: ${validatedProfile.name}
- Title: ${validatedProfile.title || "Not specified"}
- Company: ${validatedProfile.company || "Not specified"}
- Location: ${validatedProfile.location || "Not specified"}
- Bio: ${validatedProfile.bio || "Not specified"}
- Website: ${validatedProfile.website || "Not specified"}
- Professional Interests: ${
        Object.entries(validatedProfile.preferences)
          .filter(([_, value]) => value)
          .map(([key, _]) => key)
          .join(", ") || "Not specified"
      }

Please search for:
1. Professional background and achievements of "${validatedProfile.name}"
2. Information about "${validatedProfile.company || "their company"}"
3. Recent news or developments related to ${
        validatedProfile.name
      } or their company
4. Industry expertise and thought leadership of ${validatedProfile.name}

Use the search tool to find comprehensive information about this person and their professional background. Make multiple searches to gather thorough information based on their networking interests.
`;

      // Create initial state
      const initialState = {
        messages: [new HumanMessage(searchPrompt)],
      };

      // Create and run workflow
      const workflow = this.createWorkflow();
      const finalState = await workflow.invoke(initialState);

      // Process the search results
      const { analysis, summary } = await this.processSearchResults(
        finalState.messages,
        validatedProfile
      );

      // Create vector embedding
      await this.createEmbedding(validatedProfile, analysis, summary);

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

  /**
   * Search for similar profiles in the vector store
   */
  async findSimilarProfiles(query: string, limit: number = 5): Promise<any[]> {
    try {
      const results = await this.vectorStore.similaritySearch(query, limit, {
        type: "profile_intelligence",
      });

      return results.map((doc) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
      }));
    } catch (error) {
      console.error("Error finding similar profiles:", error);
      return [];
    }
  }
}

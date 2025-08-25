import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ProfileIntelligenceService } from "@/services/profile-intelligence";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Validate required fields for intelligence processing
    if (!profile.name || (!profile.company && !profile.title)) {
      return NextResponse.json(
        {
          error:
            "Profile needs at least name and (company or title) for intelligence processing",
          success: false,
        },
        { status: 400 }
      );
    }

    console.log(`🧠 Processing profile intelligence for user: ${profile.name}`);

    // Process profile intelligence
    const intelligenceService = new ProfileIntelligenceService();
    const result = await intelligenceService.processProfileIntelligence(
      profile
    );

    if (result.success) {
      console.log(
        `✅ Profile intelligence completed for user: ${profile.name}`
      );
      return NextResponse.json({
        success: true,
        message: "Profile intelligence processed successfully",
        analysis: result.analysis,
        summary: result.summary,
      });
    } else {
      console.error(
        `❌ Profile intelligence failed for user: ${profile.name}`,
        result.error
      );
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in profile intelligence API:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get existing intelligence data from vector store
    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("content, metadata")
      .eq("metadata->>user_id", user.id)
      .eq("metadata->>type", "profile_intelligence")
      .order("metadata->>created_at", { ascending: false })
      .limit(1);

    if (docError) {
      console.error("Error fetching intelligence data:", docError);
      return NextResponse.json(
        { error: "Failed to fetch intelligence data" },
        { status: 500 }
      );
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        success: true,
        hasIntelligence: false,
        message: "No intelligence data found",
      });
    }

    const doc = documents[0];
    const content = doc.content;

    // Parse the content to extract summary and analysis
    const summaryMatch = content.match(
      /Professional Summary:\n([\s\S]*?)\n\nDetailed Analysis:/
    );
    const analysisMatch = content.match(/Detailed Analysis:\n([\s\S]*)$/);

    const summary = summaryMatch ? summaryMatch[1].trim() : "";
    const analysis = analysisMatch ? analysisMatch[1].trim() : "";

    return NextResponse.json({
      success: true,
      hasIntelligence: true,
      summary,
      analysis,
      lastUpdated: doc.metadata.created_at,
    });
  } catch (error) {
    console.error("Error fetching profile intelligence:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

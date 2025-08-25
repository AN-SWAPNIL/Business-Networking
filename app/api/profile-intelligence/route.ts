import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { ProfileIntelligenceService } from "@/services/profile-intelligence-new";

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

    // Get the user profile from database
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check if we have enough information to process
    if (!profile.name || (!profile.company && !profile.title)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Insufficient profile information. Please add at least your name and either company or title.",
        },
        { status: 400 }
      );
    }

    console.log(`🚀 Triggering profile intelligence for user: ${profile.name}`);

    // Initialize and run profile intelligence service
    const intelligenceService = new ProfileIntelligenceService();
    const result = await intelligenceService.processProfileIntelligence(
      profile
    );

    if (!result.success) {
      console.error("Profile intelligence failed:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to process profile intelligence",
        },
        { status: 500 }
      );
    }

    console.log(`✅ Profile intelligence completed for user: ${profile.name}`);

    return NextResponse.json({
      success: true,
      message: "Profile intelligence processing completed successfully",
      analysis: result.analysis,
      summary: result.summary,
    });
  } catch (error) {
    console.error("Error in profile intelligence API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Get profile intelligence results
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

    // Get the vector document for this user
    // Try new user_id column first, fallback to metadata approach
    let { data: documents, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .eq("metadata->>type", "profile_intelligence")
      .order("created_at", { ascending: false })
      .limit(1);

    // If user_id column doesn't exist or no results, try old metadata approach
    if (error?.code === "42703" || !documents || documents.length === 0) {
      console.log("🔄 Falling back to metadata-based query");
      const fallbackQuery = await supabase
        .from("documents")
        .select("*")
        .eq("metadata->>user_id", user.id)
        .eq("metadata->>type", "profile_intelligence")
        .order("created_at", { ascending: false })
        .limit(1);

      documents = fallbackQuery.data;
      error = fallbackQuery.error;
    }

    console.log(`🔍 Fetching profile intelligence for user: ${user.id}`);
    console.log(`📄 Found ${documents?.length || 0} documents`);

    if (error) {
      console.error("Error fetching profile intelligence:", error);
      return NextResponse.json(
        { error: "Failed to fetch profile intelligence" },
        { status: 500 }
      );
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        success: true,
        hasIntelligence: false,
        message: "No profile intelligence found",
      });
    }

    const document = documents[0];
    const content = document.content;

    console.log(
      "📝 Document content preview:",
      content.substring(0, 300) + "..."
    );

    // Extract summary and analysis from content with simpler regex
    // Look for "Professional Summary:" followed by content until "Detailed Analysis:"
    const summaryMatch = content.match(
      /Professional Summary:\s*([\s\S]*?)\s*Detailed Analysis:/
    );
    // Look for "Detailed Analysis:" followed by content until "Professional Interests:"
    const analysisMatch = content.match(
      /Detailed Analysis:\s*([\s\S]*?)\s*Professional Interests:/
    );

    let summary = "";
    let analysis = "";

    if (summaryMatch && summaryMatch[1]) {
      summary = summaryMatch[1].trim();
    }

    if (analysisMatch && analysisMatch[1]) {
      analysis = analysisMatch[1].trim();
    }

    // If regex fails, try to extract from metadata or use fallback
    if (!summary && !analysis) {
      // Split content by sections and extract manually
      const sections = content.split("\n\n");
      let inSummary = false;
      let inAnalysis = false;
      let summaryParts = [];
      let analysisParts = [];

      for (const section of sections) {
        if (section.includes("Professional Summary:")) {
          inSummary = true;
          inAnalysis = false;
          const afterSummaryHeader = section.split("Professional Summary:")[1];
          if (afterSummaryHeader) summaryParts.push(afterSummaryHeader.trim());
        } else if (section.includes("Detailed Analysis:")) {
          inSummary = false;
          inAnalysis = true;
          const afterAnalysisHeader = section.split("Detailed Analysis:")[1];
          if (afterAnalysisHeader)
            analysisParts.push(afterAnalysisHeader.trim());
        } else if (section.includes("Professional Interests:")) {
          inSummary = false;
          inAnalysis = false;
        } else if (inSummary && section.trim()) {
          summaryParts.push(section.trim());
        } else if (inAnalysis && section.trim()) {
          analysisParts.push(section.trim());
        }
      }

      summary = summaryParts.join("\n\n");
      analysis = analysisParts.join("\n\n");
    }

    console.log("📊 Extracted summary length:", summary.length);
    console.log("📊 Extracted analysis length:", analysis.length);
    console.log("📊 Summary preview:", summary.substring(0, 100) + "...");
    console.log("📊 Analysis preview:", analysis.substring(0, 100) + "...");

    return NextResponse.json({
      success: true,
      hasIntelligence: true,
      summary,
      analysis,
      lastUpdated: document.metadata.created_at,
      metadata: document.metadata,
    });
  } catch (error) {
    console.error("Error fetching profile intelligence:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

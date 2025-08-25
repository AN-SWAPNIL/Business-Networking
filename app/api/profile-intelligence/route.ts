import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
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

    // Get the user profile from database
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check if we have enough information to process
    if (!profile.name || (!profile.company && !profile.title)) {
      return NextResponse.json(
        { 
          success: false,
          error: "Insufficient profile information. Please add at least your name and either company or title." 
        },
        { status: 400 }
      );
    }

    console.log(`🚀 Triggering profile intelligence for user: ${profile.name}`);

    // Initialize and run profile intelligence service
    const intelligenceService = new ProfileIntelligenceService();
    const result = await intelligenceService.processProfileIntelligence(profile);

    if (!result.success) {
      console.error("Profile intelligence failed:", result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || "Failed to process profile intelligence" 
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
        error: error instanceof Error ? error.message : "Internal server error" 
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
    const { data: documents, error } = await supabase
      .from("documents")
      .select("*")
      .eq("metadata->>user_id", user.id)
      .eq("metadata->>type", "profile_intelligence")
      .order("created_at", { ascending: false })
      .limit(1);

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
    
    // Extract summary and analysis from content
    const summaryMatch = content.match(/Professional Summary:[\s\S]*?([\s\S]*?)[\s\S]*?Detailed Analysis:/);
    const analysisMatch = content.match(/Detailed Analysis:[\s\S]*?([\s\S]*?)[\s\S]*?Professional Interests:/);
    
    const summary = summaryMatch ? summaryMatch[1].trim() : "";
    const analysis = analysisMatch ? analysisMatch[1].trim() : "";

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

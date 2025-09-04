import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { RAGMatchingAgent } from "@/services/rag-matching-agent";
import type { MatchingRequest } from "@/services/rag-matching-agent";

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

    // Parse request body
    const body = await request.json();
    const {
      matchingType = "all",
      maxResults = 10,
      minCompatibility = 40,
      locationPreference = "global",
      includeProfileIntelligence = true,
    } = body;

    console.log(`🎯 RAG Matching request for user ${user.id}: ${matchingType}`);

    // Validate user has a complete profile
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check if user has minimum required profile data
    if (!profile.name || (!profile.title && !profile.company)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Incomplete profile. Please add at least your name and either title or company to use matching features.",
        },
        { status: 400 }
      );
    }

    // Initialize RAG Matching Agent
    const matchingAgent = new RAGMatchingAgent();

    // Prepare matching request
    const matchingRequest: MatchingRequest = {
      userId: user.id,
      maxResults: Math.min(maxResults, 50), // Cap at 50
      minCompatibility: Math.max(minCompatibility, 10), // Minimum 10%
    };

    console.log(`🚀 Executing RAG matching with parameters:`, matchingRequest);

    // Execute matching
    const result = await matchingAgent.findMatches(matchingRequest);

    if (!result.success) {
      console.error("RAG matching failed:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Matching failed",
        },
        { status: 500 }
      );
    }

    console.log(
      `✅ RAG matching completed: ${result.matches?.length} matches found in ${result.processingTime}ms`
    );

    // Log successful matching for analytics
    await supabase.from("user_activity").insert({
      user_id: user.id,
      activity_type: "matching_search",
      details: {
        matching_type: matchingType,
        results_count: result.matches?.length || 0,
        processing_time: result.processingTime,
      },
    });

    return NextResponse.json({
      success: true,
      matches: result.matches || [],
      totalFound: result.totalFound || 0,
      processingTime: result.processingTime,
      matchingType,
      requestedBy: {
        id: user.id,
        name: profile.name,
        title: profile.title,
      },
    });
  } catch (error) {
    console.error("Error in RAG matching API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
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

    // Get URL search parameters
    const { searchParams } = new URL(request.url);
    const matchingType = searchParams.get("type") || "all";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    console.log(
      `📊 Getting existing matches for user ${user.id}: ${matchingType}`
    );

    // Initialize RAG Matching Agent
    const matchingAgent = new RAGMatchingAgent();

    // Get comprehensive networking recommendations
    if (matchingType === "all" || matchingType === "recommendations") {
      const recommendations = await matchingAgent.getNetworkingRecommendations(
        user.id
      );

      if (!recommendations.success) {
        return NextResponse.json(
          {
            success: false,
            error: recommendations.error || "Failed to get recommendations",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        type: "recommendations",
        data: recommendations.recommendations,
        generatedAt: new Date().toISOString(),
      });
    }

    // Get matches for specific type
    const result = await matchingAgent.findMatches({
      userId: user.id,
      maxResults: limit,
      minCompatibility: 40,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to get matches",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      type: matchingType,
      matches: result.matches || [],
      totalFound: result.totalFound || 0,
      processingTime: result.processingTime,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in RAG matching GET API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

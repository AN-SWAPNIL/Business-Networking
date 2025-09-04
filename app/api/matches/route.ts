import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { MatchingAlgorithm } from "@/lib/matching-algorithm";
import { RAGMatchingAgent } from "@/services/rag-matching-agent";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

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
    const algorithm = searchParams.get("algorithm") || "traditional"; // "traditional" or "rag"
    const category = searchParams.get("category") || "all";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const forceRefresh = searchParams.get("forceRefresh") === "true";

    console.log(
      `🔍 Finding matches for user ${user.id} using ${algorithm} algorithm${
        forceRefresh ? " (force refresh)" : " (cache allowed)"
      }`
    );

    // Get current user's profile
    const { data: currentUserProfile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !currentUserProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get total users count (excluding current user) to calculate realistic maxResults
    const { count: totalUsers, error: countError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .neq("id", user.id);

    if (countError) {
      console.warn("Failed to get total users count:", countError);
    }

    // Calculate realistic maxResults: min(requested limit, total available users - 1)
    const maxResults = totalUsers ? Math.min(limit, totalUsers) : limit;
    console.log(
      `📊 Total users available: ${
        totalUsers || "unknown"
      }, maxResults: ${maxResults}`
    );

    if (algorithm === "rag") {
      // Use RAG-based matching
      const ragAgent = new RAGMatchingAgent();

      const result = await ragAgent.findMatches(
        {
          userId: user.id,
          maxResults: maxResults,
          minCompatibility: 20, // Use schema default
        },
        forceRefresh
      );

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "RAG matching failed",
          },
          { status: 500 }
        );
      }

      // If RAG found no matches (likely due to missing embeddings), fallback to traditional
      if (!result.matches || result.matches.length === 0) {
        console.log(
          "🔄 RAG found no matches, falling back to traditional algorithm"
        );

        // Get all users for traditional matching (excluding current user)
        const { data: allUsers, error: usersError } = await supabase
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
            skills,
            interests,
            preferences,
            stats
          `
          )
          .neq("id", user.id)
          .limit(100);

        if (usersError) {
          return NextResponse.json(
            { error: "Failed to fetch users for fallback matching" },
            { status: 500 }
          );
        }

        // Use traditional algorithm as fallback
        const currentUser = {
          id: currentUserProfile.id,
          name: currentUserProfile.name,
          title: currentUserProfile.title || "",
          company: currentUserProfile.company || "",
          location: currentUserProfile.location || "",
          bio: currentUserProfile.bio || "",
          avatar: currentUserProfile.avatar_url || "/placeholder-user.jpg",
          preferences: currentUserProfile.preferences || {
            mentor: false,
            invest: false,
            discuss: true,
            collaborate: false,
            hire: false,
          },
          skills: currentUserProfile.skills || [],
          interests: currentUserProfile.interests || [],
          connections: currentUserProfile.stats?.connections || 0,
        };

        const users = (allUsers || []).map((u) => ({
          id: u.id,
          name: u.name,
          title: u.title || "",
          company: u.company || "",
          location: u.location || "",
          bio: u.bio || "",
          avatar: u.avatar_url || "/placeholder-user.jpg",
          preferences: u.preferences || {
            mentor: false,
            invest: false,
            discuss: true,
            collaborate: false,
            hire: false,
          },
          skills: u.skills || [],
          interests: u.interests || [],
          connections: u.stats?.connections || 0,
        }));

        // Import and use traditional matching algorithm
        const { MatchingAlgorithm } = await import("@/lib/matching-algorithm");
        const matchingAlgorithm = new MatchingAlgorithm();
        const traditionalMatches = matchingAlgorithm.findMatches(
          currentUser,
          users
        );

        // Filter by category if specified
        let filteredMatches = traditionalMatches;
        if (category !== "all") {
          filteredMatches = traditionalMatches.filter((match) => {
            const matchTypes = match.matchTypes || [];

            switch (category) {
              case "mentorship":
                return matchTypes.some(
                  (type: string) =>
                    type.toLowerCase().includes("mentor") ||
                    type.toLowerCase().includes("mentee")
                );
              case "collaboration":
                return matchTypes.some(
                  (type: string) =>
                    type.toLowerCase().includes("collaborator") ||
                    type.toLowerCase().includes("discussion partner")
                );
              case "investment":
                return matchTypes.some(
                  (type: string) =>
                    type.toLowerCase().includes("investor") ||
                    type.toLowerCase().includes("investment opportunity")
                );
              case "hiring":
                return matchTypes.some(
                  (type: string) =>
                    type.toLowerCase().includes("hiring manager") ||
                    type.toLowerCase().includes("potential hire")
                );
              case "discussion":
                return matchTypes.some((type: string) =>
                  type.toLowerCase().includes("discussion partner")
                );
              default:
                return true;
            }
          });
        }

        // Limit results
        const limitedMatches = filteredMatches.slice(0, maxResults);

        return NextResponse.json({
          success: true,
          algorithm: "rag-fallback-traditional",
          category,
          matches: limitedMatches,
          totalFound: limitedMatches.length,
          processingTime: `${Date.now() - startTime}ms`,
          fallbackReason:
            "No vector embeddings found, used traditional matching",
          currentUser: {
            id: currentUser.id,
            name: currentUser.name,
            title: currentUser.title,
            company: currentUser.company,
          },
        });
      }

      return NextResponse.json({
        success: true,
        algorithm: "rag",
        category,
        matches: result.matches || [],
        totalFound: result.totalFound || 0,
        processingTime: result.processingTime,
        cacheUsed: result.cacheUsed || false,
        cacheAge: result.cacheAge || 0,
        currentUser: {
          id: currentUserProfile.id,
          name: currentUserProfile.name,
          title: currentUserProfile.title,
          company: currentUserProfile.company,
        },
      });
    } else {
      // Use traditional rule-based matching

      // Get all users for traditional matching (excluding current user)
      const { data: allUsers, error: usersError } = await supabase
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
          skills,
          interests,
          preferences,
          stats
        `
        )
        .neq("id", user.id)
        .limit(1000); // Reasonable limit for traditional algorithm

      if (usersError) {
        return NextResponse.json(
          { error: "Failed to fetch users" },
          { status: 500 }
        );
      }

      // Transform data for traditional algorithm
      const currentUser = {
        id: currentUserProfile.id,
        name: currentUserProfile.name,
        title: currentUserProfile.title || "",
        company: currentUserProfile.company || "",
        location: currentUserProfile.location || "",
        bio: currentUserProfile.bio || "",
        avatar: currentUserProfile.avatar_url || "/placeholder-user.jpg",
        preferences: currentUserProfile.preferences || {
          mentor: false,
          invest: false,
          discuss: true,
          collaborate: false,
          hire: false,
        },
        skills: currentUserProfile.skills || [],
        interests: currentUserProfile.interests || [],
        connections: currentUserProfile.stats?.connections || 0,
      };

      const users = (allUsers || []).map((u) => ({
        id: u.id,
        name: u.name,
        title: u.title || "",
        company: u.company || "",
        location: u.location || "",
        bio: u.bio || "",
        avatar: u.avatar_url || "/placeholder-user.jpg",
        preferences: u.preferences || {
          mentor: false,
          invest: false,
          discuss: true,
          collaborate: false,
          hire: false,
        },
        skills: u.skills || [],
        interests: u.interests || [],
        connections: u.stats?.connections || 0,
      }));

      // Use traditional matching algorithm
      const matchingAlgorithm = new MatchingAlgorithm();
      const allMatches = matchingAlgorithm.findMatches(currentUser, users);

      // Filter by category if specified
      let filteredMatches = allMatches;
      if (category !== "all") {
        filteredMatches = allMatches.filter((match) => {
          const matchTypes = match.matchTypes || [];

          switch (category) {
            case "mentorship":
              return matchTypes.some(
                (type: string) =>
                  type.toLowerCase().includes("mentor") ||
                  type.toLowerCase().includes("mentee")
              );
            case "collaboration":
              return matchTypes.some(
                (type: string) =>
                  type.toLowerCase().includes("collaborator") ||
                  type.toLowerCase().includes("discussion partner")
              );
            case "investment":
              return matchTypes.some(
                (type: string) =>
                  type.toLowerCase().includes("investor") ||
                  type.toLowerCase().includes("investment opportunity")
              );
            case "hiring":
              return matchTypes.some(
                (type: string) =>
                  type.toLowerCase().includes("hiring manager") ||
                  type.toLowerCase().includes("potential hire")
              );
            case "discussion":
              return matchTypes.some((type: string) =>
                type.toLowerCase().includes("discussion partner")
              );
            default:
              return true;
          }
        });
      }

      // Limit results
      const limitedMatches = filteredMatches.slice(0, maxResults);

      return NextResponse.json({
        success: true,
        algorithm: "traditional",
        category,
        matches: limitedMatches,
        totalFound: limitedMatches.length,
        allMatchesCount: allMatches.length,
        currentUser: {
          id: currentUser.id,
          name: currentUser.name,
          title: currentUser.title,
          company: currentUser.company,
        },
      });
    }
  } catch (error) {
    console.error("Error in matches API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const { algorithm = "rag", categories = ["all"], preferences = {} } = body;

    console.log(`🎯 Batch matching request for user ${user.id}`);

    if (algorithm === "rag") {
      const ragAgent = new RAGMatchingAgent();

      const results = [];

      for (const category of categories) {
        const result = await ragAgent.findMatches({
          userId: user.id,
          maxResults: 10,
          minCompatibility: preferences.minCompatibility || 40,
        });

        results.push({
          category,
          success: result.success,
          matches: result.matches || [],
          error: result.error,
        });
      }

      return NextResponse.json({
        success: true,
        algorithm: "rag",
        results,
        processedAt: new Date().toISOString(),
      });
    } else {
      // Traditional batch processing
      return NextResponse.json({
        success: false,
        error: "Batch processing not implemented for traditional algorithm",
      });
    }
  } catch (error) {
    console.error("Error in batch matching:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

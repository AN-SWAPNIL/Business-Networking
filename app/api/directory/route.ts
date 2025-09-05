import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Define types for better type safety
interface UserPreferences {
  mentor?: boolean;
  invest?: boolean;
  discuss?: boolean;
  collaborate?: boolean;
  hire?: boolean;
}

interface UserStats {
  connections?: number;
}

interface DatabaseUser {
  id: string;
  email: string;
  name: string;
  title?: string;
  company?: string;
  location?: string;
  bio?: string;
  phone?: string;
  website?: string;
  avatar_url?: string;
  preferences?: UserPreferences;
  skills?: string[];
  interests?: string[];
  stats?: UserStats;
  created_at: string;
  updated_at?: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Get current user to exclude from results (optional)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Parse query parameters
    const search = searchParams.get("search")?.toLowerCase() || "";
    const company = searchParams.get("company") || "all";
    const location = searchParams.get("location") || "all";
    const preference = searchParams.get("preference") || "all";
    const tab = searchParams.get("tab") || "all";
    const viewMode = searchParams.get("viewMode") || "grid";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build the base query
    let query = supabase.from("users").select(`
        id,
        email,
        name,
        title,
        company,
        location,
        bio,
        phone,
        website,
        avatar_url,
        preferences,
        skills,
        interests,
        stats,
        created_at,
        updated_at
      `);

    // Apply text search filters if search query exists
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,title.ilike.%${search}%,company.ilike.%${search}%,bio.ilike.%${search}%,skills.cs.{${search}},interests.cs.{${search}}`
      );
    }

    // Apply company filter
    if (company !== "all") {
      query = query.eq("company", company);
    }

    // Apply location filter
    if (location !== "all") {
      query = query.eq("location", location);
    }

    // Apply preference-based filtering
    if (preference !== "all") {
      switch (preference) {
        case "mentor":
          query = query.eq("preferences->mentor", true);
          break;
        case "invest":
          query = query.eq("preferences->invest", true);
          break;
        case "discuss":
          query = query.eq("preferences->discuss", true);
          break;
        case "collaborate":
          query = query.eq("preferences->collaborate", true);
          break;
        case "hire":
          query = query.eq("preferences->hire", true);
          break;
      }
    }

    // Apply tab-based filtering (same as preference but separate parameter)
    if (tab !== "all") {
      switch (tab) {
        case "mentors":
          query = query.eq("preferences->mentor", true);
          break;
        case "investors":
          query = query.eq("preferences->invest", true);
          break;
        case "collaborators":
          query = query.eq("preferences->collaborate", true);
          break;
        case "hiring":
          query = query.eq("preferences->hire", true);
          break;
      }
    }

    // Exclude current user from results (optional)
    if (user) {
      query = query.neq("id", user.id);
    }

    // Get total count for pagination - use a separate query for count
    let countQuery = supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    // Apply the same filters to count query
    if (search) {
      countQuery = countQuery.or(
        `name.ilike.%${search}%,title.ilike.%${search}%,company.ilike.%${search}%,bio.ilike.%${search}%,skills.cs.{${search}},interests.cs.{${search}}`
      );
    }
    if (company !== "all") {
      countQuery = countQuery.eq("company", company);
    }
    if (location !== "all") {
      countQuery = countQuery.eq("location", location);
    }
    if (preference !== "all") {
      switch (preference) {
        case "mentor":
          countQuery = countQuery.eq("preferences->mentor", true);
          break;
        case "invest":
          countQuery = countQuery.eq("preferences->invest", true);
          break;
        case "discuss":
          countQuery = countQuery.eq("preferences->discuss", true);
          break;
        case "collaborate":
          countQuery = countQuery.eq("preferences->collaborate", true);
          break;
        case "hire":
          countQuery = countQuery.eq("preferences->hire", true);
          break;
      }
    }
    if (tab !== "all") {
      switch (tab) {
        case "mentors":
          countQuery = countQuery.eq("preferences->mentor", true);
          break;
        case "investors":
          countQuery = countQuery.eq("preferences->invest", true);
          break;
        case "collaborators":
          countQuery = countQuery.eq("preferences->collaborate", true);
          break;
        case "hiring":
          countQuery = countQuery.eq("preferences->hire", true);
          break;
      }
    }
    if (user) {
      countQuery = countQuery.neq("id", user.id);
    }

    const { count: totalCount } = await countQuery;

    // Apply pagination and ordering
    const { data: users, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching directory users:", error);
      return NextResponse.json(
        { error: "Failed to fetch directory users" },
        { status: 500 }
      );
    }

    // Get statistics for the dashboard
    const { data: allUsers } = await supabase
      .from("users")
      .select("company, location, preferences")
      .neq("id", user?.id || "");

    // Calculate stats with proper typing
    const stats = {
      totalMembers: allUsers?.length || 0,
      companies: new Set(allUsers?.map((u: any) => u.company).filter(Boolean))
        .size,
      locations: new Set(allUsers?.map((u: any) => u.location).filter(Boolean))
        .size,
      mentors: allUsers?.filter((u: any) => u.preferences?.mentor).length || 0,
      investors:
        allUsers?.filter((u: any) => u.preferences?.invest).length || 0,
      collaborators:
        allUsers?.filter((u: any) => u.preferences?.collaborate).length || 0,
      hiring: allUsers?.filter((u: any) => u.preferences?.hire).length || 0,
    };

    // Get unique companies and locations for filter options
    const companies = Array.from(
      new Set(allUsers?.map((u: any) => u.company).filter(Boolean) || [])
    ).sort();

    const locations = Array.from(
      new Set(allUsers?.map((u: any) => u.location).filter(Boolean) || [])
    ).sort();

    // Transform users data to match frontend expectations
    const transformedUsers =
      users?.map((user: DatabaseUser) => ({
        ...user,
        connections: user.stats?.connections || 0,
        joinedDate: new Date(user.created_at).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        preferences: {
          mentor: user.preferences?.mentor || false,
          invest: user.preferences?.invest || false,
          discuss: user.preferences?.discuss || false,
          collaborate: user.preferences?.collaborate || false,
          hire: user.preferences?.hire || false,
        },
      })) || [];

    return NextResponse.json({
      users: transformedUsers,
      stats,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasMore: offset + limit < (totalCount || 0),
      },
      filters: {
        companies,
        locations,
      },
    });
  } catch (error) {
    console.error("Directory API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint for fetching directory stats only (lighter endpoint)
export async function HEAD(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user to exclude from stats
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Get basic stats
    const { data: allUsers } = await supabase
      .from("users")
      .select("company, location, preferences")
      .neq("id", user?.id || "");

    const stats = {
      totalMembers: allUsers?.length || 0,
      companies: new Set(allUsers?.map((u: any) => u.company).filter(Boolean))
        .size,
      locations: new Set(allUsers?.map((u: any) => u.location).filter(Boolean))
        .size,
      mentors: allUsers?.filter((u: any) => u.preferences?.mentor).length || 0,
      investors:
        allUsers?.filter((u: any) => u.preferences?.invest).length || 0,
      collaborators:
        allUsers?.filter((u: any) => u.preferences?.collaborate).length || 0,
      hiring: allUsers?.filter((u: any) => u.preferences?.hire).length || 0,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Directory stats API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

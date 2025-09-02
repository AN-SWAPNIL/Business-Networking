import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check how many users exist
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, title, company")
      .limit(10);

    if (usersError) {
      console.error("Error fetching users:", usersError);
    }

    // Check how many embeddings exist
    const { data: embeddings, error: embeddingsError } = await supabase
      .from("documents")
      .select("id, user_id, content, metadata")
      .limit(10);

    if (embeddingsError) {
      console.error("Error fetching embeddings:", embeddingsError);
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: users?.length || 0,
        totalEmbeddings: embeddings?.length || 0,
        sampleUsers:
          users?.map((u) => ({
            id: u.id,
            name: u.name,
            title: u.title,
            company: u.company,
          })) || [],
        sampleEmbeddings:
          embeddings?.map((e) => ({
            id: e.id,
            user_id: e.user_id,
            content: e.content?.substring(0, 100) + "...",
            metadata: e.metadata,
          })) || [],
      },
    });
  } catch (error) {
    console.error("Database check error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Database check failed",
      },
      { status: 500 }
    );
  }
}

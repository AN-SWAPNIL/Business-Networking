import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteAvatar } from "@/lib/avatar-upload";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's current avatar
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, avatar_url")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Delete avatar from storage if it exists
    if (userData.avatar_url && userData.avatar_url.includes("/avatars/")) {
      const deleteSuccess = await deleteAvatar(userData.avatar_url);
      if (!deleteSuccess) {
        console.warn(
          "Failed to delete avatar from storage:",
          userData.avatar_url
        );
        // Continue anyway - still remove from database
      }
    }

    // Remove avatar_url from database
    const { data: updateData, error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id, name, avatar_url")
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to remove avatar" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Avatar removed successfully",
      user: updateData,
    });
  } catch (error) {
    console.error("Avatar removal API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

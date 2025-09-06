import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const deleteAccountSchema = z.object({
  confirmDelete: z.boolean().refine((val) => val === true, {
    message: "You must confirm account deletion",
  }),
});

const updateSettingsSchema = z.object({
  notifications: z
    .object({
      email: z.boolean(),
      push: z.boolean(),
      connections: z.boolean(),
      messages: z.boolean(),
      collaborations: z.boolean(),
      mentions: z.boolean(),
    })
    .optional(),
  privacy: z
    .object({
      profileVisibility: z.enum(["public", "network", "private"]),
      showEmail: z.boolean(),
      showPhone: z.boolean(),
      allowMessages: z.boolean(),
    })
    .optional(),
});

// GET - Export user data
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

    // Get user profile and all related data
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile for export:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch profile data" },
        { status: 500 }
      );
    }

    // Prepare exportable data (including all profile fields)
    const exportData = {
      profile: {
        id: profile.id,
        name: profile.name,
        title: profile.title,
        company: profile.company,
        location: profile.location,
        bio: profile.bio,
        phone: profile.phone,
        website: profile.website,
        avatar_url: profile.avatar_url,
        skills: profile.skills,
        interests: profile.interests,
        preferences: profile.preferences,
        stats: profile.stats,
        settings: profile.settings,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
      auth: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        updated_at: user.updated_at,
      },
      exportDate: new Date().toISOString(),
      exportVersion: "1.0",
    };

    return NextResponse.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error("Export data error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update account settings
export async function PUT(request: NextRequest) {
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
    const { notifications, privacy } = updateSettingsSchema.parse(body);

    // Get current profile
    const { data: currentProfile, error: fetchError } = await supabase
      .from("users")
      .select("settings")
      .eq("id", user.id)
      .single();

    if (fetchError) {
      console.error("Error fetching current profile:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch current settings" },
        { status: 500 }
      );
    }

    // Merge new settings with existing ones
    const currentSettings = currentProfile.settings || {};
    const updatedSettings = {
      ...currentSettings,
      ...(notifications && { notifications }),
      ...(privacy && { privacy }),
    };

    // Update settings in database
    const { error: updateError } = await supabase
      .from("users")
      .update({
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete account
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
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { confirmDelete } = deleteAccountSchema.parse(body);

    if (!confirmDelete) {
      return NextResponse.json(
        { error: "Account deletion not confirmed" },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS for deletion
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log("🗑️ Starting account deletion process for user:", user.id);

    // Delete from auth.users table - this will cascade to public.users and all related data
    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (authDeleteError) {
      console.error("Failed to delete from auth.users:", authDeleteError);
      return NextResponse.json(
        { error: "Failed to delete user account" },
        { status: 500 }
      );
    }

    console.log(
      "✅ Successfully deleted from auth.users (cascaded to all related data)"
    );

    // Sign out the user
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully. You will be redirected shortly.",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

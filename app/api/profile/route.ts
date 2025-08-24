import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  preferences: z
    .object({
      mentor: z.boolean(),
      invest: z.boolean(),
      discuss: z.boolean(),
      collaborate: z.boolean(),
      hire: z.boolean(),
    })
    .optional(),
});

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

    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        title: profile.title,
        company: profile.company,
        location: profile.location,
        bio: profile.bio,
        phone: profile.phone,
        website: profile.website,
        avatar_url: profile.avatar_url,
        preferences: profile.preferences || {
          mentor: false,
          invest: false,
          discuss: false,
          collaborate: false,
          hire: false,
        },
        stats: profile.stats || {
          connections: 0,
          collaborations: 0,
          mentorships: 0,
          investments: 0,
          discussions: 0,
          monitored: 0,
          hired: 0,
        },
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    });
  } catch (error) {
    console.error("Error in profile API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    // Parse and validate the request body
    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    // Update user profile in database
    const { data: updatedProfile, error: updateError } = await supabase
      .from("users")
      .update({
        name: validatedData.name,
        title: validatedData.title,
        company: validatedData.company,
        location: validatedData.location,
        bio: validatedData.bio,
        phone: validatedData.phone,
        website: validatedData.website,
        preferences: validatedData.preferences,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        name: updatedProfile.name,
        title: updatedProfile.title,
        company: updatedProfile.company,
        location: updatedProfile.location,
        bio: updatedProfile.bio,
        phone: updatedProfile.phone,
        website: updatedProfile.website,
        avatar_url: updatedProfile.avatar_url,
        preferences: updatedProfile.preferences || {
          mentor: false,
          invest: false,
          discuss: false,
          collaborate: false,
          hire: false,
        },
        stats: updatedProfile.stats || {
          connections: 0,
          collaborations: 0,
          mentorships: 0,
          investments: 0,
          discussions: 0,
          monitored: 0,
          hired: 0,
        },
        created_at: updatedProfile.created_at,
        updated_at: updatedProfile.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

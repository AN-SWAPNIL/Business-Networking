import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const oauthSchema = z.object({
  provider: z.literal("google", {
    errorMap: () => ({ message: "Only Google OAuth is supported" }),
  }),
  profileData: z
    .object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      email: z.string().email("Invalid email address"),
      title: z.string().optional(),
      company: z.string().optional(),
      location: z.string().optional(),
      bio: z.string().optional(),
      phone: z.string().optional(),
      website: z.string().optional(),
      skills: z.array(z.string()).optional(),
      interests: z.array(z.string()).optional(),
      preferences: z
        .object({
          mentor: z.boolean(),
          invest: z.boolean(),
          discuss: z.boolean(),
          collaborate: z.boolean(),
          hire: z.boolean(),
        })
        .optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, profileData } = oauthSchema.parse(body);

    const supabase = await createClient();

    let redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;

    // If profile data is provided (signup), include it in the redirect
    const encodedProfileData = btoa(JSON.stringify(profileData));
    redirectTo += `?profile_data=${encodedProfileData}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      url: data.url,
      provider,
      message: profileData
        ? "Redirecting to Google OAuth for signup..."
        : "Redirecting to Google OAuth for login...",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    console.error("OAuth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

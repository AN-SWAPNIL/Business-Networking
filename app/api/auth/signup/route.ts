import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  profileData: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    title: z.string().optional(),
    company: z.string().optional(),
    location: z.string().optional(),
    bio: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    preferences: z
      .object({
        mentor: z.boolean(),
        invest: z.boolean(),
        discuss: z.boolean(),
        collaborate: z.boolean(),
        hire: z.boolean(),
      })
      .optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, profileData } = signupSchema.parse(body);

    const supabase = await createClient();

    // Sign up the user with minimal metadata (just name for basic trigger)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${
          process.env.NEXT_PUBLIC_APP_URL
        }/auth/callback?profile_data=${btoa(JSON.stringify(profileData))}`,
        data: {
          name: profileData.name, // Just basic data, full profile via callback
        },
      },
    });

    if (error) {
      console.log("Signup error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.user && !data.user.email_confirmed_at) {
      return NextResponse.json(
        {
          message: "Please check your email to confirm your account",
          user: {
            id: data.user.id,
            email: data.user.email,
            emailConfirmed: false,
          },
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: data.user?.id,
          email: data.user?.email,
          emailConfirmed: true,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

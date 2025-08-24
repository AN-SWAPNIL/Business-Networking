import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const profileData = searchParams.get("profile_data");

  console.log("Callback called with:", {
    code: !!code,
    next,
    profileData: !!profileData,
  });

  if (code) {
    console.log("=== AUTH CALLBACK START ===");
    console.log("Code:", code ? "present" : "missing");
    console.log("Profile data:", profileData ? "present" : "missing");
    console.log("Next:", next);

    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      console.log("✅ Successfully exchanged code for session");
      console.log("Auth session exchanged successfully");

      // If profile data was passed (from OAuth signup), update user profile
      if (profileData) {
        console.log("Processing signup with profile data");
        try {
          const decodedProfileData = JSON.parse(atob(profileData));

          // Get the current user to get their ID
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            // Update user metadata with profile information
            const { error: updateError } = await supabase.auth.updateUser({
              data: {
                full_name: decodedProfileData.name,
                title: decodedProfileData.title,
                company: decodedProfileData.company,
                location: decodedProfileData.location,
                bio: decodedProfileData.bio,
                phone: decodedProfileData.phone,
                website: decodedProfileData.website,
              },
            });

            if (updateError) {
              console.error("Failed to update user metadata:", updateError);
            }

            // Use service role client to bypass RLS for server-side operations
            const supabaseAdmin = createSupabaseClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            // Also update the public.users table directly
            console.log("Updating users table with:", {
              id: user.id,
              email: user.email,
              name: decodedProfileData.name,
            });

            const { data: upsertData, error: profileUpdateError } =
              await supabaseAdmin
                .from("users")
                .upsert({
                  id: user.id,
                  email: user.email!,
                  name: decodedProfileData.name,
                  title: decodedProfileData.title,
                  company: decodedProfileData.company,
                  location: decodedProfileData.location,
                  bio: decodedProfileData.bio,
                  phone: decodedProfileData.phone,
                  website: decodedProfileData.website,
                  avatar_url: user.user_metadata?.avatar_url,
                  preferences: {
                    mentor: false,
                    invest: false,
                    discuss: false,
                    collaborate: false,
                    hire: false,
                  },
                })
                .select();

            if (profileUpdateError) {
              console.error(
                "Failed to update user profile:",
                profileUpdateError
              );
            } else {
              console.log("Successfully updated users table:", upsertData);
            }
          }
        } catch (profileError) {
          console.error("Failed to parse profile data:", profileError);
        }
      } else {
        // No profile data means this is a login (not signup)
        // Check if user exists in public.users table and create basic profile if needed
        console.log("Processing OAuth login (no profile data)");
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          console.log("Got user from auth:", {
            id: user?.id,
            email: user?.email,
          });

          if (user) {
            // Use service role client to check and create user profile
            const supabaseAdmin = createSupabaseClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            // Check if user exists in public.users table
            const { data: existingUser, error: checkError } =
              await supabaseAdmin
                .from("users")
                .select("id, created_at, updated_at")
                .eq("id", user.id)
                .single();

            console.log("User check result:", { existingUser, checkError });

            if (checkError && checkError.code === "PGRST116") {
              // User doesn't exist in public.users table - this is expected for login
              console.log(
                "User not found in public.users table - creating basic profile"
              );

              const { data: newUser, error: createError } = await supabaseAdmin
                .from("users")
                .insert({
                  id: user.id,
                  email: user.email!,
                  name:
                    user.user_metadata?.full_name || user.email!.split("@")[0],
                  avatar_url: user.user_metadata?.avatar_url,
                  preferences: {
                    mentor: false,
                    invest: false,
                    discuss: false,
                    collaborate: false,
                    hire: false,
                  },
                })
                .select();

              if (createError) {
                console.error(
                  "Failed to create basic user profile:",
                  createError
                );
              } else {
                console.log("Successfully created basic profile:", newUser);
              }
            } else if (existingUser) {
              // User exists in public.users - check if newly created
              const userCreatedAt = new Date(existingUser.created_at);
              const userUpdatedAt = new Date(existingUser.updated_at);
              const isNewlyCreated =
                userCreatedAt.getTime() === userUpdatedAt.getTime();

              console.log(`Public.users created at: ${userCreatedAt}`);
              console.log(`Public.users updated at: ${userUpdatedAt}`);
              console.log(
                `Is newly created (created_at === updated_at): ${isNewlyCreated}`
              );

              if (isNewlyCreated) {
                // This user was just auto-created by the trigger - delete both
                console.log(
                  "🚫 Detecting unauthorized OAuth signup - deleting user from both auth.users and public.users"
                );

                // First delete from public.users table
                const { error: publicDeleteError } = await supabaseAdmin
                  .from("users")
                  .delete()
                  .eq("id", user.id);

                if (publicDeleteError) {
                  console.error(
                    "Failed to delete from public.users:",
                    publicDeleteError
                  );
                } else {
                  console.log("✅ Successfully deleted from public.users");
                }

                // Then delete from auth.users table
                const { error: authDeleteError } =
                  await supabaseAdmin.auth.admin.deleteUser(user.id);

                if (authDeleteError) {
                  console.error(
                    "Failed to delete from auth.users:",
                    authDeleteError
                  );
                } else {
                  console.log("✅ Successfully deleted from auth.users");
                }

                // Sign out and redirect to login with error
                await supabase.auth.signOut();
                return NextResponse.redirect(
                  `${origin}/login?error=signup_required&message=Please sign up first before logging in with Google`
                );
              } else {
                console.log(
                  "User already exists and is legitimate - allowing login"
                );
              }
            } else if (checkError) {
              console.error("Error checking user existence:", checkError);
            }
          }
        } catch (loginError) {
          console.error("Failed to handle OAuth login:", loginError);
        }
      }

      // Successful authentication - redirect to specified page
      if (next === "/" || profileData) {
        // If coming from onboarding or OAuth signup, redirect there for verification detection
        return NextResponse.redirect(`${origin}/?verified=true`);
      } else {
        // If coming from login or specific redirect, go there
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else {
      console.error("Authentication error:", error);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  }

  // If there's no code, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=invalid_auth_link`);
}

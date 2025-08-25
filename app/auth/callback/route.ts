import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  const profileData = searchParams.get("profile_data");

  console.log("Callback called with:", {
    code: !!code,
    next,
    redirectTo,
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
            // Reject if Google email does not match profileData email

            // Use service role client to bypass RLS for server-side operations
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
              // User doesn't exist in public.users table - this means email signup flow
              // For signup with profile data, this is unexpected - should have been created
              console.error(
                "🚫 User not found in database during signup - this shouldn't happen"
              );

              // Delete the auth user and redirect with error
              const { error: authDeleteError } =
                await supabaseAdmin.auth.admin.deleteUser(user.id);
              if (authDeleteError) {
                console.error("Failed to delete auth user:", authDeleteError);
              }

              await supabase.auth.signOut();
              return NextResponse.redirect(
                `${origin}/?error=signup_failed&message=Signup failed. Please try again.`
              );
            } else if (checkError) {
              // Other database errors
              console.error("Database error during signup:", checkError);

              // Delete the auth user and redirect with error
              const { error: authDeleteError } =
                await supabaseAdmin.auth.admin.deleteUser(user.id);
              if (authDeleteError) {
                console.error("Failed to delete auth user:", authDeleteError);
              }

              await supabase.auth.signOut();
              return NextResponse.redirect(
                `${origin}/?error=database_error&message=Database error. Please try again.`
              );
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

              if (!isNewlyCreated) {
                // User already exists and is not newly created - this means email already taken
                console.error("🚫 Email already exists - rejecting signup");

                // Delete the auth user and redirect with error
                const { error: authDeleteError } =
                  await supabaseAdmin.auth.admin.deleteUser(user.id);
                if (authDeleteError) {
                  console.error("Failed to delete auth user:", authDeleteError);
                }

                await supabase.auth.signOut();
                return NextResponse.redirect(
                  `${origin}/?error=email_exists&message=A user with this email already exists. Please sign in with your existing account.`
                );
              }
            }

            // Check if Google email matches profile data email
            if (user.email !== decodedProfileData.email) {
              console.error(
                "🚫 Google email does not match profile data email. Deleting user and rejecting signup."
              );

              // console.log("Email mismatch:", {
              //   user: user,
              //   profile: decodedProfileData
              // });

              // First delete from public.users table (in case it was created by trigger)
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

              await supabase.auth.signOut();
              return NextResponse.redirect(
                `${origin}/?error=email_mismatch&message=Google email does not match profile data email.`
              );
            }

            // Update user metadata with profile information
            const { error: updateError } = await supabase.auth.updateUser({
              data: {
                name: decodedProfileData.name,
                title: decodedProfileData.title,
                company: decodedProfileData.company,
                location: decodedProfileData.location,
                bio: decodedProfileData.bio,
                phone: decodedProfileData.phone,
                website: decodedProfileData.website,
                preferences: decodedProfileData.preferences || {
                  mentor: false,
                  invest: false,
                  discuss: false,
                  collaborate: false,
                  hire: false,
                },
              },
            });

            if (updateError) {
              console.error("Failed to update user metadata:", updateError);
            }

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
                  preferences: decodedProfileData.preferences || {
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

              // Trigger profile intelligence in the background for new signups
              if (upsertData && upsertData.length > 0) {
                const updatedUser = upsertData[0];
                if (updatedUser.name && (updatedUser.company || updatedUser.title)) {
                  try {
                    // Make async call to profile intelligence API
                    const intelligenceUrl = `${origin}/api/profile-intelligence`;
                    
                    // Create a minimal request context for the API call
                    fetch(intelligenceUrl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${code}`, // Use the auth code temporarily
                      },
                    }).catch(error => {
                      console.log("Profile intelligence trigger failed for new signup (background process):", error.message);
                    });
                    
                    console.log("🧠 Profile intelligence triggered for new signup");
                  } catch (error) {
                    console.log("Failed to trigger profile intelligence for signup:", error);
                    // Don't fail the main request
                  }
                }
              }
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
              // Handle database errors when checking user existence
              console.error("Error checking user existence:", checkError);

              // If it's not a "user not found" error, something else went wrong
              // Sign out and redirect with generic error
              await supabase.auth.signOut();
              return NextResponse.redirect(
                `${origin}/login?error=database_error&message=Unable to verify user account. Please try again.`
              );
            } else {
              // This shouldn't happen (no user found, no error, but existingUser is null)
              console.error(
                "Unexpected state: no user found but no error returned"
              );
              await supabase.auth.signOut();
              return NextResponse.redirect(
                `${origin}/login?error=unexpected_error&message=An unexpected error occurred. Please try again.`
              );
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
        // If coming from login or specific redirect, use redirectTo parameter or default to root
        const finalRedirect = redirectTo !== "/" ? redirectTo : next;
        return NextResponse.redirect(`${origin}${finalRedirect}`);
      }
    } else {
      console.error("Authentication error:", error);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  }

  // If there's no code, redirect to login with error
  return NextResponse.redirect(`${origin}/?error=invalid_auth_link`);
}

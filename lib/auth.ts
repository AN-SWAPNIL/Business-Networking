import { createClient } from "@/lib/supabase/server";
import { User } from "@supabase/supabase-js";

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

export async function getUserProfile(userId?: string) {
  const supabase = await createClient();
  const user = userId ? { id: userId } : await getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error("Failed to fetch user profile");
  }

  return profile;
}

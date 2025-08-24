"use client";

import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const refresh = async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        // Handle specific auth errors silently for better UX
        if (
          error.message?.includes("Auth session missing") ||
          error.message?.includes("Forbidden") ||
          error.message?.includes("401") ||
          error.message?.includes("403") ||
          error.message?.includes("User from sub claim in JWT does not exist")
        ) {
          // These are expected when user is not logged in or deleted
          await supabase.auth.signOut();
          setUser(null);
        } else {
          console.error("Auth error:", error);
          await supabase.auth.signOut();
          setUser(null);
        }
        return;
      }

      setUser(user);
    } catch (error) {
      console.error("Unexpected auth error:", error);
      // Clear user state on any unexpected error
      await supabase.auth.signOut();
      setUser(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          // Handle specific auth errors silently for better UX
          if (
            error.message?.includes("Auth session missing") ||
            error.message?.includes("Forbidden") ||
            error.message?.includes("401") ||
            error.message?.includes("403") ||
            error.message?.includes("User from sub claim in JWT does not exist")
          ) {
            // These are expected when user is not logged in or deleted
            await supabase.auth.signOut();
            setUser(null);
          } else {
            console.error("Initial auth error:", error);
            await supabase.auth.signOut();
            setUser(null);
          }
        } else {
          setUser(user);
        }
      } catch (error) {
        console.error("Unexpected initial auth error:", error);
        // Clear user state on any unexpected error
        await supabase.auth.signOut();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

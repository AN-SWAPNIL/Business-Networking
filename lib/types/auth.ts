import { User } from "@supabase/supabase-js";

export interface AuthResponse {
  user?: {
    id: string;
    email?: string;
    fullName?: string;
    emailConfirmed?: boolean;
  };
  error?: string;
  message?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  title?: string;
  company?: string;
  location?: string;
  bio?: string;
  phone?: string;
  website?: string;
  avatar_url?: string;
  preferences?: {
    mentor: boolean;
    invest: boolean;
    discuss: boolean;
    collaborate: boolean;
    hire: boolean;
  };
  skills?: string[];
  interests?: string[];
  connections_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AuthUser extends User {
  profile?: UserProfile | null;
}

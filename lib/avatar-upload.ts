/**
 * Avatar upload utilities for Supabase storage
 */

import { createClient } from "@/lib/supabase/client";

export interface AvatarUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload avatar to Supabase storage
 */
export async function uploadAvatar(
  file: File,
  userId: string
): Promise<AvatarUploadResult> {
  try {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      return {
        success: false,
        error: "Please upload an image file",
      };
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: "File size must be less than 5MB",
      };
    }

    const supabase = createClient();

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false, // Don't overwrite, create new file
      });

    if (error) {
      console.error("Upload error:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(data.path);

    return {
      success: true,
      url: publicUrl,
    };
  } catch (error) {
    console.error("Avatar upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Delete previous avatar from storage
 */
export async function deleteAvatar(avatarUrl: string): Promise<boolean> {
  try {
    if (!avatarUrl || !avatarUrl.includes("/avatars/")) {
      return true; // No avatar to delete or not from our storage
    }

    const supabase = createClient();

    // Extract file path from URL
    const url = new URL(avatarUrl);
    const pathParts = url.pathname.split("/");

    // Find the avatars part and get everything after it
    const avatarsIndex = pathParts.findIndex((part) => part === "avatars");
    if (avatarsIndex === -1 || avatarsIndex === pathParts.length - 1) {
      return true; // No file to delete
    }

    // Get the filename (everything after /avatars/)
    const fileName = pathParts.slice(avatarsIndex + 1).join("/");

    if (!fileName) {
      return true; // No file to delete
    }

    console.log(`🗑️ Deleting avatar file: ${fileName}`);

    const { error } = await supabase.storage.from("avatars").remove([fileName]);

    if (error) {
      console.error("Delete avatar error:", error);
      return false;
    }

    console.log(`✅ Successfully deleted avatar: ${fileName}`);
    return true;
  } catch (error) {
    console.error("Error deleting avatar:", error);
    return false;
  }
}

/**
 * Get avatar URL or return placeholder
 */
export function getAvatarUrl(avatarUrl?: string | null, name?: string): string {
  if (avatarUrl) {
    return avatarUrl;
  }

  // Return placeholder with first letter of name
  const initial = name ? name.charAt(0).toUpperCase() : "U";
  return `https://via.placeholder.com/150x150/6366f1/white?text=${initial}`;
}

/**
 * Validate image file for avatar upload
 */
export function validateAvatarFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file type
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "Please upload an image file" };
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: "File size must be less than 5MB" };
  }

  // Check image dimensions (optional - can be added if needed)
  // We could add image dimension validation here

  return { valid: true };
}

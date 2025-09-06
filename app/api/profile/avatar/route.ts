import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteAvatar } from "@/lib/avatar-upload";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;

    // Validate input
    if (!file || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing file or user ID" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Please upload an image file" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if user exists and get their current avatar
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, avatar_url")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const uniqueFileName = `${userId}-${Date.now()}.${fileExt}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(uniqueFileName, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { success: false, error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(uploadData.path);

    // Delete previous avatar BEFORE updating database
    if (userData.avatar_url && userData.avatar_url.includes("/avatars/")) {
      const deleteSuccess = await deleteAvatar(userData.avatar_url);
      if (!deleteSuccess) {
        console.warn("Failed to delete old avatar:", userData.avatar_url);
        // Continue anyway - don't fail the upload for cleanup issues
      }
    }

    // Update user's avatar_url in the database
    const { data: updateData, error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id, name, avatar_url")
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      // Try to delete the uploaded file since database update failed
      await supabase.storage.from("avatars").remove([uploadData.path]);
      return NextResponse.json(
        { success: false, error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      avatarUrl: publicUrl,
      user: updateData,
    });
  } catch (error) {
    console.error("Avatar upload API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

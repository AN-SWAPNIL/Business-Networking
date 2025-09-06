import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("⏰ Cron job triggered: Profile Intelligence Generation");

    // Call the scheduled intelligence endpoint
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";
    const scheduledUrl = `${baseUrl}/api/admin/scheduled-intelligence`;

    const response = await fetch(scheduledUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add any authentication headers if needed
      },
    });

    if (!response.ok) {
      throw new Error(`Scheduled intelligence API returned ${response.status}`);
    }

    const result = await response.json();

    console.log("✅ Cron job completed successfully");
    console.log("📊 Results:", result.stats);

    return NextResponse.json({
      success: true,
      message: "Cron job completed successfully",
      timestamp: new Date().toISOString(),
      results: result,
    });
  } catch (error) {
    console.error("❌ Cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Cron job failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}

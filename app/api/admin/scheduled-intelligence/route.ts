import { NextRequest, NextResponse } from "next/server";
import { ScheduledIntelligenceService } from "@/services/scheduled-intelligence";

export async function POST(request: NextRequest) {
  try {
    console.log("🤖 Starting scheduled profile intelligence generation...");

    const scheduledService = new ScheduledIntelligenceService();
    const result = await scheduledService.runScheduledGeneration(10); // Process 10 users at a time

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to run scheduled generation",
          stats: result.stats,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Scheduled profile intelligence generation completed",
      stats: result.stats,
      results: result.results,
    });
  } catch (error) {
    console.error("❌ Scheduled intelligence generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check the status and see how many users need processing
export async function GET(request: NextRequest) {
  try {
    const scheduledService = new ScheduledIntelligenceService();
    const statsResult = await scheduledService.getStats();

    if (!statsResult.success) {
      return NextResponse.json(
        { success: false, error: statsResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stats: statsResult.stats,
      lastChecked: new Date().toISOString(),
      endpoints: {
        "POST /api/admin/scheduled-intelligence":
          "Run scheduled profile intelligence generation",
        "GET /api/admin/scheduled-intelligence":
          "Check how many users need intelligence generation",
        "GET /api/cron/profile-intelligence":
          "Automated hourly cron job endpoint",
      },
    });
  } catch (error) {
    console.error("Scheduled intelligence status error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

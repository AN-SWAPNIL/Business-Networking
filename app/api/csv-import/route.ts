import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CSVImportService } from "@/services/csv-import";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user and verify admin permissions
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // User is already authenticated and admin role checked in middleware

    console.log(`🔐 CSV import requested by user: ${user.id}`);

    const body = await request.json();
    const { csvContent, stopOnError = false } = body;

    if (!csvContent || typeof csvContent !== "string") {
      return NextResponse.json(
        { error: "CSV content is required" },
        { status: 400 }
      );
    }

    console.log(`📄 Received CSV content (${csvContent.length} characters)`);
    console.log(`⚙️ Stop on error: ${stopOnError}`);

    // Initialize CSV import service
    const importService = new CSVImportService();

    // Process the CSV import
    const result = await importService.processCSVImport(
      csvContent,
      stopOnError
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `CSV import completed successfully`,
        summary: {
          processed: result.processed,
          created: result.created,
          errors: result.errors.length,
          stopped: result.stopped || false,
          totalRows: result.totalRows,
        },
        errors: result.errors,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.stopped
            ? "CSV import stopped early due to error"
            : "CSV import completed with errors",
          summary: {
            processed: result.processed,
            created: result.created,
            errors: result.errors.length,
            stopped: result.stopped || false,
            totalRows: result.totalRows,
          },
          errors: result.errors,
        },
        { status: 207 }
      ); // 207 Multi-Status for partial success
    }
  } catch (error) {
    console.error("Error in CSV import API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get import statistics
    const { data: totalUsers, error: countError } = await supabase
      .from("users")
      .select("id", { count: "exact" });

    if (countError) {
      console.error("Error getting user count:", countError);
      return NextResponse.json(
        { error: "Failed to get statistics" },
        { status: 500 }
      );
    }

    // Get users created in the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: recentUsers, error: recentError } = await supabase
      .from("users")
      .select("id", { count: "exact" })
      .gte("created_at", yesterday.toISOString());

    if (recentError) {
      console.error("Error getting recent users:", recentError);
    }

    return NextResponse.json({
      success: true,
      statistics: {
        totalUsers: totalUsers?.length || 0,
        recentUsers: recentUsers?.length || 0,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error getting CSV import statistics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

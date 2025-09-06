/**
 * Scheduled Profile Intelligence Service
 * Handles automatic generation of profile intelligence for users who don't have it
 */

import { createClient } from "@/lib/supabase/server";
import { ProfileIntelligenceService } from "@/services/profile-intelligence";

export interface ScheduledIntelligenceStats {
  totalEligibleUsers: number;
  usersWithIntelligence: number;
  usersNeedingIntelligence: number;
  processed: number;
  succeeded: number;
  failed: number;
}

export interface ProcessingResult {
  userId: string;
  name: string;
  success: boolean;
  error?: string;
}

export class ScheduledIntelligenceService {
  private intelligenceService: ProfileIntelligenceService;

  constructor() {
    this.intelligenceService = new ProfileIntelligenceService();
  }

  /**
   * Get users who need profile intelligence generation
   */
  async getUsersNeedingIntelligence(limit: number = 10): Promise<{
    success: boolean;
    users?: any[];
    stats?: Partial<ScheduledIntelligenceStats>;
    error?: string;
  }> {
    try {
      const supabase = await createClient();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      // Get users who are eligible for profile intelligence
      const { data: eligibleUsers, error: usersError } = await supabase
        .from("users")
        .select(
          "id, name, title, company, location, bio, website, skills, interests, preferences, created_at"
        )
        .lt("created_at", fiveMinutesAgo)
        .not("name", "is", null)
        .or("title.neq.null,company.neq.null")
        .order("created_at", { ascending: true })
        .limit(limit);

      if (usersError) {
        return { success: false, error: usersError.message };
      }

      if (!eligibleUsers || eligibleUsers.length === 0) {
        return {
          success: true,
          users: [],
          stats: {
            totalEligibleUsers: 0,
            usersNeedingIntelligence: 0,
          },
        };
      }

      // Check which users already have profile intelligence
      const userIds = eligibleUsers.map((user) => user.id);
      const { data: existingIntelligence } = await supabase
        .from("documents")
        .select("user_id")
        .in("user_id", userIds)
        .eq("metadata->>type", "profile_intelligence");

      const existingUserIds = new Set(
        existingIntelligence?.map((doc) => doc.user_id) || []
      );
      const usersNeedingIntelligence = eligibleUsers.filter(
        (user) => !existingUserIds.has(user.id)
      );

      return {
        success: true,
        users: usersNeedingIntelligence,
        stats: {
          totalEligibleUsers: eligibleUsers.length,
          usersWithIntelligence: existingUserIds.size,
          usersNeedingIntelligence: usersNeedingIntelligence.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Process profile intelligence for a batch of users
   */
  async processBatch(
    users: any[],
    delayBetweenUsers: number = 2000
  ): Promise<{
    success: boolean;
    stats: ScheduledIntelligenceStats;
    results: ProcessingResult[];
    error?: string;
  }> {
    try {
      const results: ProcessingResult[] = [];
      let processed = 0;
      let succeeded = 0;
      let failed = 0;

      console.log(
        `🎯 Processing batch of ${users.length} users for profile intelligence`
      );

      for (const user of users) {
        try {
          console.log(
            `🧠 Generating intelligence for: ${user.name} (${user.id})`
          );

          const result =
            await this.intelligenceService.processProfileIntelligence(user);

          if (result.success) {
            succeeded++;
            console.log(
              `✅ Successfully generated intelligence for ${user.name}`
            );
            results.push({
              userId: user.id,
              name: user.name,
              success: true,
            });
          } else {
            failed++;
            console.error(
              `❌ Failed to generate intelligence for ${user.name}:`,
              result.error
            );
            results.push({
              userId: user.id,
              name: user.name,
              success: false,
              error: result.error,
            });
          }

          processed++;

          // Add delay between processing to avoid rate limits
          if (delayBetweenUsers > 0 && processed < users.length) {
            await new Promise((resolve) =>
              setTimeout(resolve, delayBetweenUsers)
            );
          }
        } catch (error) {
          failed++;
          console.error(`❌ Error processing ${user.name}:`, error);
          results.push({
            userId: user.id,
            name: user.name,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          processed++;
        }
      }

      return {
        success: true,
        stats: {
          totalEligibleUsers: users.length,
          usersWithIntelligence: 0, // Will be updated by caller
          usersNeedingIntelligence: users.length,
          processed,
          succeeded,
          failed,
        },
        results,
      };
    } catch (error) {
      return {
        success: false,
        stats: {
          totalEligibleUsers: users.length,
          usersWithIntelligence: 0,
          usersNeedingIntelligence: users.length,
          processed: 0,
          succeeded: 0,
          failed: users.length,
        },
        results: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get overall statistics about profile intelligence coverage
   */
  async getStats(): Promise<{
    success: boolean;
    stats?: ScheduledIntelligenceStats;
    error?: string;
  }> {
    try {
      const supabase = await createClient();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      // Count total eligible users
      const { count: totalEligibleUsers } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .lt("created_at", fiveMinutesAgo)
        .not("name", "is", null)
        .or("title.neq.null,company.neq.null");

      // Count users with profile intelligence
      const { count: usersWithIntelligence } = await supabase
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("metadata->>type", "profile_intelligence");

      const needingIntelligence = Math.max(
        0,
        (totalEligibleUsers || 0) - (usersWithIntelligence || 0)
      );

      return {
        success: true,
        stats: {
          totalEligibleUsers: totalEligibleUsers || 0,
          usersWithIntelligence: usersWithIntelligence || 0,
          usersNeedingIntelligence: needingIntelligence,
          processed: 0,
          succeeded: 0,
          failed: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Run the complete scheduled intelligence generation process
   */
  async runScheduledGeneration(batchSize: number = 10): Promise<{
    success: boolean;
    stats: ScheduledIntelligenceStats;
    results: ProcessingResult[];
    error?: string;
  }> {
    try {
      console.log("🤖 Starting scheduled profile intelligence generation...");

      // Get users needing intelligence
      const usersResult = await this.getUsersNeedingIntelligence(batchSize);

      if (!usersResult.success) {
        return {
          success: false,
          stats: {
            totalEligibleUsers: 0,
            usersWithIntelligence: 0,
            usersNeedingIntelligence: 0,
            processed: 0,
            succeeded: 0,
            failed: 0,
          },
          results: [],
          error: usersResult.error,
        };
      }

      if (!usersResult.users || usersResult.users.length === 0) {
        console.log(
          "✅ No users found requiring profile intelligence generation"
        );
        return {
          success: true,
          stats: {
            totalEligibleUsers: usersResult.stats?.totalEligibleUsers || 0,
            usersWithIntelligence:
              usersResult.stats?.usersWithIntelligence || 0,
            usersNeedingIntelligence: 0,
            processed: 0,
            succeeded: 0,
            failed: 0,
          },
          results: [],
        };
      }

      // Process the batch
      const batchResult = await this.processBatch(usersResult.users);

      console.log(`🏁 Scheduled intelligence generation completed:`);
      console.log(`   📊 Total processed: ${batchResult.stats.processed}`);
      console.log(`   ✅ Succeeded: ${batchResult.stats.succeeded}`);
      console.log(`   ❌ Failed: ${batchResult.stats.failed}`);

      return {
        success: batchResult.success,
        stats: {
          ...batchResult.stats,
          totalEligibleUsers: usersResult.stats?.totalEligibleUsers || 0,
          usersWithIntelligence: usersResult.stats?.usersWithIntelligence || 0,
        },
        results: batchResult.results,
        error: batchResult.error,
      };
    } catch (error) {
      console.error("❌ Scheduled intelligence generation error:", error);
      return {
        success: false,
        stats: {
          totalEligibleUsers: 0,
          usersWithIntelligence: 0,
          usersNeedingIntelligence: 0,
          processed: 0,
          succeeded: 0,
          failed: 0,
        },
        results: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

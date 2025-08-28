import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createClient } from "@supabase/supabase-js";
import { ProfileIntelligenceService } from "./profile-intelligence";
import { z } from "zod";

// CSV Row Schema
const CSVRowSchema = z.object({
  Name: z.string().min(1, "Name is required"),
  "BUET Department (e.g., CE, EEE, ME, URP, etc)": z.string().default(""),
  "BUET Student ID (e.g., 1706065, 0204023 etc)": z.string().default(""),
  Email: z.string().email("Valid email is required"),
  "Phone Number": z.string().default(""),
  "Current Company Name": z.string().min(1, "Company name is required"),
  "Current Job Title/Position ": z.string().min(1, "Job title is required"),
  "Department/Function (e.g., Engineering, Sales, SCM, Project Management, etc.)":
    z.string().default(""),
  "Industry Type (e.g., Power, FMCG, Tech, Telco, Consultancy, etc.)  ": z
    .string()
    .default(""),
  "Current Job Location (e.g., Dhaka, Rangpur, Chittagong, etc.)": z
    .string()
    .default(""),
  "Are you open to being contacted for help/referrals? (Yes / No)  ": z
    .string()
    .default("No"),
  "Any suggestions or ideas to improve this initiative? ": z
    .string()
    .default(""),
});

// AI Generated Profile Schema
const AIProfileSchema = z.object({
  bio: z.string(),
  preferences: z.object({
    mentor: z.boolean(),
    invest: z.boolean(),
    discuss: z.boolean(),
    collaborate: z.boolean(),
    hire: z.boolean(),
  }),
});

export type CSVRow = z.infer<typeof CSVRowSchema>;
export type AIProfile = z.infer<typeof AIProfileSchema>;

export class CSVImportService {
  private llm: ChatGoogleGenerativeAI;
  private supabaseAdmin: any;

  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY environment variable is required");
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      throw new Error("Supabase environment variables are required");
    }

    this.llm = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.7, // Higher temperature for more creative bio generation
    });

    this.supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Parse CSV content into structured data
   */
  parseCsvData(csvContent: string): CSVRow[] {
    const lines = csvContent.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("CSV must have at least a header row and one data row");
    }

    const headers = this.parseCSVLine(lines[0]);
    console.log("📋 CSV Headers:", headers);

    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i]);

        if (values.length !== headers.length) {
          console.warn(
            `Skipping row ${i} - column count mismatch. Expected ${headers.length}, got ${values.length}`
          );
          continue;
        }

        const row: any = {};
        headers.forEach((header, index) => {
          row[header.trim()] = (values[index] || "").trim();
        });

        // Validate required fields before parsing
        if (!row["Name"] || !row["Email"] || !row["Current Company Name"]) {
          console.warn(
            `Skipping row ${i} - missing required fields (Name, Email, or Company)`
          );
          continue;
        }

        const validatedRow = CSVRowSchema.parse(row);
        rows.push(validatedRow);
        console.log(`✅ Parsed row ${i}: ${validatedRow.Name}`);
      } catch (error) {
        console.warn(
          `❌ Skipping invalid row ${i}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    console.log(
      `📊 Successfully parsed ${rows.length} valid rows from ${
        lines.length - 1
      } total rows`
    );
    return rows;
  }

  /**
   * Parse a single CSV line handling commas within quotes
   */
  private parseCSVLine(line: string): string[] {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result.map((value) => value.replace(/^"|"$/g, "")); // Remove surrounding quotes
  }

  /**
   * Generate AI bio and preferences for a user
   */
  async generateAIProfile(csvRow: CSVRow): Promise<AIProfile> {
    const systemPrompt = new SystemMessage({
      content: `You are a professional profile generator for a business networking platform. 
Your task is to create a compelling professional bio and determine networking preferences based on the provided information.

INSTRUCTIONS:
1. Create a professional bio (100-200 words) that highlights:
   - Professional background and expertise
   - Current role and company
   - Industry experience
   - Key skills and achievements
   - Professional interests

2. Determine networking preferences based on role, industry, and seniority:
   - mentor: true if senior position (Manager+, Director, VP, etc.) or experienced professional
   - invest: true if in finance, investment, business development, or senior leadership roles
   - discuss: always true for knowledge sharing
   - collaborate: true if in engineering, tech, consulting, or project-based roles
   - hire: true if in management, HR, or senior positions

3. Return ONLY a valid JSON object with this exact structure:
{
  "bio": "Professional bio text here...",
  "preferences": {
    "mentor": boolean,
    "invest": boolean,
    "discuss": boolean,
    "collaborate": boolean,
    "hire": boolean
  }
}

Make the bio engaging, professional, and tailored to the person's background.`,
    });

    const humanPrompt = new HumanMessage({
      content: `Generate a professional profile for:

Name: ${csvRow.Name}
Department: ${csvRow["BUET Department (e.g., CE, EEE, ME, URP, etc)"]}
Company: ${csvRow["Current Company Name"]}
Title: ${csvRow["Current Job Title/Position "]}
Function: ${csvRow["Department/Function (e.g., Engineering, Sales, SCM, Project Management, etc.)"]}
Industry: ${csvRow["Industry Type (e.g., Power, FMCG, Tech, Telco, Consultancy, etc.)  "]}
Location: ${csvRow["Current Job Location (e.g., Dhaka, Rangpur, Chittagong, etc.)"]}
Open to help: ${csvRow["Are you open to being contacted for help/referrals? (Yes / No)  "]}
Student ID: ${csvRow["BUET Student ID (e.g., 1706065, 0204023 etc)"]}

Please generate a professional bio and preferences based on this information.`,
    });

    try {
      const response = await this.llm.invoke([systemPrompt, humanPrompt]);
      const responseText = response.content as string;

      // Extract JSON from response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonMatch[0] = jsonMatch[1];
        }
      }

      if (!jsonMatch) {
        throw new Error("No valid JSON found in AI response");
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      return AIProfileSchema.parse(parsedData);
    } catch (error) {
      console.error("Error generating AI profile:", error);

      // Fallback profile
      return {
        bio: `${csvRow.Name} is a ${csvRow["Current Job Title/Position "]} at ${
          csvRow["Current Company Name"]
        }, specializing in ${
          csvRow[
            "Department/Function (e.g., Engineering, Sales, SCM, Project Management, etc.)"
          ]
        } within the ${
          csvRow[
            "Industry Type (e.g., Power, FMCG, Tech, Telco, Consultancy, etc.)  "
          ]
        } industry. Based in ${
          csvRow[
            "Current Job Location (e.g., Dhaka, Rangpur, Chittagong, etc.)"
          ]
        }, they bring expertise from their ${
          csvRow["BUET Department (e.g., CE, EEE, ME, URP, etc)"]
        } background at BUET. ${
          csvRow[
            "Are you open to being contacted for help/referrals? (Yes / No)  "
          ] === "Yes"
            ? "They are open to helping others through networking and professional connections."
            : ""
        }`,
        preferences: {
          mentor:
            csvRow["Current Job Title/Position "]
              .toLowerCase()
              .includes("manager") ||
            csvRow["Current Job Title/Position "]
              .toLowerCase()
              .includes("director") ||
            csvRow["Current Job Title/Position "]
              .toLowerCase()
              .includes("head") ||
            csvRow["Current Job Title/Position "]
              .toLowerCase()
              .includes("lead"),
          invest:
            csvRow[
              "Department/Function (e.g., Engineering, Sales, SCM, Project Management, etc.)"
            ]
              .toLowerCase()
              .includes("business") ||
            csvRow[
              "Industry Type (e.g., Power, FMCG, Tech, Telco, Consultancy, etc.)  "
            ]
              .toLowerCase()
              .includes("financial"),
          discuss: true,
          collaborate:
            csvRow[
              "Department/Function (e.g., Engineering, Sales, SCM, Project Management, etc.)"
            ]
              .toLowerCase()
              .includes("engineering") ||
            csvRow[
              "Department/Function (e.g., Engineering, Sales, SCM, Project Management, etc.)"
            ]
              .toLowerCase()
              .includes("project") ||
            csvRow[
              "Industry Type (e.g., Power, FMCG, Tech, Telco, Consultancy, etc.)  "
            ]
              .toLowerCase()
              .includes("tech"),
          hire:
            csvRow["Current Job Title/Position "]
              .toLowerCase()
              .includes("manager") ||
            csvRow["Current Job Title/Position "]
              .toLowerCase()
              .includes("director") ||
            csvRow["Current Job Title/Position "]
              .toLowerCase()
              .includes("head"),
        },
      };
    }
  }

  /**
   * Create anonymous user and profile in Supabase
   */
  async createUserProfile(
    csvRow: CSVRow,
    aiProfile: AIProfile
  ): Promise<{
    success: boolean;
    userId?: string;
    error?: string;
  }> {
    try {
      console.log(`🚀 Creating user profile for: ${csvRow.Name}`);

      // 1. Create anonymous user in auth.users
      const { data: authData, error: authError } =
        await this.supabaseAdmin.auth.admin.createUser({
          email: csvRow.Email,
          email_confirm: true, // Skip email verification for bulk import
          user_metadata: {
            full_name: csvRow.Name,
            name: csvRow.Name,
            title: csvRow["Current Job Title/Position "],
            company: csvRow["Current Company Name"],
            location:
              csvRow[
                "Current Job Location (e.g., Dhaka, Rangpur, Chittagong, etc.)"
              ],
            phone: csvRow["Phone Number"] || "",
            department: csvRow["BUET Department (e.g., CE, EEE, ME, URP, etc)"],
            student_id: csvRow["BUET Student ID (e.g., 1706065, 0204023 etc)"],
            industry:
              csvRow[
                "Industry Type (e.g., Power, FMCG, Tech, Telco, Consultancy, etc.)  "
              ],
            function:
              csvRow[
                "Department/Function (e.g., Engineering, Sales, SCM, Project Management, etc.)"
              ],
          },
        });

      if (authError) {
        console.error("Auth user creation failed:", authError);
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: "No user returned from auth creation" };
      }

      console.log(`✅ Created auth user: ${authData.user.id}`);

      // 2. Wait a moment for trigger to potentially fire
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 3. Update or insert user profile in public.users
      const userProfileData = {
        id: authData.user.id,
        email: csvRow.Email,
        name: csvRow.Name,
        title: csvRow["Current Job Title/Position "],
        company: csvRow["Current Company Name"],
        location:
          csvRow[
            "Current Job Location (e.g., Dhaka, Rangpur, Chittagong, etc.)"
          ],
        bio: aiProfile.bio,
        phone: csvRow["Phone Number"] || null,
        website: null,
        avatar_url: null,
        preferences: aiProfile.preferences,
        skills: [], // Can be enhanced later
        interests: [], // Can be enhanced later
        stats: {
          connections: 0,
          collaborations: 0,
          mentorships: 0,
          investments: 0,
          discussions: 0,
          monitored: 0,
          hired: 0,
        },
        settings: {
          notifications: {
            email: true,
            push: false,
            connections: true,
            messages: true,
            collaborations: true,
            mentions: false,
          },
          privacy: {
            profileVisibility: "public",
            showEmail: false,
            showPhone: false,
            allowMessages: true,
          },
        },
      };

      // Try to update first (in case trigger created the record)
      const { data: updateData, error: updateError } = await this.supabaseAdmin
        .from("users")
        .update(userProfileData)
        .eq("id", authData.user.id)
        .select();

      if (updateError || !updateData || updateData.length === 0) {
        // If update failed, try insert
        const { data: insertData, error: insertError } =
          await this.supabaseAdmin
            .from("users")
            .insert(userProfileData)
            .select();

        if (insertError) {
          console.error("User profile insert failed:", insertError);
          // Clean up auth user if profile creation failed
          await this.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          return { success: false, error: insertError.message };
        }

        console.log(`✅ Inserted user profile: ${authData.user.id}`);
      } else {
        console.log(`✅ Updated user profile: ${authData.user.id}`);
      }

      return { success: true, userId: authData.user.id };
    } catch (error) {
      console.error("Error creating user profile:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Trigger profile intelligence directly (like in callback route)
   */
  async triggerProfileIntelligence(
    userId: string,
    csvRow: CSVRow,
    aiProfile: AIProfile
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log(`🧠 Starting profile intelligence for ${csvRow.Name}`);

      // Get the user profile data
      const { data: userProfile, error: profileError } =
        await this.supabaseAdmin
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

      if (profileError || !userProfile) {
        console.error(
          "Failed to fetch user profile for intelligence:",
          profileError
        );
        return { success: false, error: "Failed to fetch user profile" };
      }

      // Check if we have enough information to process
      if (!userProfile.name || (!userProfile.company && !userProfile.title)) {
        console.warn("Insufficient profile information for intelligence");
        return { success: false, error: "Insufficient profile information" };
      }

      // Initialize profile intelligence service
      const intelligenceService = new ProfileIntelligenceService();

      // Process profile intelligence
      const result = await intelligenceService.processProfileIntelligence(
        userProfile
      );

      if (result.success) {
        console.log(`✅ Profile intelligence completed for ${csvRow.Name}`);
        return { success: true };
      } else {
        console.error(
          `❌ Profile intelligence failed for ${csvRow.Name}:`,
          result.error
        );
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error in profile intelligence:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Process entire CSV import
   */
  async processCSVImport(csvContent: string): Promise<{
    success: boolean;
    processed: number;
    created: number;
    errors: Array<{ row: number; name: string; error: string }>;
  }> {
    console.log("🚀 Starting CSV import process...");

    const rows = this.parseCsvData(csvContent);
    console.log(`📊 Parsed ${rows.length} rows from CSV`);

    let processed = 0;
    let created = 0;
    const errors: Array<{ row: number; name: string; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      processed++;

      try {
        console.log(`\n🔄 Processing row ${i + 1}/${rows.length}: ${row.Name}`);

        // Check if user already exists
        const { data: existingUser } = await this.supabaseAdmin
          .from("users")
          .select("id")
          .eq("email", row.Email)
          .single();

        if (existingUser) {
          console.log(`⚠️ User ${row.Name} already exists, skipping...`);
          continue;
        }

        // Generate AI profile
        console.log(`🤖 Generating AI profile for ${row.Name}...`);
        const aiProfile = await this.generateAIProfile(row);

        // Create user profile
        console.log(`👤 Creating user profile for ${row.Name}...`);
        const createResult = await this.createUserProfile(row, aiProfile);

        if (!createResult.success) {
          errors.push({
            row: i + 1,
            name: row.Name,
            error: createResult.error || "User creation failed",
          });
          continue;
        }

        created++;
        console.log(`✅ Successfully created profile for ${row.Name}`);

        // Trigger profile intelligence directly (like in callback route)
        if (createResult.userId) {
          console.log(`🧠 Triggering profile intelligence for ${row.Name}...`);
          const intelligenceResult = await this.triggerProfileIntelligence(
            createResult.userId,
            row,
            aiProfile
          );

          if (intelligenceResult.success) {
            console.log(`🎯 Profile intelligence completed for ${row.Name}`);
          } else {
            console.warn(
              `⚠️ Profile intelligence failed for ${row.Name}: ${intelligenceResult.error}`
            );
            // Don't count this as an error since the user was created successfully
          }
        }

        // Add delay between requests to avoid rate limiting
        if (i < rows.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Error processing ${row.Name}:`, error);
        errors.push({
          row: i + 1,
          name: row.Name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log(`\n🎉 CSV import completed!`);
    console.log(
      `📊 Processed: ${processed}, Created: ${created}, Errors: ${errors.length}`
    );

    return {
      success: errors.length < rows.length,
      processed,
      created,
      errors,
    };
  }
}

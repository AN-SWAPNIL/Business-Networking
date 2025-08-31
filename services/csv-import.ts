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

// Basic CSV row type for any structure
export type CSVRow = Record<string, string>;

// AI Generated Complete Profile Schema
const AICompleteProfileSchema = z.object({
  // Basic profile info
  name: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  bio: z.string(),
  phone: z.string().nullable(),
  website: z.string().nullable(),

  // Skills and interests
  skills: z.array(z.string()).min(1).max(10),
  interests: z.array(z.string()).min(1).max(10),

  // Networking preferences
  preferences: z.object({
    mentor: z.boolean(),
    invest: z.boolean(),
    discuss: z.boolean(),
    collaborate: z.boolean(),
    hire: z.boolean(),
  }),
});

export type AICompleteProfile = z.infer<typeof AICompleteProfileSchema>;
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
   * Parse CSV content into structured data - handles newlines within quoted fields
   */
  parseCsvData(csvContent: string): { rows: CSVRow[]; headers: string[] } {
    const lines = this.parseCSVRows(csvContent);
    if (lines.length < 2) {
      throw new Error("CSV must have at least a header row and one data row");
    }

    const headers = lines[0];
    console.log("📋 CSV Headers:", headers);

    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i];

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

        // Basic validation for required fields
        if (!row["Name"] && !row["name"]) {
          console.warn(`Skipping row ${i} - missing name field`);
          continue;
        }

        if (!row["Email"] && !row["email"]) {
          console.warn(`Skipping row ${i} - missing email field`);
          continue;
        }

        rows.push(row);
        console.log(`✅ Parsed row ${i}: ${row["Name"] || row["name"]}`);
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
    return { rows, headers };
  }

  /**
   * Parse CSV content into rows, properly handling newlines within quoted fields
   */
  private parseCSVRows(csvContent: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let inQuotes = false;
    let i = 0;

    while (i < csvContent.length) {
      const char = csvContent[i];
      const nextChar = csvContent[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote - add single quote to field
          currentField += '"';
          i += 2; // Skip both quotes
          continue;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        // End of field
        currentRow.push(currentField.trim());
        currentField = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        // End of row (handle both \n and \r\n)
        currentRow.push(currentField.trim());

        // Skip empty rows
        if (
          currentRow.length > 0 &&
          currentRow.some((field) => field.length > 0)
        ) {
          // Clean up the row - remove surrounding quotes from each field
          const cleanedRow = currentRow.map((field) => {
            // Remove surrounding quotes but preserve internal quotes
            if (field.startsWith('"') && field.endsWith('"')) {
              return field.slice(1, -1);
            }
            return field;
          });
          rows.push(cleanedRow);
        }

        currentRow = [];
        currentField = "";

        // Handle \r\n - skip the \n if we just processed \r
        if (char === "\r" && nextChar === "\n") {
          i += 2;
          continue;
        }
      } else {
        // Regular character - add to current field
        currentField += char;
      }

      i++;
    }

    // Handle last row if CSV doesn't end with newline
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((field) => field.length > 0)) {
        const cleanedRow = currentRow.map((field) => {
          if (field.startsWith('"') && field.endsWith('"')) {
            return field.slice(1, -1);
          }
          return field;
        });
        rows.push(cleanedRow);
      }
    }

    console.log(`📊 Parsed ${rows.length} total rows from CSV`);
    return rows;
  }

  /**
   * Generate complete AI profile for a user from CSV row data
   */
  async generateAIProfile(
    csvRow: CSVRow,
    csvHeaders: string[]
  ): Promise<AICompleteProfile> {
    const systemPrompt = new SystemMessage({
      content: `You are an AI assistant that creates comprehensive professional profiles for a business networking platform.

Given CSV data, you need to intelligently extract and generate a complete professional profile.

AVAILABLE CSV COLUMNS:
${csvHeaders.map((header, index) => `${index + 1}. ${header}`).join("\n")}

YOUR TASK:
1. Extract and clean the basic information (name, title, company, location)
2. Generate a compelling 150-200 word professional bio
3. Generate 3-5 relevant professional skills based on job title and industry
4. Generate 3-5 professional interests based on role and industry context
5. Intelligently determine networking preferences based on role and seniority
6. Format phone number properly if provided
7. Generate a professional website URL if appropriate (LinkedIn, company site, etc.)

SKILLS GENERATION:
- Generate 3-5 specific, relevant professional skills based on job title and industry
- For developers: "React", "Node.js", "TypeScript", "Python", "JavaScript"
- For product managers: "Product Strategy", "User Research", "Analytics", "Agile"
- For designers: "UI/UX Design", "Figma", "User Research", "Accessibility"
- For marketers: "Growth Marketing", "Brand Strategy", "Content Marketing", "Analytics"
- For executives: "Strategic Leadership", "Team Management", "Business Strategy"
- Make skills specific to their role and expertise level
- Avoid generic skills like "Hard Work" - focus on technical/professional competencies

INTERESTS GENERATION:
- Generate 3-5 professional interests that align with their career path
- For tech roles: "AI/ML", "Cloud Computing", "Open Source", "SaaS"
- For business roles: "B2B", "Growth", "Fintech", "Enterprise Software"
- For design roles: "Design Systems", "Accessibility", "EdTech"
- For leadership: "Leadership Development", "Industry Trends", "Strategic Planning"
- Focus on industry trends, professional development, and career-relevant topics
- Avoid personal hobbies - keep it professional and networking-focused

NETWORKING PREFERENCES LOGIC:
- mentor: true for senior roles (Manager+, Director, VP, Lead, Head, Senior)
- invest: true for finance, investment, business development, C-level roles
- discuss: always true (everyone discusses)
- collaborate: true for engineering, tech, consulting, project management roles
- hire: true for management, HR, leadership positions

Return ONLY a valid JSON object with this exact structure:
{
  "name": "string",
  "title": "string", 
  "company": "string",
  "location": "string",
  "bio": "string",
  "skills": ["skill1", "skill2", "skill3"],
  "interests": ["interest1", "interest2", "interest3"],
  "phone": "string or null",
  "website": "string or null",
  "preferences": {
    "mentor": boolean,
    "invest": boolean,
    "discuss": boolean,
    "collaborate": boolean,
    "hire": boolean
  }
}

IMPORTANT: 
- Use null (not undefined) for empty values
- skills and interests must be arrays with 3-5 items each
- Make skills and interests specific and professional
Example:
{
  "phone": null,
  "website": null,
  "skills": ["React", "TypeScript", "Node.js", "AWS"],
  "interests": ["AI/ML", "Cloud Computing", "SaaS"]
}`,
    });

    const humanPrompt = new HumanMessage({
      content: `Generate a complete professional profile from this CSV data:

${Object.entries(csvRow)
  .map(([key, value]) => `${key}: ${value || "N/A"}`)
  .join("\n")}

Please create a comprehensive profile with all fields filled intelligently based on this data.`,
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
      return AICompleteProfileSchema.parse(parsedData);
    } catch (error) {
      console.error("Error generating AI profile:", error);

      // Simple fallback profile with flexible field access
      const getName = () => csvRow["Name"] || csvRow["name"] || "Unknown User";
      const getTitle = () =>
        csvRow["Current Job Title/Position"] ||
        csvRow["Job Title"] ||
        csvRow["Position"] ||
        csvRow["title"] ||
        "Professional";
      const getCompany = () =>
        csvRow["Current Company Name"] ||
        csvRow["Company"] ||
        csvRow["company"] ||
        "Unknown Company";
      const getLocation = () =>
        csvRow[
          "Current Job Location (e.g., Dhaka, Rangpur, Chittagong, etc.)"
        ] ||
        csvRow["Location"] ||
        csvRow["location"] ||
        "Bangladesh";
      const getPhone = () =>
        csvRow["Phone Number"] || csvRow["Phone"] || csvRow["phone"] || null;
      return {
        name: getName(),
        title: getTitle(),
        company: getCompany(),
        location: getLocation(),
        phone: getPhone(),
        website: null,
        bio: `${getName()} is a ${getTitle()} at ${getCompany()}. Based in ${getLocation()}, they bring valuable professional experience to their role. They are focused on professional growth and networking within their industry.`,
        skills: this.generateDefaultSkills(getTitle(), getCompany()),
        interests: this.generateDefaultInterests(getTitle()),
        preferences: {
          mentor:
            getTitle().toLowerCase().includes("senior") ||
            getTitle().toLowerCase().includes("manager") ||
            getTitle().toLowerCase().includes("director") ||
            getTitle().toLowerCase().includes("lead"),
          invest: false,
          discuss: true,
          collaborate: true,
          hire:
            getTitle().toLowerCase().includes("manager") ||
            getTitle().toLowerCase().includes("director") ||
            getTitle().toLowerCase().includes("head"),
        },
      };
    }
  }

  /**
   * Create anonymous user and profile in Supabase
   */
  async createUserProfile(
    csvRow: CSVRow,
    aiProfile: AICompleteProfile
  ): Promise<{
    success: boolean;
    userId?: string;
    error?: string;
  }> {
    try {
      const getName = () => csvRow["Name"] || csvRow["name"] || "Unknown User";
      const getEmail = () => csvRow["Email"] || csvRow["email"] || "";

      console.log(`🚀 Creating user profile for: ${getName()}`);

      // 1. Create anonymous user in auth.users
      const { data: authData, error: authError } =
        await this.supabaseAdmin.auth.admin.createUser({
          email: getEmail(),
          email_confirm: true, // Skip email verification for bulk import
          user_metadata: {
            full_name: aiProfile.name,
            name: aiProfile.name,
            title: aiProfile.title || null,
            company: aiProfile.company || null,
            location: aiProfile.location || null,
            phone: aiProfile.phone || csvRow["Phone Number"] || null,
            website: aiProfile.website || null,
            skills: aiProfile.skills || [],
            interests: aiProfile.interests || [],
            department:
              csvRow["BUET Department (e.g., CE, EEE, ME, URP, etc)"] || null,
            student_id:
              csvRow["BUET Student ID (e.g., 1706065, 0204023 etc)"] || null,
            industry:
              csvRow[
                "Industry Type (e.g., Power, FMCG, Tech, Telco, Consultancy, etc.)  "
              ] || null,
            function:
              csvRow[
                "Department/Function (e.g., Engineering, Sales, SCM, Project Management, etc.)"
              ] || null,
            bio: aiProfile.bio || null,
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
        email: getEmail(),
        name: aiProfile.name,
        title: aiProfile.title || null,
        company: aiProfile.company || null,
        location: aiProfile.location || null,
        bio: aiProfile.bio || null,
        phone:
          aiProfile.phone ||
          csvRow["Phone Number"] ||
          csvRow["Phone"] ||
          csvRow["phone"] ||
          null,
        website: aiProfile.website || null,
        avatar_url: null,
        preferences: aiProfile.preferences || {
          mentor: false,
          invest: false,
          discuss: false,
          collaborate: false,
          hire: false,
        },
        skills: aiProfile.skills || [],
        interests: aiProfile.interests || [],
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
   * MANDATORY: Vector store must be created successfully, otherwise user will be deleted
   */
  async triggerProfileIntelligence(
    userId: string,
    csvRow: CSVRow,
    aiProfile: AICompleteProfile
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log(
        `🧠 Starting MANDATORY profile intelligence for ${
          csvRow.Name || csvRow.name
        }`
      );

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

      // Process profile intelligence - THIS MUST SUCCEED
      const result = await intelligenceService.processProfileIntelligence(
        userProfile
      );

      if (result.success) {
        console.log(
          `✅ Profile intelligence completed for ${csvRow.Name || csvRow.name}`
        );
        return { success: true };
      } else {
        console.error(
          `❌ Profile intelligence failed for ${csvRow.Name || csvRow.name}:`,
          result.error
        );
        return {
          success: false,
          error: result.error || "Profile intelligence processing failed",
        };
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
   * Clean up user if any step fails (delete from both auth and users table)
   */
  async cleanupUser(userId: string, userName: string): Promise<void> {
    try {
      console.log(
        `🗑️ Cleaning up user ${userName} (${userId}) due to failure...`
      );

      // Delete from users table first
      const { error: usersError } = await this.supabaseAdmin
        .from("users")
        .delete()
        .eq("id", userId);

      if (usersError) {
        console.error("Error deleting from users table:", usersError);
      }

      // Delete from auth.users
      const { error: authError } =
        await this.supabaseAdmin.auth.admin.deleteUser(userId);

      if (authError) {
        console.error("Error deleting from auth:", authError);
      }

      console.log(`✅ Successfully cleaned up user ${userName}`);
    } catch (error) {
      console.error(`❌ Error cleaning up user ${userName}:`, error);
    }
  }

  /**
   * Process entire CSV import
   */
  async processCSVImport(
    csvContent: string,
    stopOnError: boolean = false
  ): Promise<{
    success: boolean;
    processed: number;
    created: number;
    errors: Array<{ row: number; name: string; error: string }>;
    stopped?: boolean;
    totalRows: number;
  }> {
    console.log("🚀 Starting CSV import process...");

    const { rows, headers } = this.parseCsvData(csvContent);
    console.log(`📊 Parsed ${rows.length} rows from CSV`);

    let processed = 0;
    let created = 0;
    let stopped = false;
    const errors: Array<{ row: number; name: string; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      processed++;

      try {
        const rowName = row["Name"] || row["name"] || "Unknown User";
        const rowEmail = row["Email"] || row["email"] || "";

        console.log(`\n🔄 Processing row ${i + 1}/${rows.length}: ${rowName}`);

        // Check if user already exists
        const { data: existingUser } = await this.supabaseAdmin
          .from("users")
          .select("id")
          .eq("email", rowEmail)
          .single();

        if (existingUser) {
          console.log(`⚠️ User ${rowName} already exists, skipping...`);
          continue;
        }

        // Step 1: Generate AI profile
        console.log(`🤖 Generating AI profile for ${rowName}...`);
        const aiProfile = await this.generateAIProfile(row, headers);

        // Step 2: Create user profile
        console.log(`👤 Creating user profile for ${rowName}...`);
        const createResult = await this.createUserProfile(row, aiProfile);

        if (!createResult.success) {
          const errorMsg = createResult.error || "User creation failed";
          errors.push({
            row: i + 1,
            name: rowName,
            error: errorMsg,
          });
          console.log(`❌ Failed to create user ${rowName}: ${errorMsg}`);

          if (stopOnError) {
            console.log(
              "🛑 Stopping CSV import due to error (stopOnError=true)"
            );
            stopped = true;
            break;
          }
          continue;
        }

        const userId = createResult.userId!;
        console.log(`✅ Successfully created profile for ${rowName}`);

        // Step 3: MANDATORY Profile Intelligence with Vector Store
        console.log(
          `🧠 Processing MANDATORY profile intelligence for ${rowName}...`
        );
        const intelligenceResult = await this.triggerProfileIntelligence(
          userId,
          row,
          aiProfile
        );

        if (!intelligenceResult.success) {
          // CRITICAL: Vector store creation failed - DELETE THE USER
          console.error(
            `🚨 Vector store creation failed for ${rowName}. Deleting user...`
          );
          await this.cleanupUser(userId, rowName);

          const errorMsg = `Vector store creation failed: ${intelligenceResult.error}. User was deleted.`;
          errors.push({
            row: i + 1,
            name: rowName,
            error: errorMsg,
          });
          console.log(`❌ Deleted user ${rowName} due to vector store failure`);

          if (stopOnError) {
            console.log(
              "🛑 Stopping CSV import due to vector store failure (stopOnError=true)"
            );
            stopped = true;
            break;
          }
          continue;
        }

        // SUCCESS: User created and vector store added
        created++;
        console.log(
          `🎯 SUCCESS: User ${rowName} created with vector store intelligence`
        );

        // Add delay between requests to avoid rate limiting
        if (i < rows.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        const rowName = row["Name"] || row["name"] || "Unknown User";
        console.error(`❌ Unexpected error processing ${rowName}:`, error);

        // If we have a userId from partial creation, clean it up
        try {
          const rowEmail = row["Email"] || row["email"] || "";
          const { data: partialUser } = await this.supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", rowEmail)
            .single();

          if (partialUser) {
            await this.cleanupUser(partialUser.id, rowName);
            console.log(`🗑️ Cleaned up partially created user ${rowName}`);
          }
        } catch (cleanupError) {
          console.error(
            `Failed to cleanup partial user ${rowName}:`,
            cleanupError
          );
        }

        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({
          row: i + 1,
          name: rowName,
          error: errorMsg,
        });

        if (stopOnError) {
          console.log(
            "🛑 Stopping CSV import due to unexpected error (stopOnError=true)"
          );
          stopped = true;
          break;
        }
      }
    }

    console.log(
      `\n🎉 CSV import completed with STRICT vector store enforcement!`
    );
    console.log(
      `📊 Processed: ${processed}, Successfully Created: ${created}, Failed/Deleted: ${errors.length}`
    );
    console.log(
      `🔍 All created users have verified vector store embeddings for intelligent matching`
    );

    return {
      success: errors.length === 0 && !stopped, // Only success if NO errors occurred AND not stopped early
      processed,
      created,
      errors,
      stopped,
      totalRows: rows.length,
    };
  }

  // Generate default skills based on job title and company
  private generateDefaultSkills(title: string, company: string): string[] {
    const skillsMap: Record<string, string[]> = {
      engineer: ["React", "Node.js", "TypeScript", "AWS"],
      developer: ["JavaScript", "React", "Python", "SQL"],
      "software engineer": ["React", "Node.js", "TypeScript", "AWS"],
      "full stack": ["JavaScript", "React", "Python", "SQL"],
      frontend: ["React", "TypeScript", "CSS", "JavaScript"],
      backend: ["Node.js", "Python", "SQL", "AWS"],
      designer: ["UI/UX Design", "Figma", "User Research", "Accessibility"],
      "ux designer": [
        "UI/UX Design",
        "Figma",
        "User Research",
        "Accessibility",
      ],
      "product manager": [
        "Product Strategy",
        "User Research",
        "Analytics",
        "Agile",
      ],
      manager: [
        "Leadership",
        "Project Management",
        "Strategic Planning",
        "Team Building",
      ],
      director: [
        "Strategic Leadership",
        "Team Management",
        "Business Strategy",
        "Executive Leadership",
      ],
      marketing: [
        "Growth Marketing",
        "Brand Strategy",
        "Content Marketing",
        "Analytics",
      ],
      "marketing director": [
        "Growth Marketing",
        "Brand Strategy",
        "Content Marketing",
        "Analytics",
      ],
      analyst: ["Data Analysis", "Research", "Analytics", "SQL"],
      consultant: [
        "Business Analysis",
        "Strategy",
        "Client Relations",
        "Consulting",
      ],
      sales: ["Sales Strategy", "Client Development", "Negotiation", "CRM"],
      "venture capital": [
        "Investment Analysis",
        "Due Diligence",
        "Strategy",
        "Networking",
      ],
      investor: [
        "Investment Analysis",
        "Due Diligence",
        "Strategy",
        "Networking",
      ],
      cto: [
        "Engineering Leadership",
        "System Architecture",
        "Team Building",
        "Strategy",
      ],
      "chief technology": [
        "Engineering Leadership",
        "System Architecture",
        "Team Building",
        "Strategy",
      ],
      finance: [
        "Financial Analysis",
        "Risk Management",
        "Investment Strategy",
        "Excel",
      ],
      hr: [
        "Human Resources",
        "Talent Management",
        "Recruitment",
        "Employee Relations",
      ],
      operations: [
        "Operations Management",
        "Process Optimization",
        "Logistics",
        "Supply Chain",
      ],
    };

    const titleLower = title.toLowerCase();

    for (const [key, skills] of Object.entries(skillsMap)) {
      if (titleLower.includes(key)) {
        return skills;
      }
    }

    // Default skills for any professional
    return ["Leadership", "Communication", "Strategic Planning"];
  }

  // Generate default interests based on job title
  private generateDefaultInterests(title: string): string[] {
    const interestsMap: Record<string, string[]> = {
      engineer: ["AI/ML", "Cloud Computing", "Open Source"],
      developer: ["Web Development", "AI/ML", "Open Source"],
      "software engineer": [
        "AI/ML",
        "Cloud Computing",
        "Software Architecture",
      ],
      "full stack": ["Web Development", "AI/ML", "Open Source"],
      frontend: ["Web Development", "UI/UX", "JavaScript Frameworks"],
      backend: ["Cloud Computing", "System Design", "APIs"],
      designer: ["Design Systems", "Accessibility", "EdTech"],
      "ux designer": ["Design Systems", "Accessibility", "User Experience"],
      "product manager": ["SaaS", "B2B", "Growth"],
      manager: ["Leadership Development", "Team Building", "Business Growth"],
      director: [
        "Strategic Planning",
        "Industry Trends",
        "Executive Leadership",
      ],
      marketing: ["B2B Marketing", "SaaS", "Growth"],
      "marketing director": ["B2B Marketing", "SaaS", "Growth"],
      analyst: ["Data Science", "Analytics", "Business Intelligence"],
      consultant: [
        "Business Strategy",
        "Industry Analysis",
        "Digital Transformation",
      ],
      sales: ["B2B Sales", "Customer Success", "Sales Technology"],
      "venture capital": ["Fintech", "SaaS", "AI/ML", "Enterprise Software"],
      investor: ["Fintech", "SaaS", "AI/ML", "Enterprise Software"],
      cto: ["Cloud Computing", "AI/ML", "Engineering Culture"],
      "chief technology": ["Cloud Computing", "AI/ML", "Engineering Culture"],
      finance: ["Fintech", "Investment Strategy", "Financial Markets"],
      hr: ["Workplace Culture", "Talent Development", "Employee Engagement"],
      operations: [
        "Process Improvement",
        "Supply Chain",
        "Operational Excellence",
      ],
    };

    const titleLower = title.toLowerCase();

    for (const [key, interests] of Object.entries(interestsMap)) {
      if (titleLower.includes(key)) {
        return interests;
      }
    }

    // Default interests for any professional
    return ["Professional Networking", "Industry Trends", "Career Development"];
  }
}

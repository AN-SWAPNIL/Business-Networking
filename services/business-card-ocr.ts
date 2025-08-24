import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

// Define the expected output schema
const BusinessCardSchema = z.object({
  success: z.boolean(),
  name: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  title: z.string().optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  preferences: z.object({
    mentor: z.boolean(),
    invest: z.boolean(),
    discuss: z.boolean(),
    collaborate: z.boolean(),
    hire: z.boolean(),
  }),
  error: z.string().optional(),
});

export type BusinessCardResult = z.infer<typeof BusinessCardSchema>;

export class BusinessCardOCRService {
  private model: ChatGoogleGenerativeAI;

  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY environment variable is required");
    }

    this.model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.1, // Low temperature for more consistent extraction
    });
  }

  async extractBusinessCardData(
    imageBase64: string
  ): Promise<BusinessCardResult> {
    try {
      // Remove data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

      const prompt = `
You are an expert OCR system specialized in extracting information from business cards. 
Analyze the provided business card image and extract the following information in JSON format.

IMPORTANT INSTRUCTIONS:
1. Extract ONLY information that is clearly visible and readable in the business card
2. Do NOT make assumptions or infer information that isn't explicitly shown
3. If a field is not present or unclear, leave it as an empty string
4. For bio, extract any tagline, company description, or professional summary if present
5. For location, extract city, state, country if mentioned
6. For website, extract any URLs, social media handles, or web addresses. add https:// if not present
7. For preferences, set all to false as these cannot be determined from a business card
8. Return success: false if the image is not a business card, too blurry, or empty
9. If multiple phone numbers, email addresses, or other fields are present, use only the first one

Required JSON structure:
{
  "success": true or false,
  "name": "Full name of the person",
  "company": "Company or organization name",
  "phone": "Phone number (include country code if visible)",
  "email": "Email address",
  "title": "Job title or position",
  "bio": "Any tagline, company description, or professional summary",
  "location": "City, state, country (if mentioned)",
  "website": "Website URL, LinkedIn, or other web presence",
  "preferences": {
    "mentor": false,
    "invest": false,
    "discuss": false,
    "collaborate": false,
    "hire": false
  },
  "error": "Error message if success is false (e.g., 'Not a business card', 'Image too blurry', 'No text detected')"
}

If the image is not a business card or if you cannot extract meaningful information, set success to false and provide an appropriate error message.
`;

      const message = new HumanMessage({
        content: [
          {
            type: "text",
            text: prompt,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Data}`,
            },
          },
        ],
      });

      const response = await this.model.invoke([message]);

      // Extract JSON from the response
      const responseText = response.content as string;

      // Try to find and parse JSON from the response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // If no JSON found, try to extract from code blocks
        jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonMatch[0] = jsonMatch[1];
        }
      }

      if (!jsonMatch) {
        return {
          success: false,
          name: "",
          company: "",
          phone: "",
          email: "",
          title: "",
          bio: "",
          location: "",
          website: "",
          preferences: {
            mentor: false,
            invest: false,
            discuss: false,
            collaborate: false,
            hire: false,
          },
          error: "Failed to parse response from AI model",
        };
      }

      const parsedData = JSON.parse(jsonMatch[0]);

      // Validate the response against our schema
      const validatedData = BusinessCardSchema.parse(parsedData);

      return validatedData;
    } catch (error) {
      console.error("Error processing business card:", error);

      return {
        success: false,
        name: "",
        company: "",
        phone: "",
        email: "",
        title: "",
        bio: "",
        location: "",
        website: "",
        preferences: {
          mentor: false,
          invest: false,
          discuss: false,
          collaborate: false,
          hire: false,
        },
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

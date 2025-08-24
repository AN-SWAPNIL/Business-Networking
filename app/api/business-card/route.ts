import { NextRequest, NextResponse } from "next/server";
import { BusinessCardOCRService } from "@/services/business-card-ocr";
import { z } from "zod";

const requestSchema = z.object({
  image: z.string().min(1, "Image data is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image } = requestSchema.parse(body);

    // Initialize the OCR service
    const ocrService = new BusinessCardOCRService();

    // Extract business card data (includes validation within the process)
    const result = await ocrService.extractBusinessCardData(image);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Business card processing error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
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
        error: "Internal server error during processing",
      },
      { status: 500 }
    );
  }
}

// Optional: Add rate limiting headers
export async function GET() {
  return NextResponse.json(
    {
      message: "Business card OCR API endpoint",
      methods: ["POST"],
      endpoint: "/api/business-card",
      payload: {
        image: "base64 encoded image data",
      },
    },
    { status: 200 }
  );
}

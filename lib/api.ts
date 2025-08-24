// Centralized API calls for the business networking app

export interface BusinessCardData {
  success: boolean;
  name: string;
  company: string;
  phone: string;
  email: string;
  title: string;
  bio: string;
  location: string;
  website: string;
  preferences: {
    mentor: boolean;
    invest: boolean;
    discuss: boolean;
    collaborate: boolean;
    hire: boolean;
  };
  error?: string;
}

/**
 * Process business card image using AI OCR
 */
export async function processBusinessCard(
  file: File
): Promise<BusinessCardData> {
  if (!file.type.startsWith("image/")) {
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
      error: "Please upload an image file",
    };
  }

  try {
    // Convert file to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = (e) => resolve(e.target?.result as string);
      fileReader.onerror = reject;
      fileReader.readAsDataURL(file);
    });

    // Call the OCR API
    const response = await fetch("/api/business-card", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: base64,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result as BusinessCardData;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    console.error("Error processing business card:", err);

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
      error: errorMessage,
    };
  }
}

// Future API calls can be added here:
// export async function signupUser(data: SignupData) { ... }
// export async function loginUser(credentials: LoginCredentials) { ... }
// export async function getUserProfile(userId: string) { ... }
// etc.

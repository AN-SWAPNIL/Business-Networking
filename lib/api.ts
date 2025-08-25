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

// Profile API types and functions
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  title?: string;
  company?: string;
  location?: string;
  bio?: string;
  phone?: string;
  website?: string;
  avatar_url?: string;
  preferences: {
    mentor: boolean;
    invest: boolean;
    discuss: boolean;
    collaborate: boolean;
    hire: boolean;
  };
  stats: {
    connections: number;
    collaborations: number;
    mentorships: number;
    investments: number;
    discussions: number;
    monitored: number;
    hired: number;
  };
  created_at?: string;
  updated_at?: string;
}

export interface UpdateProfileData {
  name: string;
  title?: string;
  company?: string;
  location?: string;
  bio?: string;
  phone?: string;
  website?: string;
  preferences?: {
    mentor: boolean;
    invest: boolean;
    discuss: boolean;
    collaborate: boolean;
    hire: boolean;
  };
}

/**
 * Get current user's profile
 */
export async function getUserProfile(): Promise<{
  success: boolean;
  profile?: UserProfile;
  error?: string;
}> {
  try {
    const response = await fetch("/api/profile", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    console.error("Error fetching user profile:", err);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Update current user's profile
 */
export async function updateUserProfile(
  profileData: UpdateProfileData
): Promise<{
  success: boolean;
  profile?: UserProfile;
  error?: string;
  message?: string;
}> {
  try {
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    console.error("Error updating user profile:", err);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Future API calls can be added here:
// export async function signupUser(data: SignupData) { ... }
// export async function loginUser(credentials: LoginCredentials) { ... }
// etc.

// Account management types and functions
export interface AccountSettings {
  notifications: {
    email: boolean;
    push: boolean;
    connections: boolean;
    messages: boolean;
    collaborations: boolean;
    mentions: boolean;
  };
  privacy: {
    profileVisibility: "public" | "network" | "private";
    showEmail: boolean;
    showPhone: boolean;
    allowMessages: boolean;
  };
}

export interface ExportDataResponse {
  success: boolean;
  data?: {
    profile: any;
    auth: any;
    exportDate: string;
  };
  error?: string;
}

export interface SettingsUpdateResponse {
  success: boolean;
  message?: string;
  settings?: AccountSettings;
  error?: string;
}

export interface AccountDeleteResponse {
  success: boolean;
  message?: string;
  warning?: string;
  error?: string;
}

/**
 * Export user account data
 */
export async function exportAccountData(): Promise<ExportDataResponse> {
  try {
    const response = await fetch("/api/account", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    console.error("Error exporting account data:", err);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Update account settings (notifications and privacy)
 */
export async function updateAccountSettings(
  settings: Partial<AccountSettings>
): Promise<SettingsUpdateResponse> {
  try {
    const response = await fetch("/api/account", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    console.error("Error updating account settings:", err);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Delete user account permanently
 */
export async function deleteAccount(
  confirmDelete: boolean
): Promise<AccountDeleteResponse> {
  try {
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmDelete }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    console.error("Error deleting account:", err);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Trigger profile intelligence processing
 */
export async function triggerProfileIntelligence(): Promise<{
  success: boolean;
  analysis?: string;
  summary?: string;
  error?: string;
}> {
  try {
    const response = await fetch("/api/profile-intelligence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    console.error("Error triggering profile intelligence:", err);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get existing profile intelligence data
 */
export async function getProfileIntelligence(): Promise<{
  success: boolean;
  hasIntelligence: boolean;
  summary?: string;
  analysis?: string;
  lastUpdated?: string;
  error?: string;
}> {
  try {
    const response = await fetch("/api/profile-intelligence", {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    console.error("Error fetching profile intelligence:", err);

    return {
      success: false,
      hasIntelligence: false,
      error: errorMessage,
    };
  }
}

"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, ArrowRight, Check } from "lucide-react";
import { BusinessCardUpload } from "@/components/business-card-upload";
import { ProfileForm } from "@/components/profile-form";
import { SignupStep } from "@/components/signup-step";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

type OnboardingStep = "welcome" | "upload" | "profile" | "signup" | "complete";

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const { user, loading } = useAuth(); // Use auth hook instead of direct Supabase
  const [extractedData, setExtractedData] = useState({
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
  });

  // Check for authentication - if user is authenticated, always go to complete
  useEffect(() => {
    if (!loading && user && currentStep !== "complete") {
      // User is authenticated but not on complete step
      // Always go to complete and clear temp data
      handleSignupComplete();
    }
  }, [user, loading, currentStep]);

  const handleCardUpload = (data: {
    name: string;
    company: string;
    phone: string;
    email: string;
    title: string;
    location: string;
    website: string;
    preferences: {
      mentor: boolean;
      invest: boolean;
      discuss: boolean;
      collaborate: boolean;
      hire: boolean;
    },
  }) => {
    // Extend data with default values and save to localStorage
    const extendedData = {
      ...data,
      bio: "",
    };
    const profileData = { ...extendedData, timestamp: Date.now() };
    localStorage.setItem("tempProfile", JSON.stringify(profileData));
    setExtractedData(extendedData);
    setCurrentStep("profile");
  };

  const handleProfileComplete = (profileData: typeof extractedData) => {
    // Update localStorage with complete profile
    const completeProfile = { ...profileData, timestamp: Date.now() };
    localStorage.setItem("tempProfile", JSON.stringify(completeProfile));
    setExtractedData(profileData);
    setCurrentStep("signup");
  };

  const handleSignupComplete = () => {
    // Clear localStorage after successful signup
    localStorage.removeItem("tempProfile");
    setCurrentStep("complete");
  };

  const goToPreviousStep = () => {
    switch (currentStep) {
      case "upload":
        setCurrentStep("welcome");
        break;
      case "profile":
        setCurrentStep("upload");
        break;
      case "signup":
        setCurrentStep("profile");
        break;
      default:
        break;
    }
  };

  const goToNextStep = () => {
    switch (currentStep) {
      case "welcome":
        setCurrentStep("upload");
        break;
      case "upload":
        // This will be handled by handleCardUpload
        break;
      case "profile":
        // This will be handled by handleProfileComplete
        break;
      case "signup":
        // This will be handled by handleSignupComplete
        break;
      default:
        break;
    }
  };

  // Load profile data from localStorage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem("tempProfile");
    if (savedProfile) {
      try {
        const profileData = JSON.parse(savedProfile);
        // Check if data is not too old (24 hours)
        if (Date.now() - profileData.timestamp < 24 * 60 * 60 * 1000) {
          setExtractedData(profileData);
          // If we have complete profile data, skip to signup
          if (
            profileData.name &&
            profileData.email &&
            profileData.bio !== undefined
          ) {
            setCurrentStep("signup");
          } else if (profileData.name && profileData.email) {
            setCurrentStep("profile");
          }
        } else {
          // Remove old data
          localStorage.removeItem("tempProfile");
        }
      } catch (error) {
        console.error("Error loading saved profile:", error);
        localStorage.removeItem("tempProfile");
      }
    }
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Progress indicator */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          {["welcome", "upload", "profile", "signup", "complete"].map(
            (step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep === step
                      ? "bg-primary text-primary-foreground"
                      : index <
                        [
                          "welcome",
                          "upload",
                          "profile",
                          "signup",
                          "complete",
                        ].indexOf(currentStep)
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index <
                  [
                    "welcome",
                    "upload",
                    "profile",
                    "signup",
                    "complete",
                  ].indexOf(currentStep) ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 4 && (
                  <div
                    className={`w-12 h-0.5 ${
                      index <
                      [
                        "welcome",
                        "upload",
                        "profile",
                        "signup",
                        "complete",
                      ].indexOf(currentStep)
                        ? "bg-accent"
                        : "bg-muted"
                    }`}
                  />
                )}
              </div>
            )
          )}
        </div>
      </div>

      {currentStep === "welcome" && (
        <Card className="text-center">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl font-serif text-primary mb-2">
              Welcome to NetworkPro
            </CardTitle>
            <CardDescription className="text-lg">
              Connect with professionals, share opportunities, and grow your
              network
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Building className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-serif">
                Get Started in 4 Easy Steps
              </h3>
              <div className="grid gap-4 text-left">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Upload Your Business Card</p>
                    <p className="text-sm text-muted-foreground">
                      We'll extract your information automatically
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Review Your Profile</p>
                    <p className="text-sm text-muted-foreground">
                      Complete and customize your professional information
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Create Your Account</p>
                    <p className="text-sm text-muted-foreground">
                      Choose email verification or Google sign-in
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Start Networking</p>
                    <p className="text-sm text-muted-foreground">
                      Discover and connect with professionals
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={() => setCurrentStep("upload")}
              className="w-full"
              size="lg"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-primary hover:underline font-medium"
              >
                Sign in here
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === "upload" && (
        <div className="space-y-4">
          <BusinessCardUpload onUpload={handleCardUpload} />
          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={goToPreviousStep}>
              ← Previous
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  // Skip upload, go to profile with empty data
                  const emptyData = {
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
                  };
                  setExtractedData(emptyData);
                  setCurrentStep("profile");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Skip Upload
              </Button>
              <div className="text-sm text-muted-foreground">
                Upload your business card to continue
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === "profile" && (
        <div className="space-y-4">
          <ProfileForm
            initialData={extractedData}
            onComplete={handleProfileComplete}
          />
          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={goToPreviousStep}>
              ← Previous
            </Button>
            <div className="text-sm text-muted-foreground flex items-center">
              Complete your profile to continue
            </div>
          </div>
        </div>
      )}

      {currentStep === "signup" && (
        <div className="space-y-4">
          <SignupStep
            profileData={extractedData}
            onComplete={handleSignupComplete}
          />
          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={goToPreviousStep}>
              ← Previous
            </Button>
            <div className="text-sm text-muted-foreground flex items-center">
              Create your account to finish
            </div>
          </div>
        </div>
      )}

      {currentStep === "complete" && (
        <Card className="text-center">
          <CardHeader>
            <div className="w-16 h-16 mx-auto bg-accent/10 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-accent" />
            </div>
            <CardTitle className="text-2xl font-serif text-primary">
              Welcome to the Network!
            </CardTitle>
            <CardDescription>
              Your profile is complete. Start discovering professionals in your
              area.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full" size="lg">
              <Link href="/matches">
                View Your Matches
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="bg-transparent">
                <Link href="/directory">Browse Directory</Link>
              </Button>
              <Button asChild variant="outline" className="bg-transparent">
                <Link href="/profile">View Profile</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building, ArrowRight, Check } from "lucide-react"
import { BusinessCardUpload } from "@/components/business-card-upload"
import { ProfileForm } from "@/components/profile-form"
import Link from "next/link"

type OnboardingStep = "welcome" | "upload" | "profile" | "complete"

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome")
  const [extractedData, setExtractedData] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    title: "",
  })

  const handleCardUpload = (data: typeof extractedData) => {
    setExtractedData(data)
    setCurrentStep("profile")
  }

  const handleProfileComplete = () => {
    setCurrentStep("complete")
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Progress indicator */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          {["welcome", "upload", "profile", "complete"].map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === step
                    ? "bg-primary text-primary-foreground"
                    : index < ["welcome", "upload", "profile", "complete"].indexOf(currentStep)
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {index < ["welcome", "upload", "profile", "complete"].indexOf(currentStep) ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < 3 && (
                <div
                  className={`w-12 h-0.5 ${
                    index < ["welcome", "upload", "profile", "complete"].indexOf(currentStep) ? "bg-accent" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {currentStep === "welcome" && (
        <Card className="text-center">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl font-serif text-primary mb-2">Welcome to NetworkPro</CardTitle>
            <CardDescription className="text-lg">
              Connect with professionals, share opportunities, and grow your network
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Building className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-serif">Get Started in 3 Easy Steps</h3>
              <div className="grid gap-4 text-left">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Upload Your Business Card</p>
                    <p className="text-sm text-muted-foreground">We'll extract your information automatically</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Complete Your Profile</p>
                    <p className="text-sm text-muted-foreground">Set your collaboration preferences</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Start Networking</p>
                    <p className="text-sm text-muted-foreground">Discover and connect with professionals</p>
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={() => setCurrentStep("upload")} className="w-full" size="lg">
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === "upload" && <BusinessCardUpload onUpload={handleCardUpload} />}

      {currentStep === "profile" && <ProfileForm initialData={extractedData} onComplete={handleProfileComplete} />}

      {currentStep === "complete" && (
        <Card className="text-center">
          <CardHeader>
            <div className="w-16 h-16 mx-auto bg-accent/10 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-accent" />
            </div>
            <CardTitle className="text-2xl font-serif text-primary">Welcome to the Network!</CardTitle>
            <CardDescription>Your profile is complete. Start discovering professionals in your area.</CardDescription>
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
  )
}

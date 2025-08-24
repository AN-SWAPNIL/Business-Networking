"use client";

import type React from "react";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  ImageIcon,
  Loader2,
  CheckCircle,
  AlertCircle,
  Zap,
} from "lucide-react";
import { processBusinessCard } from "@/lib/api";

interface BusinessCardUploadProps {
  onUpload: (data: {
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
  }) => void;
}

export function BusinessCardUpload({ onUpload }: BusinessCardUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    setError(null);
    setProcessingComplete(false);
    setIsProcessing(true);

    // Create preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      // Process the business card using centralized API
      // console.log("started ocr");
      const result = await processBusinessCard(file);
      // console.log("Business card processing result:", result);

      if (result.success) {
        setProcessingComplete(true);
        // Pass the extracted data to the parent component
        onUpload({
          name: result.name || "",
          company: result.company || "",
          phone: result.phone || "",
          email: result.email || "",
          title: result.title || "",
          bio: result.bio || "",
          location: result.location || "",
          website: result.website || "",
          preferences: result.preferences || {
            mentor: false,
            invest: false,
            discuss: false,
            collaborate: false,
            hire: false,
          },
        });
      } else {
        // Show error from AI processing
        setError(result.error || "Failed to process business card");
        setUploadedImage(null);
      }
    } catch (err) {
      console.error("Error processing business card:", err);
      setError("Failed to process business card. Please try again.");
      setUploadedImage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          AI Business Card Scanner
        </CardTitle>
        <CardDescription>
          Upload a photo of your business card and our AI will extract your
          information automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {uploadedImage ? (
            <div className="space-y-4">
              <div className="relative w-48 h-32 mx-auto">
                <img
                  src={uploadedImage || "/placeholder.svg"}
                  alt="Uploaded business card"
                  className="w-full h-full object-cover rounded-lg border"
                />
              </div>
              {isProcessing ? (
                <div className="flex items-center justify-center space-x-2 text-primary">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing with AI...</span>
                </div>
              ) : processingComplete ? (
                <div className="flex items-center justify-center space-x-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span>Processing complete!</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium">
                  Drop your business card here
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse files
                </p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={isProcessing}
              />
              <Button asChild variant="outline" disabled={isProcessing}>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Choose File
                </label>
              </Button>
            </div>
          )}
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium">✨ AI-Enhanced Features:</p>
          <div className="grid grid-cols-1 gap-1 text-xs">
            <p>• Smart validation with AI's Image Processing Feature</p>
            <p>• Extracts contact info, job title, company, and location</p>
            <p>• Supports JPG, PNG, HEIC - Maximum file size: 10MB</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

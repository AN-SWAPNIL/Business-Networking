"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, ImageIcon, Loader2 } from "lucide-react"

interface BusinessCardUploadProps {
  onUpload: (data: {
    name: string
    company: string
    phone: string
    email: string
    title: string
  }) => void
}

export function BusinessCardUpload({ onUpload }: BusinessCardUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file")
      return
    }

    setIsProcessing(true)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Simulate OCR processing
    setTimeout(() => {
      // Mock extracted data - in real app, this would come from OCR service
      const mockData = {
        name: "John Smith",
        company: "Tech Solutions Inc.",
        phone: "+1 (555) 123-4567",
        email: "john.smith@techsolutions.com",
        title: "Senior Software Engineer",
      }

      setIsProcessing(false)
      onUpload(mockData)
    }, 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">Upload Your Business Card</CardTitle>
        <CardDescription>
          Upload a photo of your business card and we'll extract your information automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
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
                  <span>Processing your business card...</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Processing complete!</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium">Drop your business card here</p>
                <p className="text-sm text-muted-foreground">or click to browse files</p>
              </div>
              <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="file-upload" />
              <Button asChild variant="outline">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Choose File
                </label>
              </Button>
            </div>
          )}
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium">Supported formats:</p>
          <p>JPG, PNG, HEIC - Maximum file size: 10MB</p>
        </div>
      </CardContent>
    </Card>
  )
}

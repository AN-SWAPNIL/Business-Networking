"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Building, Phone, Mail, MapPin, Globe, Camera, Save } from "lucide-react"

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
  userData: {
    name: string
    title: string
    company: string
    email: string
    phone: string
    location: string
    website?: string
    bio: string
    avatar: string
    preferences: {
      mentor: boolean
      invest: boolean
      discuss: boolean
      collaborate: boolean
      hire: boolean
    }
  }
}

export function EditProfileModal({ isOpen, onClose, userData }: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    ...userData,
    website: userData.website || "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePreferenceChange = (preference: string, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, [preference]: value },
    }))
  }

  const handleSave = () => {
    // In real app, save to API/database
    console.log("Saving profile data:", formData)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit Profile</DialogTitle>
          <DialogDescription>Update your professional information and preferences</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={formData.avatar || "/placeholder.svg"} alt={formData.name} />
              <AvatarFallback>
                {formData.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">
              <Camera className="w-4 h-4 mr-2" />
              Change Photo
            </Button>
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium font-serif">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-title">Job Title</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-company">Company</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-company"
                    value={formData.company}
                    onChange={(e) => handleInputChange("company", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-location"
                    value={formData.location}
                    onChange={(e) => handleInputChange("location", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-website">Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-website"
                  value={formData.website}
                  onChange={(e) => handleInputChange("website", e.target.value)}
                  className="pl-10"
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea
                id="edit-bio"
                value={formData.bio}
                onChange={(e) => handleInputChange("bio", e.target.value)}
                rows={4}
                placeholder="Tell others about yourself and your professional interests..."
              />
            </div>
          </div>

          {/* Collaboration Preferences */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium font-serif">Collaboration Preferences</h3>
            <div className="grid grid-cols-1 gap-4">
              {[
                { key: "mentor", label: "Mentoring", description: "I'm open to mentoring others" },
                { key: "invest", label: "Investing", description: "I'm interested in investment opportunities" },
                { key: "discuss", label: "Discussions", description: "I enjoy professional discussions" },
                { key: "collaborate", label: "Collaborating", description: "I'm looking for collaboration partners" },
                { key: "hire", label: "Hiring", description: "I'm looking to hire talent" },
              ].map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    checked={formData.preferences[key as keyof typeof formData.preferences]}
                    onCheckedChange={(checked) => handlePreferenceChange(key, checked)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

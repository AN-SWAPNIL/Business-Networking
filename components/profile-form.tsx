"use client";

import type React from "react";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  User,
  Building,
  Phone,
  Mail,
  Briefcase,
  ArrowRight,
} from "lucide-react";

interface ProfileFormProps {
  initialData: {
    name: string;
    company: string;
    phone: string;
    email: string;
    title: string;
    bio?: string;
    location?: string;
    website?: string;
  };
  onComplete: (profileData: {
    name: string;
    company: string;
    phone: string;
    email: string;
    title: string;
    bio: string;
    location: string;
    website: string;
  }) => void;
}

export function ProfileForm({ initialData, onComplete }: ProfileFormProps) {
  const [formData, setFormData] = useState({
    name: initialData.name,
    company: initialData.company,
    phone: initialData.phone,
    email: initialData.email,
    title: initialData.title,
    bio: initialData.bio || "",
    location: initialData.location || "",
    website: initialData.website || "",
  });

  const [preferences, setPreferences] = useState({
    mentor: false,
    invest: false,
    discuss: false,
    collaborate: false,
    hire: false,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreferenceChange = (preference: string, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [preference]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Pass the complete profile data back
    onComplete(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">Complete Your Profile</CardTitle>
        <CardDescription>
          Review and complete your information. You can always edit this later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium font-serif">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Job Title</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) =>
                      handleInputChange("company", e.target.value)
                    }
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) =>
                    handleInputChange("location", e.target.value)
                  }
                  placeholder="City, State"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange("bio", e.target.value)}
                placeholder="Tell others about yourself and your professional interests..."
                rows={3}
              />
            </div>
          </div>

          {/* Collaboration Preferences */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium font-serif">
              Collaboration Preferences
            </h3>
            <p className="text-sm text-muted-foreground">
              Let others know how you'd like to connect and collaborate
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  key: "mentor",
                  label: "Mentoring",
                  description: "I'm open to mentoring others",
                },
                {
                  key: "invest",
                  label: "Investing",
                  description: "I'm interested in investment opportunities",
                },
                {
                  key: "discuss",
                  label: "Discussions",
                  description: "I enjoy professional discussions",
                },
                {
                  key: "collaborate",
                  label: "Collaborating",
                  description: "I'm looking for collaboration partners",
                },
                {
                  key: "hire",
                  label: "Hiring",
                  description: "I'm looking to hire talent",
                },
              ].map(({ key, label, description }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  </div>
                  <Switch
                    checked={preferences[key as keyof typeof preferences]}
                    onCheckedChange={(checked) =>
                      handlePreferenceChange(key, checked)
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg">
            Complete Profile
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

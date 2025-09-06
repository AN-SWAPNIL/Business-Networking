"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  Globe,
  Camera,
  Save,
  UserIcon,
  Loader2,
  Code,
  Lightbulb,
  Plus,
  X,
  Search,
  Upload,
  Trash2,
} from "lucide-react";
import {
  updateUserProfile,
  UserProfile,
  uploadAvatar,
  removeAvatar,
} from "@/lib/api";
import { validateAvatarFile, getAvatarUrl } from "@/lib/avatar-upload";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: UserProfile;
  onUpdate: (updatedProfile: UserProfile) => void;
}

interface SkillInterest {
  name: string;
  count: number;
}

export function EditProfileModal({
  isOpen,
  onClose,
  userData,
  onUpdate,
}: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    name: userData.name,
    title: userData.title || "",
    company: userData.company || "",
    location: userData.location || "",
    bio: userData.bio || "",
    phone: userData.phone || "",
    website: userData.website || "",
    avatar_url: userData.avatar_url || "",
  });

  const [skills, setSkills] = useState<string[]>(userData.skills || []);
  const [interests, setInterests] = useState<string[]>(
    userData.interests || []
  );
  const [newSkill, setNewSkill] = useState("");
  const [newInterest, setNewInterest] = useState("");
  const [activeTab, setActiveTab] = useState("personal");
  const [availableSkills, setAvailableSkills] = useState<SkillInterest[]>([]);
  const [availableInterests, setAvailableInterests] = useState<SkillInterest[]>(
    []
  );
  const [skillsLoading, setSkillsLoading] = useState(false);

  // Avatar upload states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preferences, setPreferences] = useState(
    userData.preferences || {
      mentor: false,
      invest: false,
      discuss: false,
      collaborate: false,
      hire: false,
    }
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch available skills and interests when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSkillsAndInterests();
    }
  }, [isOpen]);

  const fetchSkillsAndInterests = async () => {
    setSkillsLoading(true);
    try {
      const response = await fetch("/api/skills-interests");
      if (response.ok) {
        const data = await response.json();
        setAvailableSkills(data.skills || []);
        setAvailableInterests(data.interests || []);
      }
    } catch (err) {
      console.error("Error fetching skills and interests:", err);
    } finally {
      setSkillsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear any previous errors when user starts typing
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const handlePreferenceChange = (preference: string, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [preference]: value }));
  };

  const addSkill = (skillName?: string) => {
    const skill = skillName || newSkill.trim();
    if (skill && !skills.includes(skill) && skills.length < 10) {
      setSkills([...skills, skill]);
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter((skill) => skill !== skillToRemove));
  };

  const addInterest = (interestName?: string) => {
    const interest = interestName || newInterest.trim();
    if (interest && !interests.includes(interest) && interests.length < 10) {
      setInterests([...interests, interest]);
      setNewInterest("");
    }
  };

  const removeInterest = (interestToRemove: string) => {
    setInterests(interests.filter((interest) => interest !== interestToRemove));
  };

  // Avatar upload functions
  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid file");
      return;
    }

    setAvatarFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Clear any errors
    setError(null);
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile || !userData.id) return;

    setAvatarUploading(true);
    setError(null);

    try {
      const result = await uploadAvatar(avatarFile, userData.id);

      if (result.success && result.avatarUrl) {
        setFormData((prev) => ({ ...prev, avatar_url: result.avatarUrl! }));
        setAvatarFile(null);
        setAvatarPreview("");
        setSuccess("Avatar uploaded successfully!");

        // Update the userData prop to reflect the change
        const updatedUserData = { ...userData, avatar_url: result.avatarUrl };
        onUpdate(updatedUserData);
      } else {
        setError(result.error || "Failed to upload avatar");
      }
    } catch (err) {
      setError("An error occurred while uploading avatar");
      console.error("Avatar upload error:", err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    setError(null);

    try {
      const result = await removeAvatar();

      if (result.success) {
        setFormData((prev) => ({ ...prev, avatar_url: "" }));
        setAvatarFile(null);
        setAvatarPreview("");
        setSuccess("Avatar removed successfully!");

        // Update the userData prop to reflect the change
        const updatedUserData = { ...userData, avatar_url: undefined };
        onUpdate(updatedUserData);
      } else {
        setError(result.error || "Failed to remove avatar");
      }
    } catch (err) {
      setError("An error occurred while removing avatar");
      console.error("Avatar removal error:", err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarButtonClick = () => {
    fileInputRef.current?.click();
  };

  const getFilteredSkills = () => {
    return availableSkills
      .filter(
        (skill) =>
          skill.name.toLowerCase().includes(newSkill.toLowerCase()) &&
          !skills.includes(skill.name)
      )
      .slice(0, 5);
  };

  const getFilteredInterests = () => {
    return availableInterests
      .filter(
        (interest) =>
          interest.name.toLowerCase().includes(newInterest.toLowerCase()) &&
          !interests.includes(interest.name)
      )
      .slice(0, 5);
  };

  const getTopSkills = () => {
    return availableSkills
      .filter((skill) => !skills.includes(skill.name))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  };

  const getTopInterests = () => {
    return availableInterests
      .filter((interest) => !interests.includes(interest.name))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (skills.length < 1) {
      setError("Please add at least 1 skill");
      setIsLoading(false);
      return;
    }

    if (skills.length > 10) {
      setError("Maximum 10 skills allowed");
      setIsLoading(false);
      return;
    }

    if (interests.length < 1) {
      setError("Please add at least 1 interest");
      setIsLoading(false);
      return;
    }

    if (interests.length > 10) {
      setError("Maximum 10 interests allowed");
      setIsLoading(false);
      return;
    }

    try {
      const result = await updateUserProfile({
        ...formData,
        skills,
        interests,
        preferences,
      });

      if (result.success && result.profile) {
        setSuccess("Profile updated successfully!");
        onUpdate(result.profile);
        // Close modal after a brief delay to show success message
        setTimeout(() => {
          onClose();
          setSuccess(null);
        }, 1500);
      } else {
        setError(result.error || "Failed to update profile");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Error updating profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit Profile</DialogTitle>
          <DialogDescription>
            Update your professional information and preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-4">
            <Avatar className="w-20 h-20">
              <AvatarImage
                src={
                  avatarPreview ||
                  formData.avatar_url ||
                  getAvatarUrl(userData.avatar_url, userData.name)
                }
                alt={userData.name}
              />
              <AvatarFallback>
                <UserIcon className="w-8 h-8" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAvatarButtonClick}
                  disabled={avatarUploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {avatarFile ? "Change Photo" : "Upload Photo"}
                </Button>
                {(formData.avatar_url || avatarPreview) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={avatarUploading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>

              {avatarFile && (
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    onClick={handleAvatarUpload}
                    disabled={avatarUploading}
                  >
                    {avatarUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Avatar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview("");
                    }}
                    disabled={avatarUploading}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />

              <p className="text-xs text-muted-foreground">
                Upload an image (max 5MB). JPG, PNG, GIF supported.
              </p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Tabbed Interface */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="personal">Personal Info</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="skills">Skills & Interests</TabsTrigger>
            </TabsList>

            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-4 mt-6">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Personal Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Full Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-title">Job Title</Label>
                  <Input
                    id="edit-title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-company">Company</Label>
                  <Input
                    id="edit-company"
                    value={formData.company}
                    onChange={(e) =>
                      handleInputChange("company", e.target.value)
                    }
                    placeholder="e.g. Tech Solutions Inc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location</Label>
                  <Input
                    id="edit-location"
                    value={formData.location}
                    onChange={(e) =>
                      handleInputChange("location", e.target.value)
                    }
                    placeholder="e.g. San Francisco, CA"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={userData.email}
                    className="bg-muted"
                    disabled
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="e.g. +1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-website">Website</Label>
                <Input
                  id="edit-website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange("website", e.target.value)}
                  placeholder="e.g. https://yourwebsite.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-bio">Bio</Label>
                <Textarea
                  id="edit-bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  placeholder="Tell us about yourself and your professional experience..."
                  className="min-h-[100px]"
                />
              </div>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-4 mt-6">
              <div className="flex items-center space-x-2">
                <Building className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  Collaboration Preferences
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Select what you're open to in your professional network
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Mentoring</div>
                    <div className="text-sm text-muted-foreground">
                      Guide and support others
                    </div>
                  </div>
                  <Switch
                    checked={preferences.mentor}
                    onCheckedChange={(checked) =>
                      handlePreferenceChange("mentor", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Investing</div>
                    <div className="text-sm text-muted-foreground">
                      Invest in startups and businesses
                    </div>
                  </div>
                  <Switch
                    checked={preferences.invest}
                    onCheckedChange={(checked) =>
                      handlePreferenceChange("invest", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Discussions</div>
                    <div className="text-sm text-muted-foreground">
                      Engage in professional discussions
                    </div>
                  </div>
                  <Switch
                    checked={preferences.discuss}
                    onCheckedChange={(checked) =>
                      handlePreferenceChange("discuss", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Collaborating</div>
                    <div className="text-sm text-muted-foreground">
                      Work on projects together
                    </div>
                  </div>
                  <Switch
                    checked={preferences.collaborate}
                    onCheckedChange={(checked) =>
                      handlePreferenceChange("collaborate", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg md:col-span-2">
                  <div>
                    <div className="font-medium">Hiring</div>
                    <div className="text-sm text-muted-foreground">
                      Looking to hire talented individuals
                    </div>
                  </div>
                  <Switch
                    checked={preferences.hire}
                    onCheckedChange={(checked) =>
                      handlePreferenceChange("hire", checked)
                    }
                  />
                </div>
              </div>
            </TabsContent>

            {/* Skills & Interests Tab */}
            <TabsContent value="skills" className="space-y-6 mt-6">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Skills & Interests</h3>
              </div>

              {/* Skills Section */}
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center justify-between">
                  <span className="flex items-center">
                    <Code className="w-4 h-4 mr-2" />
                    Skills ({skills.length}/10)
                  </span>
                  <span
                    className={`text-xs ${
                      skills.length < 1
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    Min 1 required
                  </span>
                </Label>

                {/* Selected Skills */}
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <Badge
                        key={skill}
                        variant="default"
                        className="px-3 py-1"
                      >
                        {skill}
                        <button
                          onClick={() => removeSkill(skill)}
                          className="ml-2 hover:text-destructive"
                          type="button"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Skill Input */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search or add a skill..."
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && newSkill.trim()) {
                          e.preventDefault();
                          addSkill();
                        }
                      }}
                      className="pl-10"
                      disabled={skills.length >= 10}
                    />
                    {newSkill.trim() && (
                      <Button
                        size="sm"
                        onClick={() => addSkill()}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6"
                        disabled={skills.length >= 10}
                        type="button"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  {/* Filtered Skills Suggestions */}
                  {newSkill && getFilteredSkills().length > 0 && (
                    <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                      {getFilteredSkills().map((skill) => (
                        <button
                          key={skill.name}
                          onClick={() => addSkill(skill.name)}
                          className="block w-full text-left px-2 py-1 hover:bg-muted rounded text-sm"
                          disabled={skills.length >= 10}
                          type="button"
                        >
                          {skill.name}{" "}
                          <span className="text-muted-foreground">
                            ({skill.count})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Popular Skills */}
                  {!newSkill && !skillsLoading && getTopSkills().length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Popular Skills
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {getTopSkills().map((skill) => (
                          <Button
                            key={skill.name}
                            variant="outline"
                            size="sm"
                            onClick={() => addSkill(skill.name)}
                            disabled={skills.length >= 10}
                            className="h-8"
                            type="button"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {skill.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Interests Section */}
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center justify-between">
                  <span className="flex items-center">
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Interests ({interests.length}/10)
                  </span>
                  <span
                    className={`text-xs ${
                      interests.length < 1
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    Min 1 required
                  </span>
                </Label>

                {/* Selected Interests */}
                {interests.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <Badge
                        key={interest}
                        variant="secondary"
                        className="px-3 py-1"
                      >
                        {interest}
                        <button
                          onClick={() => removeInterest(interest)}
                          className="ml-2 hover:text-destructive"
                          type="button"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Interest Input */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search or add an interest..."
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && newInterest.trim()) {
                          e.preventDefault();
                          addInterest();
                        }
                      }}
                      className="pl-10"
                      disabled={interests.length >= 10}
                    />
                    {newInterest.trim() && (
                      <Button
                        size="sm"
                        onClick={() => addInterest()}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6"
                        disabled={interests.length >= 10}
                        type="button"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  {/* Filtered Interests Suggestions */}
                  {newInterest && getFilteredInterests().length > 0 && (
                    <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                      {getFilteredInterests().map((interest) => (
                        <button
                          key={interest.name}
                          onClick={() => addInterest(interest.name)}
                          className="block w-full text-left px-2 py-1 hover:bg-muted rounded text-sm"
                          disabled={interests.length >= 10}
                          type="button"
                        >
                          {interest.name}{" "}
                          <span className="text-muted-foreground">
                            ({interest.count})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Popular Interests */}
                  {!newInterest &&
                    !skillsLoading &&
                    getTopInterests().length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                          Popular Interests
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {getTopInterests().map((interest) => (
                            <Button
                              key={interest.name}
                              variant="outline"
                              size="sm"
                              onClick={() => addInterest(interest.name)}
                              disabled={interests.length >= 10}
                              className="h-8"
                              type="button"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              {interest.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Save Button - Always Visible */}
          <div className="flex flex-col items-end pt-4 border-t space-y-2">
            <Button
              onClick={handleSave}
              disabled={
                isLoading ||
                skills.length < 1 ||
                interests.length < 1 ||
                skills.length > 10 ||
                interests.length > 10
              }
              size="lg"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            {(skills.length < 1 || interests.length < 1) && (
              <p className="text-xs text-muted-foreground">
                Please add at least 1 skill and 1 interest to save your profile
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

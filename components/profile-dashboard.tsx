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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building,
  Mail,
  Phone,
  MapPin,
  Globe,
  Edit3,
  Users,
  MessageSquare,
  TrendingUp,
  Handshake,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { ProfileSettings } from "@/components/profile-settings";
import { ProfileIntelligence } from "@/components/profile-intelligence";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { getUserProfile, UserProfile } from "@/lib/api";

export function ProfileDashboard() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user, signOut, loading: authLoading } = useAuth();
  const router = useRouter();

  // Fetch user profile data
  useEffect(() => {
    async function fetchProfile() {
      if (!user || authLoading) return;

      try {
        setProfileLoading(true);
        setError(null);
        const result = await getUserProfile();

        if (result.success && result.profile) {
          setProfile(result.profile);
        } else {
          setError(result.error || "Failed to load profile");
        }
      } catch (err) {
        setError("Failed to load profile");
        console.error("Error fetching profile:", err);
      } finally {
        setProfileLoading(false);
      }
    }

    fetchProfile();
  }, [user, authLoading]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
  };

  const getRelevantStats = () => {
    if (!profile?.preferences || !profile?.stats) return [];

    const stats = [];

    // Always show connections
    stats.push({
      key: "connections",
      label: "Connections",
      value: profile.stats.connections,
      color: "text-primary",
    });

    // Show other stats only if preferences are enabled
    if (profile.preferences.collaborate) {
      stats.push({
        key: "collaborations",
        label: "Collaborations",
        value: profile.stats.collaborations,
        color: "text-primary",
      });
    }

    if (profile.preferences.mentor) {
      stats.push({
        key: "mentorships",
        label: "Mentorships",
        value: profile.stats.mentorships,
        color: "text-primary",
      });
    }

    if (profile.preferences.invest) {
      stats.push({
        key: "investments",
        label: "Investments",
        value: profile.stats.investments,
        color: "text-accent",
      });
    }

    if (profile.preferences.discuss) {
      stats.push({
        key: "discussions",
        label: "Discussions",
        value: profile.stats.discussions,
        color: "text-primary",
      });
    }

    if (profile.preferences.hire) {
      stats.push({
        key: "hired",
        label: "Hired",
        value: profile.stats.hired,
        color: "text-accent",
      });
    }

    return stats;
  };

  const getPreferenceBadges = () => {
    if (!profile?.preferences) return [];

    const badges = [];
    if (profile.preferences.mentor)
      badges.push({ label: "Mentoring", icon: Users });
    if (profile.preferences.invest)
      badges.push({ label: "Investing", icon: TrendingUp });
    if (profile.preferences.discuss)
      badges.push({ label: "Discussions", icon: MessageSquare });
    if (profile.preferences.collaborate)
      badges.push({ label: "Collaborating", icon: Handshake });
    if (profile.preferences.hire)
      badges.push({ label: "Hiring", icon: Building });
    return badges;
  };

  // Show loading state
  if (authLoading || profileLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-5 w-60" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="text-center pb-4">
                <Skeleton className="w-24 h-24 rounded-full mx-auto mb-4" />
                <Skeleton className="h-6 w-32 mx-auto mb-2" />
                <Skeleton className="h-4 w-40 mx-auto" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <Skeleton className="w-4 h-4" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Alert className="mb-8">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  // If no profile data, redirect to profile completion
  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Alert className="mb-8">
          <AlertDescription>
            Profile not found. Please complete your profile setup.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push("/")}>Complete Profile</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">
            My Profile
          </h1>
          <p className="text-muted-foreground">
            Manage your professional presence
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
            <Edit3 className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="text-center pb-4">
              <Avatar className="w-24 h-24 mx-auto mb-4">
                <AvatarImage
                  src={profile.avatar_url || "/placeholder.svg"}
                  alt={profile.name}
                />
                <AvatarFallback className="text-lg">
                  <UserIcon className="w-8 h-8" />
                </AvatarFallback>
              </Avatar>
              <CardTitle className="font-serif">{profile.name}</CardTitle>
              <CardDescription className="text-base">
                {profile.title || "No title set"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.company && (
                <div className="flex items-center space-x-3 text-sm">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <span>{profile.company}</span>
                </div>
              )}
              {profile.location && (
                <div className="flex items-center space-x-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{profile.location}</span>
                </div>
              )}
              <div className="flex items-center space-x-3 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{profile.email}</span>
              </div>
              {profile.phone && (
                <div className="flex items-center space-x-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{profile.phone}</span>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center space-x-3 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate"
                  >
                    {profile.website}
                  </a>
                </div>
              )}

              {/* Collaboration Preferences */}
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">Open to:</h4>
                <div className="flex flex-wrap gap-2">
                  {getPreferenceBadges().length > 0 ? (
                    getPreferenceBadges().map(({ label, icon: Icon }) => (
                      <Badge
                        key={label}
                        variant="secondary"
                        className="text-xs"
                      >
                        <Icon className="w-3 h-3 mr-1" />
                        {label}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No preferences set
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="pt-4 border-t">
                <div
                  className={`grid gap-4 text-center ${
                    getRelevantStats().length <= 3
                      ? `grid-cols-${getRelevantStats().length}`
                      : "grid-cols-3"
                  }`}
                >
                  {getRelevantStats().map(({ key, label, value, color }) => (
                    <div key={key}>
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {profile.created_at && (
                <div className="pt-4 border-t text-center">
                  <p className="text-xs text-muted-foreground">
                    Joined{" "}
                    {new Date(profile.created_at).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {profile.bio ||
                      "No bio available. Edit your profile to add a professional bio."}
                  </p>
                </CardContent>
              </Card>

              {/* AI Profile Intelligence */}
              <ProfileIntelligence
                userProfile={{
                  name: profile.name,
                  title: profile.title,
                  company: profile.company,
                }}
              />

              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Profile created</p>
                      <p className="text-sm text-muted-foreground">
                        {profile.created_at
                          ? new Date(profile.created_at).toLocaleDateString()
                          : "Recently"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">
                        Connected with Sarah Johnson
                      </p>
                      <p className="text-sm text-muted-foreground">
                        2 days ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-accent rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Started mentoring Alex Chen</p>
                      <p className="text-sm text-muted-foreground">
                        1 week ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Joined Tech Solutions Inc.</p>
                      <p className="text-sm text-muted-foreground">
                        2 weeks ago
                      </p>
                    </div>
                  </div>
                  <div className="text-center py-8 text-muted-foreground">
                    <p>
                      More activity will appear here as you connect and
                      collaborate with others.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">
                    Connection History
                  </CardTitle>
                  <CardDescription>
                    Your networking activity over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          New connections this month
                        </p>
                        <p className="text-sm text-muted-foreground">
                          March 2024
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-primary">12</div>
                    </div>
                    <div className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Active collaborations</p>
                        <p className="text-sm text-muted-foreground">
                          Currently ongoing
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-accent">3</div>
                    </div>
                    <div className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Profile views</p>
                        <p className="text-sm text-muted-foreground">
                          Last 30 days
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-primary">89</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <ProfileSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        userData={profile}
        onUpdate={handleProfileUpdate}
      />
    </div>
  );
}

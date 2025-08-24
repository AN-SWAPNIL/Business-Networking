"use client";

import { useState } from "react";
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
} from "lucide-react";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { ProfileSettings } from "@/components/profile-settings";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

// Mock user data - in real app, this would come from API/database
const mockUser = {
  id: "1",
  name: "John Smith",
  title: "Senior Software Engineer",
  company: "Tech Solutions Inc.",
  email: "john.smith@techsolutions.com",
  phone: "+1 (555) 123-4567",
  location: "San Francisco, CA",
  website: "https://johnsmith.dev",
  bio: "Passionate software engineer with 8+ years of experience building scalable web applications. I love mentoring junior developers and exploring new technologies.",
  avatar: "/professional-headshot.png",
  preferences: {
    mentor: true,
    invest: false,
    discuss: true,
    collaborate: true,
    hire: false,
  },
  stats: {
    connections: 247,
    collaborations: 12,
    mentorships: 8,
  },
  joinedDate: "March 2024",
};

export function ProfileDashboard() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const getPreferenceBadges = () => {
    const badges = [];
    if (mockUser.preferences.mentor)
      badges.push({ label: "Mentoring", icon: Users });
    if (mockUser.preferences.invest)
      badges.push({ label: "Investing", icon: TrendingUp });
    if (mockUser.preferences.discuss)
      badges.push({ label: "Discussions", icon: MessageSquare });
    if (mockUser.preferences.collaborate)
      badges.push({ label: "Collaborating", icon: Handshake });
    if (mockUser.preferences.hire)
      badges.push({ label: "Hiring", icon: Building });
    return badges;
  };

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
                  src={mockUser.avatar || "/placeholder.svg"}
                  alt={mockUser.name}
                />
                <AvatarFallback className="text-lg">
                  {mockUser.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="font-serif">{mockUser.name}</CardTitle>
              <CardDescription className="text-base">
                {mockUser.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3 text-sm">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span>{mockUser.company}</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{mockUser.location}</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{mockUser.email}</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{mockUser.phone}</span>
              </div>
              {mockUser.website && (
                <div className="flex items-center space-x-3 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <a
                    href={mockUser.website}
                    className="text-primary hover:underline truncate"
                  >
                    {mockUser.website}
                  </a>
                </div>
              )}

              {/* Collaboration Preferences */}
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">Open to:</h4>
                <div className="flex flex-wrap gap-2">
                  {getPreferenceBadges().map(({ label, icon: Icon }) => (
                    <Badge key={label} variant="secondary" className="text-xs">
                      <Icon className="w-3 h-3 mr-1" />
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="pt-4 border-t">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {mockUser.stats.connections}
                    </p>
                    <p className="text-xs text-muted-foreground">Connections</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {mockUser.stats.collaborations}
                    </p>
                    <p className="text-xs text-muted-foreground">Projects</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {mockUser.stats.mentorships}
                    </p>
                    <p className="text-xs text-muted-foreground">Mentorships</p>
                  </div>
                </div>
              </div>
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
                    {mockUser.bio}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
        userData={mockUser}
      />
    </div>
  );
}

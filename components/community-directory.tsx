"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Users,
  Building,
  MapPin,
  Filter,
  Grid,
  List,
  Loader2,
} from "lucide-react";
import { UserCard } from "@/components/user-card";
import { UserListItem } from "@/components/user-list-item";

// Mock data for community members
const mockUsers = [
  {
    id: "1",
    name: "Sarah Johnson",
    title: "Product Manager",
    company: "Tech Solutions Inc.",
    location: "San Francisco, CA",
    bio: "Experienced product manager passionate about building user-centric solutions. Love mentoring and discussing product strategy.",
    avatar: "/professional-woman-diverse.png",
    preferences: {
      mentor: true,
      invest: false,
      discuss: true,
      collaborate: true,
      hire: false,
    },
    connections: 156,
    joinedDate: "January 2024",
  },
  {
    id: "2",
    name: "Alex Chen",
    title: "Senior Developer",
    company: "StartupCo",
    location: "New York, NY",
    bio: "Full-stack developer with expertise in React and Node.js. Always looking for interesting collaboration opportunities.",
    avatar: "/professional-man.png",
    preferences: {
      mentor: false,
      invest: false,
      discuss: true,
      collaborate: true,
      hire: false,
    },
    connections: 89,
    joinedDate: "February 2024",
  },
  {
    id: "3",
    name: "Maria Rodriguez",
    title: "UX Designer",
    company: "Design Studio",
    location: "Austin, TX",
    bio: "Creative UX designer focused on accessibility and inclusive design. Open to mentoring junior designers.",
    avatar: "/professional-woman-designer.png",
    preferences: {
      mentor: true,
      invest: false,
      discuss: true,
      collaborate: false,
      hire: false,
    },
    connections: 203,
    joinedDate: "March 2024",
  },
  {
    id: "4",
    name: "David Kim",
    title: "Venture Capitalist",
    company: "Growth Partners",
    location: "Palo Alto, CA",
    bio: "Early-stage investor focused on B2B SaaS and fintech. Always interested in meeting innovative entrepreneurs.",
    avatar: "/professional-investor.png",
    preferences: {
      mentor: true,
      invest: true,
      discuss: true,
      collaborate: false,
      hire: false,
    },
    connections: 342,
    joinedDate: "December 2023",
  },
  {
    id: "5",
    name: "Emily Watson",
    title: "Marketing Director",
    company: "Brand Agency",
    location: "Chicago, IL",
    bio: "Strategic marketing leader with 10+ years experience. Passionate about brand building and growth marketing.",
    avatar: "/professional-woman-marketing.png",
    preferences: {
      mentor: true,
      invest: false,
      discuss: true,
      collaborate: true,
      hire: true,
    },
    connections: 278,
    joinedDate: "January 2024",
  },
  {
    id: "6",
    name: "Michael Brown",
    title: "CTO",
    company: "TechCorp",
    location: "Seattle, WA",
    bio: "Technology executive with expertise in scaling engineering teams. Looking to hire top talent and discuss tech trends.",
    avatar: "/professional-man-cto.png",
    preferences: {
      mentor: true,
      invest: false,
      discuss: true,
      collaborate: false,
      hire: true,
    },
    connections: 445,
    joinedDate: "November 2023",
  },
];

import { useDirectory } from "@/hooks/use-directory";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CommunityDirectory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedPreference, setSelectedPreference] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState("all");

  // Fetch directory data using the custom hook
  const { data, loading, error, refetch } = useDirectory({
    search: searchQuery,
    company: selectedCompany !== "all" ? selectedCompany : undefined,
    location: selectedLocation !== "all" ? selectedLocation : undefined,
    preference: selectedPreference !== "all" ? selectedPreference : undefined,
    tab: activeTab !== "all" ? activeTab : undefined,
    limit: 50, // Fetch more items initially
  });

  // Get data with fallbacks
  const users = data?.users || [];
  const stats = data?.stats || {
    totalMembers: 0,
    companies: 0,
    locations: 0,
    mentors: 0,
    investors: 0,
    collaborators: 0,
    hiring: 0,
  };
  const companies = data?.filters?.companies || [];
  const locations = data?.filters?.locations || [];

  // Find the maximum preference count and its label
  const preferenceStats = [
    { label: "Mentors", count: stats.mentors },
    { label: "Collaborators", count: stats.collaborators },
    { label: "Investors", count: stats.investors },
    { label: "Hiring", count: stats.hiring },
  ];
  const maxPreference = preferenceStats.reduce((max, current) =>
    current.count > max.count ? current : max
  );

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCompany("all");
    setSelectedPreference("all");
    setSelectedLocation("all");
    setActiveTab("all");
  };

  // Show loading state
  if (loading && !data) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              Loading community directory...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !data) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load community directory: {error}
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              className="ml-2"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">
            Community Directory
          </h1>
          <p className="text-muted-foreground">
            Discover and connect with professionals in your network
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.totalMembers}</p>
                <p className="text-sm text-muted-foreground">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">{stats.companies}</p>
                <p className="text-sm text-muted-foreground">Companies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.locations}</p>
                <p className="text-sm text-muted-foreground">Locations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">{maxPreference.count}</p>
                <p className="text-sm text-muted-foreground">
                  Top: {maxPreference.label}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center font-serif">
            <Search className="w-5 h-5 mr-2" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, title, company, or skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={selectedCompany}
                onValueChange={setSelectedCompany}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedLocation}
                onValueChange={setSelectedLocation}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedPreference}
                onValueChange={setSelectedPreference}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Preferences</SelectItem>
                  <SelectItem value="mentor">Mentoring</SelectItem>
                  <SelectItem value="invest">Investing</SelectItem>
                  <SelectItem value="discuss">Discussions</SelectItem>
                  <SelectItem value="collaborate">Collaborating</SelectItem>
                  <SelectItem value="hire">Hiring</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={clearFilters}>
                <Filter className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All ({stats.totalMembers})</TabsTrigger>
          <TabsTrigger value="mentors">Mentors ({stats.mentors})</TabsTrigger>
          <TabsTrigger value="investors">
            Investors ({stats.investors})
          </TabsTrigger>
          <TabsTrigger value="collaborators">
            Collaborators ({stats.collaborators})
          </TabsTrigger>
          <TabsTrigger value="hiring">Hiring ({stats.hiring})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {users.length} of {stats.totalMembers} members
          {loading && <span className="ml-2 text-primary">Loading...</span>}
        </p>
      </div>

      {/* User Grid/List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <UserListItem key={user.id} user={user} />
          ))}
        </div>
      )}

      {users.length === 0 && !loading && (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No members found</h3>
            <p className="text-muted-foreground mb-4">
              {error
                ? "There was an error loading the directory."
                : "Try adjusting your search criteria or filters"}
            </p>
            <Button onClick={clearFilters}>Clear All Filters</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

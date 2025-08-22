"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Heart, Users, TrendingUp, MessageSquare, Handshake, Building, Sparkles, RefreshCw } from "lucide-react"
import { MatchCard } from "@/components/match-card"
import { MatchingAlgorithm } from "@/lib/matching-algorithm"

// Mock current user data
const currentUser = {
  id: "current",
  name: "John Smith",
  title: "Senior Software Engineer",
  company: "Tech Solutions Inc.",
  location: "San Francisco, CA",
  preferences: {
    mentor: true,
    invest: false,
    discuss: true,
    collaborate: true,
    hire: false,
  },
  skills: ["React", "Node.js", "TypeScript", "AWS"],
  interests: ["AI/ML", "Fintech", "SaaS"],
}

// Mock users data (same as directory but with additional matching fields)
const allUsers = [
  {
    id: "1",
    name: "Sarah Johnson",
    title: "Product Manager",
    company: "Tech Solutions Inc.",
    location: "San Francisco, CA",
    bio: "Experienced product manager passionate about building user-centric solutions. Love mentoring and discussing product strategy.",
    avatar: "/professional-woman-diverse.png",
    preferences: { mentor: false, invest: false, discuss: true, collaborate: true, hire: false },
    skills: ["Product Strategy", "User Research", "Analytics", "Agile"],
    interests: ["SaaS", "B2B", "Growth"],
    connections: 156,
    joinedDate: "January 2024",
  },
  {
    id: "2",
    name: "Alex Chen",
    title: "Junior Developer",
    company: "StartupCo",
    location: "San Francisco, CA",
    bio: "Full-stack developer eager to learn and grow. Looking for mentorship opportunities and interesting projects.",
    avatar: "/professional-man.png",
    preferences: { mentor: false, invest: false, discuss: true, collaborate: true, hire: false },
    skills: ["JavaScript", "React", "Python", "SQL"],
    interests: ["Web Development", "AI/ML", "Open Source"],
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
    preferences: { mentor: true, invest: false, discuss: true, collaborate: false, hire: false },
    skills: ["UI/UX Design", "Figma", "User Research", "Accessibility"],
    interests: ["Design Systems", "Accessibility", "EdTech"],
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
    preferences: { mentor: true, invest: true, discuss: true, collaborate: false, hire: false },
    skills: ["Investment Analysis", "Due Diligence", "Strategy", "Networking"],
    interests: ["Fintech", "SaaS", "AI/ML", "Enterprise Software"],
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
    preferences: { mentor: true, invest: false, discuss: true, collaborate: true, hire: true },
    skills: ["Growth Marketing", "Brand Strategy", "Content Marketing", "Analytics"],
    interests: ["B2B Marketing", "SaaS", "Growth"],
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
    preferences: { mentor: true, invest: false, discuss: true, collaborate: false, hire: true },
    skills: ["Engineering Leadership", "System Architecture", "Team Building", "Strategy"],
    interests: ["Cloud Computing", "AI/ML", "Engineering Culture"],
    connections: 445,
    joinedDate: "November 2023",
  },
]

export function CollaborationMatches() {
  const [activeTab, setActiveTab] = useState("all")
  const [refreshKey, setRefreshKey] = useState(0)

  const matchingAlgorithm = new MatchingAlgorithm()

  // Calculate matches using the algorithm
  const allMatches = useMemo(() => {
    return matchingAlgorithm.findMatches(currentUser, allUsers)
  }, [refreshKey])

  // Filter matches by category
  const getMatchesByCategory = (category: string) => {
    switch (category) {
      case "mentorship":
        return allMatches.filter(
          (match) =>
            (currentUser.preferences.mentor && !match.user.preferences.mentor) ||
            (!currentUser.preferences.mentor && match.user.preferences.mentor),
        )
      case "collaboration":
        return allMatches.filter((match) => currentUser.preferences.collaborate && match.user.preferences.collaborate)
      case "investment":
        return allMatches.filter(
          (match) =>
            (currentUser.preferences.invest && !match.user.preferences.invest) ||
            (!currentUser.preferences.invest && match.user.preferences.invest),
        )
      case "hiring":
        return allMatches.filter(
          (match) =>
            (currentUser.preferences.hire && !match.user.preferences.hire) ||
            (!currentUser.preferences.hire && match.user.preferences.hire),
        )
      default:
        return allMatches
    }
  }

  const filteredMatches = getMatchesByCategory(activeTab)

  const refreshMatches = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary flex items-center">
            <Sparkles className="w-8 h-8 mr-3" />
            Your Matches
          </h1>
          <p className="text-muted-foreground">Discover professionals perfect for collaboration</p>
        </div>
        <Button onClick={refreshMatches} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Matches
        </Button>
      </div>

      {/* Match Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Heart className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{allMatches.length}</p>
                <p className="text-sm text-muted-foreground">Total Matches</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">
                  {
                    allMatches.filter(
                      (match) =>
                        (currentUser.preferences.mentor && !match.user.preferences.mentor) ||
                        (!currentUser.preferences.mentor && match.user.preferences.mentor),
                    ).length
                  }
                </p>
                <p className="text-sm text-muted-foreground">Mentorship</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Handshake className="w-5 h-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">
                  {
                    allMatches.filter(
                      (match) => currentUser.preferences.collaborate && match.user.preferences.collaborate,
                    ).length
                  }
                </p>
                <p className="text-sm text-muted-foreground">Collaboration</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">
                  {allMatches.filter((match) => match.compatibilityScore >= 80).length}
                </p>
                <p className="text-sm text-muted-foreground">High Compatibility</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Matching Algorithm Explanation */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center font-serif">
            <Sparkles className="w-5 h-5 mr-2" />
            How We Match You
          </CardTitle>
          <CardDescription>
            Our intelligent algorithm considers multiple factors to find your perfect collaborators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-medium mb-2">Collaboration Preferences</h4>
              <p className="text-sm text-muted-foreground">
                Matches based on what you're looking for and what others offer
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Building className="w-6 h-6 text-accent" />
              </div>
              <h4 className="font-medium mb-2">Professional Context</h4>
              <p className="text-sm text-muted-foreground">
                Location, company, and industry alignment for relevant connections
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-medium mb-2">Shared Interests</h4>
              <p className="text-sm text-muted-foreground">Common skills, technologies, and professional interests</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match Categories */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Matches ({allMatches.length})</TabsTrigger>
          <TabsTrigger value="mentorship">
            Mentorship (
            {
              allMatches.filter(
                (match) =>
                  (currentUser.preferences.mentor && !match.user.preferences.mentor) ||
                  (!currentUser.preferences.mentor && match.user.preferences.mentor),
              ).length
            }
            )
          </TabsTrigger>
          <TabsTrigger value="collaboration">
            Collaboration (
            {
              allMatches.filter((match) => currentUser.preferences.collaborate && match.user.preferences.collaborate)
                .length
            }
            )
          </TabsTrigger>
          <TabsTrigger value="investment">
            Investment (
            {
              allMatches.filter(
                (match) =>
                  (currentUser.preferences.invest && !match.user.preferences.invest) ||
                  (!currentUser.preferences.invest && match.user.preferences.invest),
              ).length
            }
            )
          </TabsTrigger>
          <TabsTrigger value="hiring">
            Hiring (
            {
              allMatches.filter(
                (match) =>
                  (currentUser.preferences.hire && !match.user.preferences.hire) ||
                  (!currentUser.preferences.hire && match.user.preferences.hire),
              ).length
            }
            )
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Matches Grid */}
      {filteredMatches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMatches.map((match) => (
            <MatchCard key={match.user.id} match={match} currentUser={currentUser} />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No matches found</h3>
            <p className="text-muted-foreground mb-4">
              Try updating your collaboration preferences or check back later
            </p>
            <Button onClick={refreshMatches}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Matches
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

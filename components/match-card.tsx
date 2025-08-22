"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Building, MapPin, Users, MessageCircle, UserPlus, Heart, Sparkles } from "lucide-react"

interface Match {
  user: {
    id: string
    name: string
    title: string
    company: string
    location: string
    bio: string
    avatar: string
    preferences: {
      mentor: boolean
      invest: boolean
      discuss: boolean
      collaborate: boolean
      hire: boolean
    }
    skills?: string[]
    interests?: string[]
    connections: number
  }
  compatibilityScore: number
  matchReasons: string[]
  sharedInterests: string[]
  complementarySkills: string[]
}

interface MatchCardProps {
  match: Match
  currentUser: {
    preferences: {
      mentor: boolean
      invest: boolean
      discuss: boolean
      collaborate: boolean
      hire: boolean
    }
  }
}

export function MatchCard({ match, currentUser }: MatchCardProps) {
  const { user, compatibilityScore, matchReasons, sharedInterests, complementarySkills } = match

  const getCompatibilityColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-orange-600"
  }

  const getCompatibilityBg = (score: number) => {
    if (score >= 80) return "bg-green-100"
    if (score >= 60) return "bg-yellow-100"
    return "bg-orange-100"
  }

  const getMatchType = () => {
    const types = []
    if (currentUser.preferences.mentor && !user.preferences.mentor) types.push("Mentee")
    if (!currentUser.preferences.mentor && user.preferences.mentor) types.push("Mentor")
    if (currentUser.preferences.collaborate && user.preferences.collaborate) types.push("Collaborator")
    if (currentUser.preferences.invest && !user.preferences.invest) types.push("Investment Opportunity")
    if (!currentUser.preferences.invest && user.preferences.invest) types.push("Investor")
    if (currentUser.preferences.hire && !user.preferences.hire) types.push("Potential Hire")
    if (!currentUser.preferences.hire && user.preferences.hire) types.push("Hiring Manager")
    return types[0] || "Professional"
  }

  const handleConnect = () => {
    console.log("Connecting with", user.name)
  }

  const handleMessage = () => {
    console.log("Messaging", user.name)
  }

  const handleLike = () => {
    console.log("Liked", user.name)
  }

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
      <CardHeader className="text-center pb-4">
        <div className="relative">
          <Avatar className="w-16 h-16 mx-auto mb-3">
            <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
            <AvatarFallback>
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div
            className={`absolute -top-1 -right-1 w-8 h-8 rounded-full ${getCompatibilityBg(
              compatibilityScore,
            )} flex items-center justify-center`}
          >
            <span className={`text-xs font-bold ${getCompatibilityColor(compatibilityScore)}`}>
              {compatibilityScore}%
            </span>
          </div>
        </div>
        <CardTitle className="font-serif text-lg">{user.name}</CardTitle>
        <CardDescription className="text-sm">{user.title}</CardDescription>
        <Badge variant="secondary" className="mx-auto">
          {getMatchType()}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compatibility Score */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Compatibility</span>
            <span className={`text-sm font-bold ${getCompatibilityColor(compatibilityScore)}`}>
              {compatibilityScore}%
            </span>
          </div>
          <Progress value={compatibilityScore} className="h-2" />
        </div>

        {/* Basic Info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <Building className="w-4 h-4 text-muted-foreground" />
            <span className="truncate">{user.company}</span>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="truncate">{user.location}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span>{user.connections} connections</span>
          </div>
        </div>

        {/* Match Reasons */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Why you match:</p>
          <div className="space-y-1">
            {matchReasons.slice(0, 2).map((reason, index) => (
              <div key={index} className="flex items-start space-x-2">
                <Sparkles className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-xs text-muted-foreground">{reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shared Interests */}
        {sharedInterests.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Shared interests:</p>
            <div className="flex flex-wrap gap-1">
              {sharedInterests.slice(0, 3).map((interest) => (
                <Badge key={interest} variant="outline" className="text-xs">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleConnect} className="flex-1" size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Connect
          </Button>
          <Button onClick={handleMessage} variant="outline" size="sm">
            <MessageCircle className="w-4 h-4" />
          </Button>
          <Button onClick={handleLike} variant="outline" size="sm">
            <Heart className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

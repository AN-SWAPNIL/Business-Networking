"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Building, MapPin, Users, MessageCircle, UserPlus } from "lucide-react"

interface User {
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
  connections: number
  joinedDate: string
}

interface UserListItemProps {
  user: User
}

export function UserListItem({ user }: UserListItemProps) {
  const getPreferenceBadges = () => {
    const badges = []
    if (user.preferences.mentor) badges.push("Mentoring")
    if (user.preferences.invest) badges.push("Investing")
    if (user.preferences.discuss) badges.push("Discussions")
    if (user.preferences.collaborate) badges.push("Collaborating")
    if (user.preferences.hire) badges.push("Hiring")
    return badges
  }

  const handleConnect = () => {
    // In real app, send connection request
    console.log("Connecting with", user.name)
  }

  const handleMessage = () => {
    // In real app, open message dialog
    console.log("Messaging", user.name)
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
            <AvatarFallback>
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-serif font-medium truncate">{user.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{user.title}</p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Building className="w-4 h-4" />
                    <span className="truncate">{user.company}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{user.location}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>{user.connections} connections</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 ml-4">
                <Button onClick={handleConnect} size="sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Connect
                </Button>
                <Button onClick={handleMessage} variant="outline" size="sm">
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{user.bio}</p>

            {/* Preferences */}
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {getPreferenceBadges().map((badge) => (
                  <Badge key={badge} variant="secondary" className="text-xs">
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

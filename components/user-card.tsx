"use client";

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
import { Building, MapPin, Users, MessageCircle, UserPlus } from "lucide-react";
import { DirectoryUser } from "@/hooks/use-directory";

interface UserCardProps {
  user: DirectoryUser;
}

export function UserCard({ user }: UserCardProps) {
  const getPreferenceBadges = () => {
    const badges = [];
    if (user.preferences.mentor) badges.push("Mentoring");
    if (user.preferences.invest) badges.push("Investing");
    if (user.preferences.discuss) badges.push("Discussions");
    if (user.preferences.collaborate) badges.push("Collaborating");
    if (user.preferences.hire) badges.push("Hiring");
    return badges;
  };

  const handleConnect = () => {
    // In real app, send connection request
    console.log("Connecting with", user.name);
  };

  const handleMessage = () => {
    // In real app, open message dialog
    console.log("Messaging", user.name);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="text-center pb-4">
        <Avatar className="w-16 h-16 mx-auto mb-3">
          <AvatarImage
            src={user.avatar_url || "/placeholder.svg"}
            alt={user.name}
          />
          <AvatarFallback>
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <CardTitle className="font-serif text-lg">{user.name}</CardTitle>
        <CardDescription className="text-sm">
          {user.title || "No title"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          {user.company && (
            <div className="flex items-center space-x-2">
              <Building className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{user.company}</span>
            </div>
          )}
          {user.location && (
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{user.location}</span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span>{user.connections} connections</span>
          </div>
        </div>

        {user.bio && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {user.bio}
          </p>
        )}

        {/* Preferences */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Open to:</p>
          <div className="flex flex-wrap gap-1">
            {getPreferenceBadges()
              .slice(0, 3)
              .map((badge) => (
                <Badge key={badge} variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              ))}
            {getPreferenceBadges().length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{getPreferenceBadges().length - 3} more
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleConnect} className="flex-1" size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Connect
          </Button>
          <Button onClick={handleMessage} variant="outline" size="sm">
            <MessageCircle className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

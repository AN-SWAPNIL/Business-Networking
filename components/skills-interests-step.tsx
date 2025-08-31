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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, X, Search, TrendingUp, Lightbulb } from "lucide-react";

interface SkillsInterestsStepProps {
  initialData: {
    skills?: string[];
    interests?: string[];
  };
  onComplete: (data: { skills: string[]; interests: string[] }) => void;
}

interface SkillInterest {
  name: string;
  count: number;
}

export function SkillsInterestsStep({ initialData, onComplete }: SkillsInterestsStepProps) {
  const [selectedSkills, setSelectedSkills] = useState<string[]>(initialData.skills || []);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(initialData.interests || []);
  const [skillSearch, setSkillSearch] = useState("");
  const [interestSearch, setInterestSearch] = useState("");
  const [availableSkills, setAvailableSkills] = useState<SkillInterest[]>([]);
  const [availableInterests, setAvailableInterests] = useState<SkillInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available skills and interests from the API
  useEffect(() => {
    const fetchSkillsAndInterests = async () => {
      try {
        const response = await fetch("/api/skills-interests");
        if (!response.ok) {
          throw new Error("Failed to fetch skills and interests");
        }
        const data = await response.json();
        setAvailableSkills(data.skills || []);
        setAvailableInterests(data.interests || []);
      } catch (err) {
        console.error("Error fetching skills and interests:", err);
        setError("Failed to load suggestions. You can still add your own.");
        // Set default popular options if API fails
        setAvailableSkills([
          { name: "JavaScript", count: 150 },
          { name: "React", count: 120 },
          { name: "Node.js", count: 100 },
          { name: "Python", count: 180 },
          { name: "TypeScript", count: 90 }
        ]);
        setAvailableInterests([
          { name: "AI/ML", count: 200 },
          { name: "Fintech", count: 80 },
          { name: "SaaS", count: 120 },
          { name: "Web Development", count: 160 },
          { name: "Mobile Development", count: 90 }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSkillsAndInterests();
  }, []);

  const addSkill = (skill: string) => {
    const trimmedSkill = skill.trim();
    if (trimmedSkill && !selectedSkills.includes(trimmedSkill) && selectedSkills.length < 10) {
      setSelectedSkills([...selectedSkills, trimmedSkill]);
      setSkillSearch("");
    }
  };

  const removeSkill = (skill: string) => {
    setSelectedSkills(selectedSkills.filter(s => s !== skill));
  };

  const addInterest = (interest: string) => {
    const trimmedInterest = interest.trim();
    if (trimmedInterest && !selectedInterests.includes(trimmedInterest) && selectedInterests.length < 10) {
      setSelectedInterests([...selectedInterests, trimmedInterest]);
      setInterestSearch("");
    }
  };

  const removeInterest = (interest: string) => {
    setSelectedInterests(selectedInterests.filter(i => i !== interest));
  };

  const handleSubmit = () => {
    if (selectedSkills.length === 0) {
      setError("Please select at least 1 skill");
      return;
    }
    if (selectedInterests.length === 0) {
      setError("Please select at least 1 interest");
      return;
    }
    setError(null);
    onComplete({ skills: selectedSkills, interests: selectedInterests });
  };

  const filteredSkills = availableSkills.filter(skill =>
    skill.name.toLowerCase().includes(skillSearch.toLowerCase()) &&
    !selectedSkills.includes(skill.name)
  );

  const filteredInterests = availableInterests.filter(interest =>
    interest.name.toLowerCase().includes(interestSearch.toLowerCase()) &&
    !selectedInterests.includes(interest.name)
  );

  const topSkills = availableSkills
    .filter(skill => !selectedSkills.includes(skill.name))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topInterests = availableInterests
    .filter(interest => !selectedInterests.includes(interest.name))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Skills & Interests</CardTitle>
          <CardDescription>Loading suggestions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Skills & Interests
        </CardTitle>
        <CardDescription>
          Select your skills and interests to help us connect you with the right people.
          Choose 1-10 items for each category.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Skills Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <Label className="text-base font-medium">
              Skills ({selectedSkills.length}/10)
            </Label>
          </div>

          {/* Selected Skills */}
          {selectedSkills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedSkills.map((skill) => (
                <Badge key={skill} variant="default" className="px-3 py-1">
                  {skill}
                  <button
                    onClick={() => removeSkill(skill)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Skill Search */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search or add a skill..."
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && skillSearch.trim()) {
                    addSkill(skillSearch);
                  }
                }}
                className="pl-10"
                disabled={selectedSkills.length >= 10}
              />
              {skillSearch.trim() && (
                <Button
                  size="sm"
                  onClick={() => addSkill(skillSearch)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6"
                  disabled={selectedSkills.length >= 10}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Filtered Skills Suggestions */}
            {skillSearch && filteredSkills.length > 0 && (
              <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                {filteredSkills.slice(0, 5).map((skill) => (
                  <button
                    key={skill.name}
                    onClick={() => addSkill(skill.name)}
                    className="block w-full text-left px-2 py-1 hover:bg-muted rounded text-sm"
                    disabled={selectedSkills.length >= 10}
                  >
                    {skill.name} <span className="text-muted-foreground">({skill.count})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Popular Skills */}
          {!skillSearch && topSkills.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Popular Skills</Label>
              <div className="flex flex-wrap gap-2">
                {topSkills.map((skill) => (
                  <Button
                    key={skill.name}
                    variant="outline"
                    size="sm"
                    onClick={() => addSkill(skill.name)}
                    disabled={selectedSkills.length >= 10}
                    className="h-8"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {skill.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Interests Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            <Label className="text-base font-medium">
              Interests ({selectedInterests.length}/10)
            </Label>
          </div>

          {/* Selected Interests */}
          {selectedInterests.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedInterests.map((interest) => (
                <Badge key={interest} variant="secondary" className="px-3 py-1">
                  {interest}
                  <button
                    onClick={() => removeInterest(interest)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Interest Search */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search or add an interest..."
                value={interestSearch}
                onChange={(e) => setInterestSearch(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && interestSearch.trim()) {
                    addInterest(interestSearch);
                  }
                }}
                className="pl-10"
                disabled={selectedInterests.length >= 10}
              />
              {interestSearch.trim() && (
                <Button
                  size="sm"
                  onClick={() => addInterest(interestSearch)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6"
                  disabled={selectedInterests.length >= 10}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Filtered Interests Suggestions */}
            {interestSearch && filteredInterests.length > 0 && (
              <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                {filteredInterests.slice(0, 5).map((interest) => (
                  <button
                    key={interest.name}
                    onClick={() => addInterest(interest.name)}
                    className="block w-full text-left px-2 py-1 hover:bg-muted rounded text-sm"
                    disabled={selectedInterests.length >= 10}
                  >
                    {interest.name} <span className="text-muted-foreground">({interest.count})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Popular Interests */}
          {!interestSearch && topInterests.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Popular Interests</Label>
              <div className="flex flex-wrap gap-2">
                {topInterests.map((interest) => (
                  <Button
                    key={interest.name}
                    variant="outline"
                    size="sm"
                    onClick={() => addInterest(interest.name)}
                    disabled={selectedInterests.length >= 10}
                    className="h-8"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {interest.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Continue Button */}
        <Button
          onClick={handleSubmit}
          className="w-full"
          disabled={selectedSkills.length === 0 || selectedInterests.length === 0}
        >
          Continue to Account Creation
        </Button>

        {/* Helper Text */}
        <div className="text-sm text-muted-foreground text-center space-y-1">
          <p>Minimum 1 skill and 1 interest required</p>
          <p>Maximum 10 items per category</p>
        </div>
      </CardContent>
    </Card>
  );
}

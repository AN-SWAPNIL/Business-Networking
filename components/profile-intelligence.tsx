"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Sparkles, RefreshCw } from "lucide-react";
import { triggerProfileIntelligence, getProfileIntelligence } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ProfileIntelligenceProps {
  userProfile?: {
    name?: string;
    title?: string;
    company?: string;
    location?: string;
    bio?: string;
    website?: string;
    preferences?: {
      mentor: boolean;
      invest: boolean;
      discuss: boolean;
      collaborate: boolean;
      hire: boolean;
    };
  };
}

export function ProfileIntelligence({ userProfile }: ProfileIntelligenceProps) {
  const [intelligence, setIntelligence] = useState<{
    hasIntelligence: boolean;
    summary?: string;
    analysis?: string;
    lastUpdated?: string;
  }>({ hasIntelligence: false });

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();

  // Load existing intelligence data on component mount
  useEffect(() => {
    loadIntelligence();
  }, []);

  const loadIntelligence = async () => {
    setIsLoading(true);
    try {
      const result = await getProfileIntelligence();
      console.log("🔍 GET response:", result);

      if (result.success) {
        console.log("✅ Setting intelligence state:", {
          hasIntelligence: result.hasIntelligence,
          summary: result.summary?.substring(0, 100) + "...",
          analysis: result.analysis?.substring(0, 100) + "...",
          lastUpdated: result.lastUpdated,
        });

        setIntelligence({
          hasIntelligence: result.hasIntelligence,
          summary: result.summary,
          analysis: result.analysis,
          lastUpdated: result.lastUpdated,
        });
      } else {
        console.log("❌ GET failed:", result.error);
      }
    } catch (error) {
      console.error("Failed to load intelligence:", error);
    } finally {
      setIsLoading(false);
      setInitialLoading(false);
    }
  };

  const handleTriggerIntelligence = async () => {
    // Check if profile has minimum required data
    if (!userProfile?.name || (!userProfile?.company && !userProfile?.title)) {
      toast({
        title: "Profile Incomplete",
        description:
          "Please add your name and either company or title to generate AI insights.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const result = await triggerProfileIntelligence();

      if (result.success) {
        // Update local state with new intelligence
        setIntelligence({
          hasIntelligence: true,
          summary: result.summary,
          analysis: result.analysis,
          lastUpdated: new Date().toISOString(),
        });

        toast({
          title: "AI Insights Generated! 🧠",
          description:
            "Your professional profile has been analyzed with AI-powered insights.",
        });
      } else {
        toast({
          title: "Failed to Generate Insights",
          description:
            result.error || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate AI insights. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (initialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Profile Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading AI insights...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Profile Intelligence
            <Badge variant="secondary" className="ml-2">
              <Sparkles className="h-3 w-3 mr-1" />
              Powered by Gemini 1.5 Flash
            </Badge>
          </CardTitle>

          <Button
            onClick={loadIntelligence}
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>

        {intelligence.lastUpdated && (
          <p className="text-sm text-muted-foreground">
            Last updated: {formatDate(intelligence.lastUpdated)}
          </p>
        )}
      </CardHeader>

      <CardContent>
        {!intelligence.hasIntelligence ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No AI Insights Yet</h3>
            <p className="text-muted-foreground mb-4">
              Generate AI-powered insights about your professional background,
              company, and networking potential.
            </p>
            <Button
              onClick={handleTriggerIntelligence}
              disabled={isProcessing}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Your Profile...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI Insights
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {intelligence.summary && (
              <div>
                <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Professional Summary
                </h4>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {intelligence.summary}
                  </p>
                </div>
              </div>
            )}

            {intelligence.analysis && (
              <div>
                <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Detailed Analysis
                </h4>
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {intelligence.analysis}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Regenerate button at the bottom for easy access */}
            {intelligence.hasIntelligence && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Want fresh insights? Regenerate your AI analysis with new
                    search data.
                  </p>
                  <Button
                    onClick={handleTriggerIntelligence}
                    disabled={isProcessing}
                    variant="outline"
                    size="sm"
                    className="ml-4"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Regenerate
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

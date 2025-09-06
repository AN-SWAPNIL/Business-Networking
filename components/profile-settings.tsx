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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bell,
  Shield,
  Eye,
  Globe,
  Trash2,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import {
  exportAccountData,
  updateAccountSettings,
  deleteAccount,
  AccountSettings,
} from "@/lib/api";

export function ProfileSettings() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    connections: true,
    messages: true,
    collaborations: true,
    mentions: false,
  });

  const [privacy, setPrivacy] = useState({
    profileVisibility: "public" as "public" | "network" | "private",
    showEmail: false,
    showPhone: false,
    allowMessages: true,
  });

  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Load user settings on component mount
  useEffect(() => {
    // In a real implementation, you would fetch the user's current settings
    // For now, we'll use the default values
  }, []);

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }));
  };

  const handlePrivacyChange = (key: string, value: boolean | string) => {
    setPrivacy((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const settings: AccountSettings = {
        notifications,
        privacy,
      };

      const result = await updateAccountSettings(settings);

      if (result.success) {
        setSuccess("Settings saved successfully!");
      } else {
        setError(result.error || "Failed to save settings");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    setError("");

    try {
      const result = await exportAccountData();

      if (result.success && result.data) {
        // Create downloadable file
        const dataStr = JSON.stringify(result.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);

        // Create download link
        const link = document.createElement("a");
        link.href = url;
        link.download = `my-profile-data-${
          new Date().toISOString().split("T")[0]
        }.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setSuccess("Data exported successfully!");
      } else {
        setError(result.error || "Failed to export data");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setError("");

    try {
      const result = await deleteAccount(true);

      if (result.success) {
        // Sign out and redirect
        await signOut();
        router.push("/?message=account_deleted");
      } else {
        setError(result.error || "Failed to delete account");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center font-serif">
            <Bell className="w-5 h-5 mr-2" />
            Notifications
          </CardTitle>
          <CardDescription>
            Choose what notifications you'd like to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              checked={notifications.email}
              onCheckedChange={(checked) =>
                handleNotificationChange("email", checked)
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive push notifications on your device
              </p>
            </div>
            <Switch
              checked={notifications.push}
              onCheckedChange={(checked) =>
                handleNotificationChange("push", checked)
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>New Connections</Label>
              <p className="text-sm text-muted-foreground">
                When someone connects with you
              </p>
            </div>
            <Switch
              checked={notifications.connections}
              onCheckedChange={(checked) =>
                handleNotificationChange("connections", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Messages</Label>
              <p className="text-sm text-muted-foreground">
                When you receive new messages
              </p>
            </div>
            <Switch
              checked={notifications.messages}
              onCheckedChange={(checked) =>
                handleNotificationChange("messages", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Collaboration Requests</Label>
              <p className="text-sm text-muted-foreground">
                When someone wants to collaborate
              </p>
            </div>
            <Switch
              checked={notifications.collaborations}
              onCheckedChange={(checked) =>
                handleNotificationChange("collaborations", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Mentions</Label>
              <p className="text-sm text-muted-foreground">
                When someone mentions you
              </p>
            </div>
            <Switch
              checked={notifications.mentions}
              onCheckedChange={(checked) =>
                handleNotificationChange("mentions", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center font-serif">
            <Shield className="w-5 h-5 mr-2" />
            Privacy & Visibility
          </CardTitle>
          <CardDescription>
            Control who can see your profile and contact information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Profile Visibility</Label>
            <Select
              value={privacy.profileVisibility}
              onValueChange={(value) =>
                handlePrivacyChange("profileVisibility", value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center">
                    <Globe className="w-4 h-4 mr-2" />
                    Public - Anyone can view your profile
                  </div>
                </SelectItem>
                <SelectItem value="network">
                  <div className="flex items-center">
                    <Eye className="w-4 h-4 mr-2" />
                    Network Only - Only your connections can view
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center">
                    <Shield className="w-4 h-4 mr-2" />
                    Private - Only you can view your profile
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Show Email Address</Label>
              <p className="text-sm text-muted-foreground">
                Display your email on your public profile
              </p>
            </div>
            <Switch
              checked={privacy.showEmail}
              onCheckedChange={(checked) =>
                handlePrivacyChange("showEmail", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Show Phone Number</Label>
              <p className="text-sm text-muted-foreground">
                Display your phone number on your public profile
              </p>
            </div>
            <Switch
              checked={privacy.showPhone}
              onCheckedChange={(checked) =>
                handlePrivacyChange("showPhone", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Allow Direct Messages</Label>
              <p className="text-sm text-muted-foreground">
                Let others send you direct messages
              </p>
            </div>
            <Switch
              checked={privacy.allowMessages}
              onCheckedChange={(checked) =>
                handlePrivacyChange("allowMessages", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Account Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center font-serif text-destructive">
            <Trash2 className="w-5 h-5 mr-2" />
            Account Management
          </CardTitle>
          <CardDescription>
            Manage your account data and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start bg-transparent"
              onClick={handleExportData}
              disabled={exportLoading}
            >
              {exportLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export My Data
            </Button>
            <Separator />
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteLoading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. All your data will be permanently
              deleted.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button size="lg" onClick={handleSaveSettings} disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save All Settings
        </Button>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Account"
        description="Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently delete all your data, connections, and messages."
        confirmText="Delete Account"
        cancelText="Cancel"
        onConfirm={handleDeleteAccount}
        loading={deleteLoading}
        destructive={true}
      />
    </div>
  );
}

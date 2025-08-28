"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>CSV User Import</CardTitle>
            <CardDescription>
              Bulk import users from CSV files with AI-generated profiles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Import users from the BUETians database with automatically
              generated bios and preferences using AI.
            </p>
            <Link href="/admin/csv-import">
              <Button>Start Import</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View and manage imported users</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Browse through the imported users and see their AI-generated
              profiles.
            </p>
            <Link href="/admin/users">
              <Button variant="outline">Manage Users</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>System Features</CardTitle>
          <CardDescription>What this CSV import system does</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>✅ Parses CSV files with BUET alumni data</li>
            <li>🤖 Uses Google Gemini AI to generate profile info</li>
            <li>👤 Creates anonymous Supabase users for each person</li>
            <li>
              🧠 Triggers profile intelligence analysis for deeper insights
            </li>
            <li>📊 Handles errors gracefully and provides detailed feedback</li>
            <li>🔄 Avoids duplicate imports by checking email addresses</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

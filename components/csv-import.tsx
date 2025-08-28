import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface ImportResult {
  success: boolean;
  message: string;
  summary: {
    processed: number;
    created: number;
    errors: number;
  };
  errors: Array<{
    row: number;
    name: string;
    error: string;
  }>;
}

interface ImportStats {
  totalUsers: number;
  recentUsers: number;
  lastUpdated: string;
}

export default function CSVImport() {
  const [csvContent, setCsvContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  React.useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/csv-import");
      if (response.ok) {
        const data = await response.json();
        setStats(data.statistics);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvContent(content);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!csvContent.trim()) {
      alert("Please provide CSV content or upload a file");
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      const response = await fetch("/api/csv-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csvContent }),
      });

      const data = await response.json();
      setResult(data);

      // Refresh stats after import
      await fetchStats();
    } catch (error) {
      setResult({
        success: false,
        message: "Network error occurred",
        summary: { processed: 0, created: 0, errors: 1 },
        errors: [
          {
            row: 0,
            name: "Network",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const loadSampleCSV = () => {
    const sampleCSV = `Timestamp,Name,"BUET Department (e.g., CE, EEE, ME, URP, etc)","BUET Student ID (e.g., 1706065, 0204023 etc)",Email,Phone Number,Current Company Name,Current Job Title/Position ,"Department/Function (e.g., Engineering, Sales, SCM, Project Management, etc.)","Industry Type (e.g., Power, FMCG, Tech, Telco, Consultancy, etc.)  ","Current Job Location (e.g., Dhaka, Rangpur, Chittagong, etc.)",Are you open to being contacted for help/referrals? (Yes / No)  ,Any suggestions or ideas to improve this initiative? 
4/20/2025 19:25:16,John Doe,EEE,1706001,john.doe@example.com,01785359083,ATLAS ELEVATOR LIMITED,Business Development Manager,Business Development,Construction (Lift/Escalator),Dhaka,Yes,Test import
4/20/2025 20:18:07,Jane Smith,CSE,1906001,jane.smith@example.com,01531531335,ACI,ML Engineer,AI team (MIS),Tech,Tejgaon,Yes,Sample user`;
    setCsvContent(sampleCSV);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">CSV User Import</h1>
        <p className="text-muted-foreground">
          Import users from CSV file and generate AI-powered profiles
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Database Statistics</CardTitle>
            <CardDescription>
              Current user count and recent imports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.recentUsers}</p>
                <p className="text-sm text-muted-foreground">Added Last 24h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV Input */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>CSV Data Input</CardTitle>
          <CardDescription>
            Upload a CSV file or paste CSV content directly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="csv-file"
              className="block text-sm font-medium mb-2"
            >
              Upload CSV File
            </label>
            <input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="text-center">
            <span className="text-sm text-muted-foreground">or</span>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label
                htmlFor="csv-content"
                className="block text-sm font-medium"
              >
                CSV Content
              </label>
              <Button variant="outline" size="sm" onClick={loadSampleCSV}>
                Load Sample Data
              </Button>
            </div>
            <Textarea
              id="csv-content"
              placeholder="Paste your CSV content here..."
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Import Button */}
      <div className="mb-6">
        <Button
          onClick={handleImport}
          disabled={isImporting || !csvContent.trim()}
          className="w-full"
          size="lg"
        >
          {isImporting ? "Importing Users..." : "Start Import"}
        </Button>
      </div>

      {/* Progress Indicator */}
      {isImporting && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing CSV data...</span>
                <span>Please wait</span>
              </div>
              <Progress value={undefined} className="w-full" />
              <p className="text-xs text-muted-foreground text-center">
                This may take several minutes depending on the number of users
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Import Results
              <Badge variant={result.success ? "default" : "destructive"}>
                {result.success ? "Success" : "Partial"}
              </Badge>
            </CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {result.summary.processed}
                </p>
                <p className="text-sm text-muted-foreground">Processed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {result.summary.created}
                </p>
                <p className="text-sm text-muted-foreground">Created</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {result.summary.errors}
                </p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>

            {/* Success Message */}
            {result.success && (
              <Alert>
                <AlertDescription>
                  ✅ All users imported successfully! Profile intelligence
                  analysis has been processed for each user.
                </AlertDescription>
              </Alert>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-red-600">
                    Errors ({result.errors.length})
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowErrors(!showErrors)}
                  >
                    {showErrors ? "Hide" : "Show"} Errors
                  </Button>
                </div>

                {showErrors && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {result.errors.map((error, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertDescription>
                          <strong>
                            Row {error.row} ({error.name}):
                          </strong>{" "}
                          {error.error}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

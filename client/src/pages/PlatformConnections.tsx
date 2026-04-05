import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink, CheckCircle } from "lucide-react";

export default function PlatformConnections() {
  return (
    <DashboardLayout>
      <PlatformConnectionsContent />
    </DashboardLayout>
  );
}

function PlatformConnectionsContent() {
  const platforms = [
    {
      id: "facebook",
      name: "Facebook",
      description: "Schedule posts directly to your Facebook Page",
      url: "https://business.facebook.com/creatorstudio",
      icon: "📘",
      color: "bg-blue-600",
    },
    {
      id: "instagram",
      name: "Instagram",
      description: "Schedule posts directly to your Instagram Business Account",
      url: "https://instagram.com",
      icon: "📷",
      color: "bg-pink-600",
    },
    {
      id: "tiktok",
      name: "TikTok",
      description: "Upload and schedule videos directly to TikTok",
      url: "https://www.tiktok.com/upload",
      icon: "🎵",
      color: "bg-black",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Connections</h1>
        <p className="text-muted-foreground mt-2">
          No tokens or API setup needed. Use each platform's native scheduler directly.
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900 dark:text-blue-100">
          <p className="font-medium mb-1">How it works:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Generate content in the AI Generator</li>
            <li>Go to Publishing and select your platforms</li>
            <li>Click the platform button to open their native scheduler</li>
            <li>Your caption is automatically copied — paste it in and schedule</li>
            <li>Mark as published when done</li>
          </ol>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platforms.map((platform) => (
          <Card key={platform.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{platform.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {platform.description}
                  </p>
                </div>
                <Badge variant="outline" className="ml-2">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Ready
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    What you need:
                  </p>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {platform.id === "facebook" && (
                      <>
                        <li>✓ Facebook Business Account</li>
                        <li>✓ Facebook Page</li>
                        <li>✓ Creator Studio access</li>
                      </>
                    )}
                    {platform.id === "instagram" && (
                      <>
                        <li>✓ Instagram Business Account</li>
                        <li>✓ Instagram app or web</li>
                      </>
                    )}
                    {platform.id === "tiktok" && (
                      <>
                        <li>✓ TikTok Creator Account</li>
                        <li>✓ TikTok app or web</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              <Button
                asChild
                className="w-full mt-4 gap-2"
              >
                <a href={platform.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Open {platform.name}
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/50 border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Why no token management?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            We've simplified the connection process by using each platform's native scheduler directly. This means:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>No API tokens to manage or refresh</li>
            <li>No authentication issues or expiration</li>
            <li>Your credentials stay secure with the platform</li>
            <li>Full access to each platform's scheduling features</li>
            <li>Works reliably without technical setup</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

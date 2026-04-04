"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle, CheckCircle, Copy, ExternalLink, Loader2, PlugZap, RefreshCw, Trash2, WifiOff,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

interface PlatformGuide {
  id: "facebook" | "instagram" | "tiktok";
  label: string;
  emoji: string;
  color: string;
  description: string;
  tokenName: string;
  tokenPlaceholder: string;
  steps: { number: number; title: string; description: string; link?: string; linkText?: string }[];
  tips: string[];
}

const PLATFORM_GUIDES: PlatformGuide[] = [
  {
    id: "instagram",
    label: "Instagram",
    emoji: "📸",
    color: "text-pink-400",
    description: "Post to your Instagram Business or Creator account",
    tokenName: "Access Token",
    tokenPlaceholder: "Paste your Instagram access token here",
    steps: [
      {
        number: 1,
        title: "Go to Facebook Graph API Explorer",
        description: "This is the easiest way to get your token.",
        link: "https://developers.facebook.com/tools/explorer",
        linkText: "Open Graph API Explorer →",
      },
      {
        number: 2,
        title: "Select Your Instagram Account",
        description: "In the dropdown at the top, select your Instagram Business or Creator account.",
      },
      {
        number: 3,
        title: "Generate Token",
        description: "Click 'Generate Access Token' button. Copy the token that appears.",
      },
      {
        number: 4,
        title: "Get Your Account ID",
        description: "Go to Meta Business Suite → Settings → Instagram Accounts → Copy the numeric ID.",
        link: "https://business.facebook.com",
        linkText: "Open Meta Business Suite →",
      },
      {
        number: 5,
        title: "Paste in ContentCreator Hub",
        description: "Come back here and paste your token and account ID below.",
      },
    ],
    tips: [
      "Your token is like a password — keep it private",
      "Tokens expire after 60 days, so you may need to refresh it periodically",
      "You can revoke access anytime by disconnecting here",
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    emoji: "📘",
    color: "text-blue-400",
    description: "Post directly to your Facebook Page",
    tokenName: "Access Token",
    tokenPlaceholder: "Paste your Facebook access token here",
    steps: [
      {
        number: 1,
        title: "Go to Facebook Graph API Explorer",
        description: "Same tool as Instagram — it works for both!",
        link: "https://developers.facebook.com/tools/explorer",
        linkText: "Open Graph API Explorer →",
      },
      {
        number: 2,
        title: "Select Your Facebook Page",
        description: "In the dropdown at the top, select your Facebook Page.",
      },
      {
        number: 3,
        title: "Generate Token",
        description: "Click 'Generate Access Token' button. Copy the token.",
      },
      {
        number: 4,
        title: "Get Your Page ID",
        description: "Go to your Facebook Page → Settings → About → Find 'Page ID' and copy it.",
      },
      {
        number: 5,
        title: "Paste in ContentCreator Hub",
        description: "Come back here and paste your token and page ID below.",
      },
    ],
    tips: [
      "Make sure you're logged into the Facebook account that owns the page",
      "Your token is like a password — keep it private",
      "You can use the same token for both Facebook and Instagram if you want",
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    emoji: "🎵",
    color: "text-cyan-400",
    description: "Post videos to your TikTok for Business account",
    tokenName: "Access Token",
    tokenPlaceholder: "Paste your TikTok access token here",
    steps: [
      {
        number: 1,
        title: "Go to TikTok for Business",
        description: "Create or log into your TikTok for Business account.",
        link: "https://business.tiktok.com",
        linkText: "Open TikTok for Business →",
      },
      {
        number: 2,
        title: "Go to Creator Center",
        description: "Click your profile → Creator Center → Tools → API",
      },
      {
        number: 3,
        title: "Create an App",
        description: "Click 'Create App' and fill in the basic info about your app.",
      },
      {
        number: 4,
        title: "Generate Access Token",
        description: "In your app settings, click 'Generate Access Token' and copy it.",
      },
      {
        number: 5,
        title: "Paste in ContentCreator Hub",
        description: "Come back here and paste your token below.",
      },
    ],
    tips: [
      "TikTok requires video content — text-only posts won't work",
      "Your token is like a password — keep it private",
      "Make sure your account is a TikTok for Business account (not a personal account)",
    ],
  },
];

export default function PlatformConnections() {
  return (
    <DashboardLayout>
      <PlatformConnectionsContent />
    </DashboardLayout>
  );
}

function PlatformConnectionsContent() {
  const { data: connections, isLoading } = trpc.publish.platforms.useQuery();
  const utils = trpc.useUtils();
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [activeTab, setActiveTab] = useState("instagram");

  const connectMutation = trpc.publish.connectPlatform.useMutation({
    onSuccess: () => {
      utils.publish.platforms.invalidate();
      toast.success("✓ Platform connected!");
    },
    onError: (e) => toast.error("Connection failed: " + e.message),
  });

  const disconnectMutation = trpc.publish.disconnectPlatform.useMutation({
    onSuccess: (_, vars) => {
      utils.publish.platforms.invalidate();
      setTestResults((prev) => ({ ...prev, [vars.platform]: null }));
      toast.success("Platform disconnected");
    },
    onError: (e) => toast.error(e.message),
  });

  const testMutation = trpc.publish.testConnection.useMutation({
    onSuccess: (data, vars) => {
      setTestResults((prev) => ({ ...prev, [vars.platform]: { success: data.success, message: data.message } }));
      if (data.success) toast.success("✓ " + data.message);
      else toast.error(data.message);
    },
    onError: (e, vars) => {
      setTestResults((prev) => ({ ...prev, [vars.platform]: { success: false, message: e.message } }));
      toast.error(e.message);
    },
  });

  const getConnection = (platformId: string) =>
    (connections ?? []).find((c: any) => c.platform === platformId && c.isActive);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-semibold flex items-center gap-3 mb-2">
          <PlugZap className="w-7 h-7 text-primary" />
          Connect Your Accounts
        </h1>
        <p className="text-muted-foreground">
          Follow the simple steps below to connect your social media accounts. Each team member connects their own accounts.
        </p>
      </div>

      {/* Security Banner */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
        <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-primary font-medium">Your credentials are safe</span> — stored securely and only used to post on your behalf. No other team members can see your tokens.
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {PLATFORM_GUIDES.map((guide) => (
            <TabsTrigger key={guide.id} value={guide.id} className="flex items-center gap-2">
              <span className="text-lg">{guide.emoji}</span>
              <span className="hidden sm:inline">{guide.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {PLATFORM_GUIDES.map((guide) => {
          const conn = getConnection(guide.id);
          const testResult = testResults[guide.id];

          return (
            <TabsContent key={guide.id} value={guide.id} className="space-y-6 mt-6">
              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Steps */}
                <div className="space-y-4">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <span className="text-2xl">{guide.emoji}</span>
                    How to Get Your {guide.label} Token
                  </h2>

                  <div className="space-y-3">
                    {guide.steps.map((step) => (
                      <div key={step.number} className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-semibold text-sm text-primary">
                          {step.number}
                        </div>
                        <div className="flex-1 pt-0.5">
                          <h3 className="font-medium text-sm">{step.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                          {step.link && (
                            <a
                              href={step.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                            >
                              {step.linkText}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tips */}
                  <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border/50">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">💡 Tips</h4>
                    <ul className="space-y-1">
                      {guide.tips.map((tip, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2">
                          <span className="text-primary">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right: Connection Form */}
                <div>
                  <ConnectionCard
                    guide={guide}
                    connection={conn}
                    testResult={testResult}
                    onConnect={(data) => connectMutation.mutate({ platform: guide.id, ...data })}
                    onDisconnect={() => disconnectMutation.mutate({ platform: guide.id })}
                    onTest={() => testMutation.mutate({ platform: guide.id })}
                    isConnecting={connectMutation.isPending && connectMutation.variables?.platform === guide.id}
                    isDisconnecting={disconnectMutation.isPending && disconnectMutation.variables?.platform === guide.id}
                    isTesting={testMutation.isPending && testMutation.variables?.platform === guide.id}
                  />
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

interface ConnectionCardProps {
  guide: PlatformGuide;
  connection: any;
  testResult: { success: boolean; message: string } | null;
  onConnect: (data: any) => void;
  onDisconnect: () => void;
  onTest: () => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isTesting: boolean;
}

function ConnectionCard({
  guide,
  connection,
  testResult,
  onConnect,
  onDisconnect,
  onTest,
  isConnecting,
  isDisconnecting,
  isTesting,
}: ConnectionCardProps) {
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");

  const handleConnect = () => {
    if (!token.trim()) {
      toast.error("Please paste your access token");
      return;
    }
    onConnect({
      accessToken: token,
      accountId: accountId || undefined,
      accountName: accountName || undefined,
    });
  };

  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Your {guide.label} Account</span>
          {connection && <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Connected</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection ? (
          <>
            {/* Connected State */}
            <div className="space-y-3">
              {connection.accountName && (
                <div>
                  <p className="text-xs text-muted-foreground">Account</p>
                  <p className="text-sm font-medium">{connection.accountName}</p>
                </div>
              )}
              {connection.accountId && (
                <div>
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="text-xs font-mono text-muted-foreground">{connection.accountId}</p>
                </div>
              )}

              {/* Test Result */}
              {testResult && (
                <div className={`p-3 rounded-lg text-xs ${testResult.success ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
                  {testResult.success ? "✓ Connection working" : "✗ " + testResult.message}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onTest}
                  disabled={isTesting}
                  className="flex-1"
                >
                  {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Test
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDisconnect}
                  disabled={isDisconnecting}
                  className="flex-1 text-red-400 hover:text-red-300"
                >
                  {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <WifiOff className="w-3 h-3" />}
                  Disconnect
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Disconnected State */}
            <div className="space-y-3">
              <div>
                <Label htmlFor={`token-${guide.id}`} className="text-xs">
                  {guide.tokenName}
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id={`token-${guide.id}`}
                    type="password"
                    placeholder={guide.tokenPlaceholder}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="text-xs"
                    disabled={isConnecting}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.readText().then((text) => setToken(text));
                      toast.success("Pasted from clipboard");
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {guide.id !== "tiktok" && (
                <div>
                  <Label htmlFor={`account-id-${guide.id}`} className="text-xs">
                    Account ID
                  </Label>
                  <Input
                    id={`account-id-${guide.id}`}
                    placeholder="Numeric ID"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="text-xs mt-1"
                    disabled={isConnecting}
                  />
                </div>
              )}

              <div>
                <Label htmlFor={`account-name-${guide.id}`} className="text-xs">
                  Account Name (optional)
                </Label>
                <Input
                  id={`account-name-${guide.id}`}
                  placeholder="e.g., My Business"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="text-xs mt-1"
                  disabled={isConnecting}
                />
              </div>

              <Button
                onClick={handleConnect}
                disabled={isConnecting || !token.trim()}
                className="w-full"
              >
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlugZap className="w-4 h-4 mr-2" />}
                Connect {guide.label}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

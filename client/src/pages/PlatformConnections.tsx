import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle, CheckCircle, ChevronDown, ChevronUp, ExternalLink,
  Loader2, PlugZap, RefreshCw, Trash2, Wifi, WifiOff,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PlatformConfig {
  id: "facebook" | "instagram" | "tiktok";
  label: string;
  emoji: string;
  color: string;
  borderColor: string;
  description: string;
  fields: {
    key: "accessToken" | "accountId" | "accountName";
    label: string;
    placeholder: string;
    type?: string;
    required: boolean;
    helpText: string;
  }[];
  docsUrl: string;
  docsLabel: string;
  setupSteps: string[];
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    id: "instagram",
    label: "Instagram",
    emoji: "📸",
    color: "text-pink-400",
    borderColor: "border-pink-400/20",
    description: "Publish posts and reels to your Instagram Business or Creator account.",
    fields: [
      {
        key: "accountName",
        label: "Instagram Username",
        placeholder: "@yourbusiness",
        required: true,
        helpText: "Your Instagram handle (for display only)",
      },
      {
        key: "accountId",
        label: "Instagram Business Account ID",
        placeholder: "17841400000000000",
        required: true,
        helpText: "Your numeric Instagram Business/Creator Account ID from Meta Business Suite",
      },
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "EAABsbCS...",
        type: "password",
        required: true,
        helpText: "User Access Token with instagram_basic and instagram_content_publish permissions",
      },
    ],
    docsUrl: "https://developers.facebook.com/docs/instagram-api/getting-started",
    docsLabel: "Instagram Graph API Setup",
    setupSteps: [
      "Go to Meta for Developers → Create an App",
      "Add the Instagram Graph API product",
      "Connect your Instagram Business/Creator account",
      "Generate a User Access Token with instagram_basic + instagram_content_publish scopes",
      "Find your Account ID in Meta Business Suite → Settings → Instagram Accounts",
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    emoji: "📘",
    color: "text-blue-400",
    borderColor: "border-blue-400/20",
    description: "Publish posts directly to your Facebook Page.",
    fields: [
      {
        key: "accountName",
        label: "Facebook Page Name",
        placeholder: "My Business Page",
        required: true,
        helpText: "The name of your Facebook Page (for display only)",
      },
      {
        key: "accountId",
        label: "Page ID",
        placeholder: "123456789012345",
        required: true,
        helpText: "Your Facebook Page ID — found in Page Settings → About → Page ID",
      },
      {
        key: "accessToken",
        label: "Page Access Token",
        placeholder: "EAABsbCS...",
        type: "password",
        required: true,
        helpText: "Page Access Token with pages_manage_posts and pages_read_engagement permissions",
      },
    ],
    docsUrl: "https://developers.facebook.com/docs/pages-api/posts",
    docsLabel: "Facebook Pages API Setup",
    setupSteps: [
      "Go to Meta for Developers → Create an App",
      "Add the Facebook Login product",
      "Request pages_manage_posts and pages_read_engagement permissions",
      "Generate a Page Access Token for your specific Page",
      "Find your Page ID in Facebook Page Settings → About",
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    emoji: "🎵",
    color: "text-cyan-400",
    borderColor: "border-cyan-400/20",
    description: "Publish video content to your TikTok for Business account.",
    fields: [
      {
        key: "accountName",
        label: "TikTok Username",
        placeholder: "@yourbusiness",
        required: true,
        helpText: "Your TikTok handle (for display only)",
      },
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "act.example...",
        type: "password",
        required: true,
        helpText: "OAuth2 Access Token with video.publish scope from TikTok for Business",
      },
    ],
    docsUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started",
    docsLabel: "TikTok Content Posting API",
    setupSteps: [
      "Go to TikTok for Developers → Create an App",
      "Add the Content Posting API product",
      "Complete the app review process",
      "Generate an OAuth2 Access Token with video.publish scope",
      "Note: TikTok requires video content — text-only posts are not supported",
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

  const connectMutation = trpc.publish.connectPlatform.useMutation({
    onSuccess: () => {
      utils.publish.platforms.invalidate();
      toast.success("Platform connected successfully!");
    },
    onError: (e) => toast.error(e.message),
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
      if (data.success) toast.success(data.message);
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold flex items-center gap-3">
          <PlugZap className="w-6 h-6 text-primary" />
          Platform Connections
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your own social media accounts to publish content directly from ContentCreator Hub.
          Each team member connects their own accounts independently.
        </p>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-primary font-medium">Your credentials are stored securely</span> and only used
          to publish on your behalf. Each team member manages their own platform connections.
          Access tokens are never shared with other team members.
        </div>
      </div>

      {/* Platform Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-card/50 border border-border/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {PLATFORM_CONFIGS.map((platform) => {
            const conn = getConnection(platform.id);
            return (
              <PlatformCard
                key={platform.id}
                config={platform}
                connection={conn}
                testResult={testResults[platform.id] ?? null}
                onConnect={(data) => connectMutation.mutate({ platform: platform.id, ...data })}
                onDisconnect={() => disconnectMutation.mutate({ platform: platform.id })}
                onTest={() => testMutation.mutate({ platform: platform.id })}
                isConnecting={connectMutation.isPending}
                isDisconnecting={disconnectMutation.isPending}
                isTesting={testMutation.isPending && testMutation.variables?.platform === platform.id}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlatformCard({
  config,
  connection,
  testResult,
  onConnect,
  onDisconnect,
  onTest,
  isConnecting,
  isDisconnecting,
  isTesting,
}: {
  config: PlatformConfig;
  connection: any;
  testResult: { success: boolean; message: string } | null;
  onConnect: (data: { accountName: string; accessToken: string; accountId?: string }) => void;
  onDisconnect: () => void;
  onTest: () => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isTesting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const handleTest = () => {
    onTest();
  };

  const isConnected = !!connection;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const required = config.fields.filter((f) => f.required);
    for (const field of required) {
      if (!formData[field.key]?.trim()) {
        toast.error(`${field.label} is required`);
        return;
      }
    }
    onConnect({
      accountName: formData.accountName ?? "",
      accessToken: formData.accessToken ?? "",
      accountId: formData.accountId,
    });
    setExpanded(false);
    setFormData({});
  };

  return (
    <Card className={`bg-card border-border/50 transition-all ${isConnected ? `border-l-2 ${config.borderColor}` : ""}`}>
      <CardContent className="p-5">
        {/* Platform Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{config.label}</h3>
                {isConnected ? (
                  <Badge className="bg-green-400/10 text-green-400 border-green-400/20 text-[10px] gap-1">
                    <CheckCircle className="w-2.5 h-2.5" />
                    Connected
                  </Badge>
                ) : (
                  <Badge className="bg-secondary text-muted-foreground border-border/40 text-[10px] gap-1">
                    <WifiOff className="w-2.5 h-2.5" />
                    Not Connected
                  </Badge>
                )}
              </div>
              {isConnected ? (
                <div className="mt-0.5 space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    Account: <span className="text-foreground font-medium">{connection.accountName}</span>
                  </p>
                  {testResult && (
                    <p className={`text-[10px] flex items-center gap-1 ${testResult.success ? "text-green-400" : "text-destructive"}`}>
                      {testResult.success ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                      {testResult.message}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting}
                  className="border-border/50 text-xs h-7 px-2.5 gap-1.5"
                >
                  {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                  Test
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExpanded(!expanded)}
                  className="border-border/50 text-xs h-7 px-2.5 gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Update
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDisconnect}
                  disabled={isDisconnecting}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-7 px-2.5 gap-1.5"
                >
                  {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Disconnect
                </Button>
              </>
            )}
            {!isConnected && (
              <Button
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="bg-primary text-primary-foreground text-xs h-7 px-3 gap-1.5"
              >
                <PlugZap className="w-3 h-3" />
                Connect
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            )}
          </div>
        </div>

        {/* Expandable Form */}
        {expanded && (
          <div className="mt-5 pt-5 border-t border-border/40 space-y-4">
            {/* Setup Guide Toggle */}
            <button
              onClick={() => setShowSetup(!showSetup)}
              className="flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              How to get your {config.label} credentials
              {showSetup ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showSetup && (
              <div className="p-4 rounded-xl bg-accent/20 border border-border/30 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground">Setup Steps</p>
                  <a
                    href={config.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    {config.docsLabel}
                  </a>
                </div>
                <ol className="space-y-1.5">
                  {config.setupSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-semibold mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Credential Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {config.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Input
                    type={field.type ?? "text"}
                    placeholder={field.placeholder}
                    value={formData[field.key] ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="bg-input border-border/50 text-sm h-9"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-muted-foreground/70">{field.helpText}</p>
                </div>
              ))}

              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isConnecting}
                  className="bg-primary text-primary-foreground gap-1.5 text-xs"
                >
                  {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  {isConnected ? "Update Credentials" : `Connect ${config.label}`}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setExpanded(false); setFormData({}); }}
                  className="border-border/50 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

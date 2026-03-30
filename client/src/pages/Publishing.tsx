import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { NICHES, PLATFORMS } from "@shared/niches";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertCircle, CheckCircle, Loader2, PlugZap, RefreshCw, Send, XCircle,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Publishing() {
  return (
    <DashboardLayout>
      <PublishingContent />
    </DashboardLayout>
  );
}

function PublishingContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<number, string[]>>({});
  const [publishResults, setPublishResults] = useState<Record<number, { platform: string; success: boolean; errorMessage?: string }[]>>({});

  const { data: approvedPosts, isLoading, refetch } = trpc.content.list.useQuery({ status: "approved" });
  const { data: publishedPosts } = trpc.content.list.useQuery({ status: "published" });
  const { data: connections } = trpc.publish.platforms.useQuery();

  const utils = trpc.useUtils();

  const publishMutation = trpc.publish.post.useMutation({
    onSuccess: (data, vars) => {
      utils.content.list.invalidate();
      setPublishingId(null);
      setPublishResults((prev) => ({ ...prev, [vars.postId]: data.results }));

      const succeeded = data.results.filter((r) => r.success);
      const failed = data.results.filter((r) => !r.success);

      if (succeeded.length > 0 && failed.length === 0) {
        toast.success(`Published to ${succeeded.map((r) => r.platform).join(", ")}!`);
      } else if (succeeded.length > 0 && failed.length > 0) {
        toast.warning(`Published to ${succeeded.map((r) => r.platform).join(", ")}. Failed: ${failed.map((r) => r.platform).join(", ")}`);
      } else {
        toast.error("Publishing failed on all selected platforms");
      }
    },
    onError: (e) => {
      setPublishingId(null);
      toast.error(e.message);
    },
  });

  const togglePlatform = (postId: number, platform: string) => {
    setSelectedPlatforms((prev) => {
      const current = prev[postId] ?? [];
      return {
        ...prev,
        [postId]: current.includes(platform)
          ? current.filter((p) => p !== platform)
          : [...current, platform],
      };
    });
  };

  const handlePublish = (postId: number, platforms: string[]) => {
    setPublishingId(postId);
    setPublishResults((prev) => ({ ...prev, [postId]: [] }));
    publishMutation.mutate({ postId, platforms: platforms as any });
  };

  const getConnectionStatus = (platformId: string) => {
    const conn = (connections ?? []).find((c: any) => c.platform === platformId);
    return conn?.isActive ? conn : null;
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center py-20">
        <XCircle className="w-10 h-10 mx-auto mb-4 text-destructive/50" />
        <p className="text-muted-foreground">Admin access required to publish content</p>
        <Button className="mt-4" onClick={() => setLocation("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  const connectedCount = PLATFORMS.filter((p) => getConnectionStatus(p.id)).length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-3">
            <Send className="w-6 h-6 text-primary" />
            Publishing
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Publish approved content to your connected social media accounts
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="border-border/50 gap-2 text-sm">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Platform Connection Status */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Your Platform Connections</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLocation("/connections")}
              className="border-border/50 text-xs h-7 px-2.5 gap-1.5"
            >
              <PlugZap className="w-3 h-3" />
              Manage Connections
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "instagram", label: "Instagram", emoji: "📸" },
              { id: "facebook", label: "Facebook", emoji: "📘" },
              { id: "tiktok", label: "TikTok", emoji: "🎵" },
            ].map((platform) => {
              const conn = getConnectionStatus(platform.id);
              return (
                <div
                  key={platform.id}
                  className={`p-4 rounded-xl border transition-all ${
                    conn
                      ? "border-green-400/20 bg-green-400/5"
                      : "border-border/40 bg-card/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{platform.emoji}</span>
                      <span className="font-medium text-sm">{platform.label}</span>
                    </div>
                    {conn ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </div>
                  {conn ? (
                    <p className="text-xs text-green-400/80">{conn.accountName}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60">Not connected</p>
                  )}
                </div>
              );
            })}
          </div>
          {connectedCount === 0 && (
            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                No platforms connected yet.{" "}
                <button onClick={() => setLocation("/connections")} className="text-primary underline">
                  Connect your accounts
                </button>{" "}
                to start publishing.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ready to Publish */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Ready to Publish ({approvedPosts?.length ?? 0})
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-card/50 border border-border/30 animate-pulse" />
            ))}
          </div>
        ) : (approvedPosts?.length ?? 0) === 0 ? (
          <Card className="bg-card border-border/50">
            <CardContent className="py-12 text-center">
              <Send className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">No approved posts ready to publish</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Approve content in the Approval Queue first</p>
              <Button size="sm" className="mt-4 bg-primary text-primary-foreground" onClick={() => setLocation("/approval")}>
                Go to Approval Queue
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {approvedPosts?.map((post: any) => {
              const niche = NICHES.find((n) => n.id === post.niche);
              const isPublishing = publishingId === post.id;
              const postPlatforms = selectedPlatforms[post.id] ?? [];
              const results = publishResults[post.id] ?? [];

              return (
                <Card key={post.id} className="bg-card border-border/50 hover:border-primary/20 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <span className="text-2xl shrink-0 mt-0.5">{(niche as any)?.emoji ?? "📝"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{post.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{niche?.label} · {post.contentType}</p>
                        {(post.caption || post.fullContent) && (
                          <p className="text-xs text-muted-foreground/70 mt-2 line-clamp-2 leading-relaxed">
                            {post.caption || post.fullContent}
                          </p>
                        )}

                        {/* Platform selector */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {PLATFORMS.map((p) => {
                            const isSelected = postPlatforms.includes(p.id);
                            const conn = getConnectionStatus(p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => togglePlatform(post.id, p.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                  isSelected
                                    ? "border-primary/40 bg-primary/8 text-primary"
                                    : "border-border/40 text-muted-foreground hover:border-border"
                                } ${!conn ? "opacity-50" : ""}`}
                                title={!conn ? `Connect ${p.label} first` : undefined}
                              >
                                {p.id === "facebook" ? "📘" : p.id === "instagram" ? "📸" : "🎵"}
                                {p.label}
                                {conn ? (
                                  <CheckCircle className="w-2.5 h-2.5 text-green-400" />
                                ) : (
                                  <AlertCircle className="w-2.5 h-2.5 text-muted-foreground/40" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Publish results */}
                        {results.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            {results.map((r) => (
                              <div key={r.platform} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
                                r.success ? "bg-green-400/10 text-green-400" : "bg-destructive/10 text-destructive"
                              }`}>
                                {r.success ? <CheckCircle className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                                <span className="capitalize font-medium">{r.platform}:</span>
                                <span>{r.success ? "Published successfully" : r.errorMessage ?? "Failed"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Publish button */}
                      <div className="shrink-0">
                        {postPlatforms.length > 0 ? (
                          <Button
                            size="sm"
                            onClick={() => handlePublish(post.id, postPlatforms)}
                            disabled={isPublishing}
                            className="bg-primary text-primary-foreground gap-1.5 text-xs"
                          >
                            {isPublishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Publish ({postPlatforms.length})
                          </Button>
                        ) : (
                          <p className="text-xs text-muted-foreground">Select platforms →</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recently Published */}
      {(publishedPosts?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Recently Published
          </h2>
          <div className="space-y-2">
            {publishedPosts?.slice(0, 5).map((post: any) => {
              const niche = NICHES.find((n) => n.id === post.niche);
              return (
                <div key={post.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-card border border-border/30">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{(niche as any)?.emoji ?? "📝"}</span>
                    <div>
                      <p className="text-sm font-medium">{post.title}</p>
                      <p className="text-xs text-muted-foreground">{niche?.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="status-published text-[10px]">Published</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

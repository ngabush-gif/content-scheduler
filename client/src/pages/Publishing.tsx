import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { NICHES, PLATFORMS } from "@shared/niches";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CheckCircle, ExternalLink, Loader2, Send, XCircle, AlertCircle, RefreshCw,
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

  const { data: approvedPosts, isLoading, refetch } = trpc.content.list.useQuery({ status: "approved" });
  const { data: publishedPosts } = trpc.content.list.useQuery({ status: "published" });

  const utils = trpc.useUtils();

  const publishMutation = trpc.publish.post.useMutation({
    onSuccess: (data, vars) => {
      utils.content.list.invalidate();
      setPublishingId(null);
      const failed = data.results.filter((r) => !r.success);
      if (failed.length === 0) {
        toast.success(`Published to ${vars.platforms.join(", ")}!`);
      } else {
        toast.error(`Some platforms failed: ${failed.map((r) => r.platform).join(", ")}`);
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

  const handlePublish = (post: any, platforms: string[]) => {
    setPublishingId(post.id);
    publishMutation.mutate({ postId: post.id, platforms: platforms as any });
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
            Publish approved content to Facebook, Instagram and TikTok
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
          <CardTitle className="text-sm font-semibold">Platform Connections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "instagram", label: "Instagram", emoji: "📸", connected: true, note: "Connected via MCP" },
              { id: "facebook", label: "Facebook", emoji: "📘", connected: false, note: "Connect via Meta Business Suite" },
              { id: "tiktok", label: "TikTok", emoji: "🎵", connected: false, note: "Connect via TikTok for Business" },
            ].map((platform) => (
              <div
                key={platform.id}
                className={`p-4 rounded-xl border ${
                  platform.connected
                    ? "border-green-400/20 bg-green-400/5"
                    : "border-border/40 bg-card"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{platform.emoji}</span>
                    <span className="font-medium text-sm">{platform.label}</span>
                  </div>
                  {platform.connected ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{platform.note}</p>
              </div>
            ))}
          </div>
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

              return (
                <Card key={post.id} className="bg-card border-border/50 hover:border-primary/20 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="text-2xl shrink-0">{(niche as any)?.emoji ?? "📝"}</span>
                        <div className="min-w-0 flex-1">
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
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => togglePlatform(post.id, p.id)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                    isSelected
                                      ? "border-primary/40 bg-primary/8 text-primary"
                                      : "border-border/40 text-muted-foreground hover:border-border"
                                  }`}
                                >
                                  {p.id === "facebook" ? "📘" : p.id === "instagram" ? "📸" : "🎵"}
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        {postPlatforms.length > 0 ? (
                          <Button
                            size="sm"
                            onClick={() => handlePublish(post, postPlatforms)}
                            disabled={isPublishing}
                            className="bg-primary text-primary-foreground gap-1.5 text-xs"
                          >
                            {isPublishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Publish ({postPlatforms.length})
                          </Button>
                        ) : (
                          <p className="text-xs text-muted-foreground text-right">Select platforms</p>
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
                      <p className="text-xs text-muted-foreground">{niche?.label} · {post.platform}</p>
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

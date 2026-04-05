import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { NICHES, PLATFORMS } from "@shared/niches";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertCircle, Calendar, CheckCircle, Copy, ExternalLink, Loader2, Send, XCircle,
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
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<number, string[]>>({});

  const { data: approvedPosts, isLoading } = trpc.content.list.useQuery({ status: "approved" });
  const { data: publishedPosts } = trpc.content.list.useQuery({ status: "published" });

  const utils = trpc.useUtils();

  const publishMutation = trpc.publish.post.useMutation({
    onSuccess: (data, vars) => {
      utils.content.list.invalidate();
      toast.success(`Post marked as published!`);
    },
    onError: (e) => {
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const openPlatformScheduler = (platform: string, caption: string, hashtags: string) => {
    const fullText = `${caption}\n\n${hashtags}`;

    if (platform === "facebook") {
      // Open Meta Creator Studio
      const url = "https://business.facebook.com/creatorstudio";
      window.open(url, "_blank");
      // Copy text to clipboard for easy pasting
      copyToClipboard(fullText);
    } else if (platform === "instagram") {
      // Open Instagram web
      const url = "https://instagram.com";
      window.open(url, "_blank");
      copyToClipboard(fullText);
    } else if (platform === "tiktok") {
      // Open TikTok upload
      const url = "https://www.tiktok.com/upload";
      window.open(url, "_blank");
      copyToClipboard(caption); // TikTok uses captions differently
    }
  };

  const markAsPublished = (postId: number, platforms: string[]) => {
    publishMutation.mutate({ postId, platforms: platforms as any });
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center py-20">
        <XCircle className="w-10 h-10 mx-auto mb-4 text-destructive/50" />
        <h2 className="text-xl font-semibold mb-2">Admin Only</h2>
        <p className="text-muted-foreground">Only admins can publish posts.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center py-20">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  const posts = approvedPosts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Publishing</h1>
        <p className="text-muted-foreground mt-2">
          Schedule posts directly on Facebook, Instagram, and TikTok using their native schedulers.
        </p>
      </div>

      {posts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Send className="w-10 h-10 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No approved posts to publish.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setLocation("/approval-queue")}
            >
              Go to Approval Queue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const niche = NICHES.find((n) => n.id === post.niche);
            const selected = selectedPlatforms[post.id] ?? [];
            const isPublished = publishedPosts?.some((p) => p.id === post.id);

            return (
              <Card key={post.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{post.title}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        {niche && (
                          <Badge variant="outline" className="text-xs">
                            {niche.label}
                          </Badge>
                        )}
                        <Badge
                          variant={isPublished ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {isPublished ? "Published" : "Ready"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Content Preview */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium">Caption</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">{post.caption}</p>

                    {post.hashtags && (
                      <>
                        <p className="text-sm font-medium pt-2">Hashtags</p>
                        <p className="text-sm text-muted-foreground">{post.hashtags}</p>
                      </>
                    )}

                    {post.imageUrl && (
                      <>
                        <p className="text-sm font-medium pt-2">Image</p>
                        <img
                          src={post.imageUrl}
                          alt="Post preview"
                          className="w-full max-w-xs rounded-md"
                        />
                      </>
                    )}
                  </div>

                  {/* Platform Selection */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Select platforms to schedule:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PLATFORMS.map((platform) => (
                        <Button
                          key={platform.id}
                          variant={selected.includes(platform.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => togglePlatform(post.id, platform.id)}
                          className="text-xs"
                        >
                          {platform.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    {selected.length > 0 && (
                      <>
                        {selected.includes("facebook") && post.caption && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openPlatformScheduler(
                                "facebook",
                                post.caption || "",
                                post.hashtags || ""
                              )
                            }
                            className="gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Facebook Scheduler
                          </Button>
                        )}
                        {selected.includes("instagram") && post.caption && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openPlatformScheduler(
                                "instagram",
                                post.caption || "",
                                post.hashtags || ""
                              )
                            }
                            className="gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Instagram
                          </Button>
                        )}
                        {selected.includes("tiktok") && post.caption && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openPlatformScheduler("tiktok", post.caption || "", "")
                            }
                            className="gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            TikTok Upload
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => markAsPublished(post.id, selected)}
                          disabled={publishMutation.isPending}
                          className="gap-2 ml-auto"
                        >
                          {publishMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Mark Published
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Instructions */}
                  {selected.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-900 dark:text-blue-100">
                      <p className="font-medium mb-1">How it works:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Click the platform button to open the scheduler</li>
                        <li>Your caption is copied to clipboard — paste it into the platform</li>
                        <li>Add your image/video and set the schedule time</li>
                        <li>Click "Mark Published" to update the post status here</li>
                      </ol>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

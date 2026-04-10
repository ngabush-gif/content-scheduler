"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { NICHES, PLATFORMS } from "@shared/niches";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  Loader2,
  Send,
  XCircle,
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

interface PublishDialogState {
  isOpen: boolean;
  platform: string | null;
  caption: string;
  hashtags: string;
  imageUrl: string | null;
  postId: number | null;
}

function PublishingContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const [selectedPlatforms, setSelectedPlatforms] = useState<
    Record<number, string[]>
  >({});
  const [publishDialog, setPublishDialog] = useState<PublishDialogState>({
    isOpen: false,
    platform: null,
    caption: "",
    hashtags: "",
    imageUrl: null,
    postId: null,
  });
  const [copied, setCopied] = useState(false);

  const { data: approvedPosts, isLoading } = trpc.content.list.useQuery({
    status: "approved",
  });
  const { data: publishedPosts } = trpc.content.list.useQuery({
    status: "published",
  });

  const utils = trpc.useUtils();

  const publishMutation = trpc.schedule.create.useMutation({
    onSuccess: () => {
      utils.content.list.invalidate();
      toast.success("Post scheduled for publishing!");
    },
    onError: (e: any) => {
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

  const handlePublishClick = (
    platform: string,
    caption: string,
    hashtags: string,
    imageUrl: string | null,
    postId: number
  ) => {
    setPublishDialog({
      isOpen: true,
      platform,
      caption,
      hashtags,
      imageUrl,
      postId,
    });
    setCopied(false);
  };

  const copyContentToClipboard = async () => {
    const { caption, hashtags, imageUrl } = publishDialog;
    let textToCopy = caption;

    if (hashtags) {
      textToCopy = `${caption}\n\n${hashtags}`;
    }

    // Add image URL if available
    if (imageUrl) {
      textToCopy = `${textToCopy}\n\nImage: ${imageUrl}`;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy. Please copy manually from the text above.");
      console.error("Clipboard error:", error);
    }
  };

  const openPlatformAndClose = () => {
    const { platform } = publishDialog;

    if (platform === "facebook") {
      window.open("https://business.facebook.com/creatorstudio", "_blank");
    } else if (platform === "instagram") {
      window.open("https://instagram.com", "_blank");
    } else if (platform === "tiktok") {
      window.open("https://www.tiktok.com/upload", "_blank");
    }

    // Close dialog after opening platform
    setTimeout(() => {
      setPublishDialog({
        isOpen: false,
        platform: null,
        caption: "",
        hashtags: "",
        imageUrl: null,
        postId: null,
      });
    }, 500);
  };

  const markAsPublished = (postId: number, platforms: string[]) => {
    // For now, just schedule to first platform
    const platform = platforms[0] as "facebook" | "instagram" | "tiktok";
    publishMutation.mutate({
      postId,
      connectionId: 1, // TODO: Get from user's connections
      platform,
      scheduledAt: new Date(),
    });
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
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Publishing</h1>
          <p className="text-muted-foreground mt-2">
            Schedule posts directly on Facebook, Instagram, and TikTok using
            their native schedulers.
          </p>
        </div>

        {posts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Send className="w-10 h-10 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No approved posts to publish.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setLocation("/approval")}
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
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {post.caption}
                      </p>

                      {post.hashtags && (
                        <>
                          <p className="text-sm font-medium pt-2">Hashtags</p>
                          <p className="text-sm text-muted-foreground">
                            {post.hashtags}
                          </p>
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
                      <p className="text-sm font-medium">
                        Select platforms to schedule:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {PLATFORMS.map((platform) => (
                          <Button
                            key={platform.id}
                            variant={
                              selected.includes(platform.id)
                                ? "default"
                                : "outline"
                            }
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
                    <div className="flex gap-2 pt-2 flex-wrap">
                      {selected.length > 0 && (
                        <>
                          {selected.includes("facebook") && post.caption && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handlePublishClick(
                                  "facebook",
                                  post.caption || "",
                                  post.hashtags || "",
                                  post.imageUrl || null,
                                  post.id
                                )
                              }
                              className="gap-2"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Facebook
                            </Button>
                          )}
                          {selected.includes("instagram") && post.caption && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handlePublishClick(
                                  "instagram",
                                  post.caption || "",
                                  post.hashtags || "",
                                  post.imageUrl || null,
                                  post.id
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
                                handlePublishClick(
                                  "tiktok",
                                  post.caption || "",
                                  "",
                                  post.imageUrl || null,
                                  post.id
                                )
                              }
                              className="gap-2"
                            >
                              <ExternalLink className="w-4 h-4" />
                              TikTok
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
                          <li>
                            Click a platform button (Facebook, Instagram, or
                            TikTok)
                          </li>
                          <li>
                            Copy your caption and hashtags to clipboard from
                            the dialog
                          </li>
                          <li>
                            Open the platform scheduler and paste the content
                          </li>
                          <li>
                            Add your image/video and set the schedule time on
                            the platform
                          </li>
                          <li>
                            Click "Mark Published" here to update the post
                            status
                          </li>
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

      {/* Publish Instructions Dialog */}
      <Dialog
        open={publishDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPublishDialog({
              isOpen: false,
              platform: null,
              caption: "",
              hashtags: "",
              imageUrl: null,
              postId: null,
            });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Schedule on{" "}
              {publishDialog.platform
                ? publishDialog.platform.charAt(0).toUpperCase() +
                  publishDialog.platform.slice(1)
                : "Platform"}
            </DialogTitle>
            <DialogDescription>
              Copy your content and paste it into{" "}
              {publishDialog.platform || "the platform"}'s scheduler
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Content Preview */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Caption:
                </p>
                <p className="text-sm">{publishDialog.caption}</p>
              </div>

              {publishDialog.hashtags && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Hashtags:
                  </p>
                  <p className="text-sm">{publishDialog.hashtags}</p>
                </div>
              )}

              {publishDialog.imageUrl && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Image URL:
                  </p>
                  <p className="text-sm break-all text-blue-600 dark:text-blue-400">
                    {publishDialog.imageUrl}
                  </p>
                </div>
              )}
            </div>

            {/* Step-by-Step Instructions */}
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                Steps:
              </p>
              <ol className="text-xs text-blue-900 dark:text-blue-100 space-y-1 list-decimal list-inside">
                <li>Click "Copy Content" below</li>
                <li>Click "Open {publishDialog.platform?.toUpperCase()}"</li>
                <li>Paste your content (Ctrl+V or Cmd+V)</li>
                <li>Add images/videos and set schedule time</li>
                <li>Come back and click "Mark Published"</li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={copyContentToClipboard}
                className="flex-1 gap-2"
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copied!" : "Copy Content"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={openPlatformAndClose}
                className="flex-1 gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open{" "}
                {publishDialog.platform
                  ? publishDialog.platform.charAt(0).toUpperCase() +
                    publishDialog.platform.slice(1)
                  : "Platform"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              The platform will open in a new tab. Paste your content there.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

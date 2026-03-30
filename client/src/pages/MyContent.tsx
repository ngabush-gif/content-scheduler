import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { NICHES, STATUS_CONFIG } from "@shared/niches";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BookOpen, CheckCircle, Clock, Eye, FileText, Plus, Send, Trash2, Wand2, XCircle,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function MyContent() {
  return (
    <DashboardLayout>
      <MyContentView />
    </DashboardLayout>
  );
}

function MyContentView() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const isAdmin = user?.role === "admin";

  const { data: posts, isLoading, refetch } = trpc.content.list.useQuery(
    isAdmin ? { status: filterStatus === "all" ? undefined : filterStatus } : { myOnly: true }
  );

  const utils = trpc.useUtils();

  const submitMutation = trpc.content.submitForReview.useMutation({
    onSuccess: () => { utils.content.list.invalidate(); toast.success("Submitted for review!"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.content.delete.useMutation({
    onSuccess: () => { utils.content.list.invalidate(); toast.success("Post deleted"); setSelectedPost(null); },
    onError: (e) => toast.error(e.message),
  });

  const saveToLibraryMutation = trpc.content.saveToLibrary.useMutation({
    onSuccess: () => { utils.content.list.invalidate(); toast.success("Saved to library!"); },
    onError: (e) => toast.error(e.message),
  });

  const statusFilters = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "pending_review", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "published", label: "Published" },
  ];

  const filteredPosts = posts ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            {isAdmin ? "All Content" : "My Content"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "Manage all team content" : "Your drafts, submissions and published posts"}
          </p>
        </div>
        <Button
          onClick={() => setLocation("/generate")}
          className="bg-primary text-primary-foreground gap-2"
        >
          <Plus className="w-4 h-4" />
          New Content
        </Button>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filterStatus === f.value
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {f.label}
            {f.value !== "all" && (
              <span className="ml-1.5 opacity-60">
                ({filteredPosts.filter((p: any) => p.status === f.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-card/50 border border-border/30 animate-pulse" />
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="py-20 text-center">
          <Wand2 className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">No content yet.</p>
          <Button
            size="sm"
            className="mt-4 bg-primary text-primary-foreground"
            onClick={() => setLocation("/generate")}
          >
            Generate Your First Post
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPosts
            .filter((p: any) => filterStatus === "all" || p.status === filterStatus)
            .map((post: any) => {
              const niche = NICHES.find((n) => n.id === post.niche);
              const statusCfg = STATUS_CONFIG[post.status as keyof typeof STATUS_CONFIG];
              return (
                <Card
                  key={post.id}
                  className="bg-card border-border/50 hover:border-primary/20 transition-all cursor-pointer group"
                  onClick={() => setSelectedPost(post)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl">{(niche as any)?.emoji ?? "📝"}</span>
                      <Badge className={`text-[10px] shrink-0 ${statusCfg?.class ?? ""}`}>
                        {statusCfg?.label ?? post.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-medium text-sm line-clamp-2">{post.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{niche?.label} · {post.platform} · {post.contentType}</p>
                    </div>
                    {(post.caption || post.fullContent) && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {post.caption || post.fullContent}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground/60">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {post.status === "draft" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); submitMutation.mutate({ id: post.id }); }}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/60 hover:text-primary transition-colors"
                            title="Submit for review"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {post.status === "approved" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); saveToLibraryMutation.mutate({ id: post.id }); }}
                            className="p-1.5 rounded-lg hover:bg-green-400/10 text-green-400/60 hover:text-green-400 transition-colors"
                            title="Save to library"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* Post Detail Dialog */}
      {selectedPost && (
        <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
          <DialogContent className="max-w-2xl bg-card border-border max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">{selectedPost.title}</DialogTitle>
            </DialogHeader>
            <PostDetail
              post={selectedPost}
              onSubmit={() => submitMutation.mutate({ id: selectedPost.id })}
              onDelete={() => deleteMutation.mutate({ id: selectedPost.id })}
              onSaveToLibrary={() => saveToLibraryMutation.mutate({ id: selectedPost.id })}
              isSubmitting={submitMutation.isPending}
              isDeleting={deleteMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function PostDetail({ post, onSubmit, onDelete, onSaveToLibrary, isSubmitting, isDeleting }: any) {
  const niche = NICHES.find((n) => n.id === post.niche);
  const statusCfg = STATUS_CONFIG[post.status as keyof typeof STATUS_CONFIG];
  const { data: history } = trpc.content.approvalHistory.useQuery({ postId: post.id });

  return (
    <div className="space-y-4">
      {/* Meta */}
      <div className="flex flex-wrap gap-2">
        <Badge className={statusCfg?.class ?? ""}>{statusCfg?.label}</Badge>
        <Badge variant="outline" className="border-border/50">{(niche as any)?.emoji} {niche?.label}</Badge>
        <Badge variant="outline" className="border-border/50">{post.platform}</Badge>
        <Badge variant="outline" className="border-border/50">{post.contentType}</Badge>
      </div>

      {/* Rejection note */}
      {post.rejectionNote && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs font-semibold text-destructive mb-1">Feedback from reviewer:</p>
          <p className="text-sm text-destructive/80">{post.rejectionNote}</p>
        </div>
      )}

      {/* Content */}
      {post.caption && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Caption</p>
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.caption}</p>
          </div>
        </div>
      )}
      {post.hashtags && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Hashtags</p>
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-sm text-primary/80">{post.hashtags}</p>
          </div>
        </div>
      )}
      {post.script && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Script</p>
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.script}</p>
          </div>
        </div>
      )}
      {post.fullContent && !post.caption && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Full Content</p>
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.fullContent}</p>
          </div>
        </div>
      )}

      {/* Approval History */}
      {history && history.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">History</p>
          <div className="space-y-2">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-start gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                  h.action === "approved" ? "bg-green-400" :
                  h.action === "rejected" ? "bg-red-400" :
                  "bg-primary/60"
                }`} />
                <div>
                  <span className="font-medium capitalize">{h.action.replace("_", " ")}</span>
                  {h.note && <span className="text-muted-foreground ml-1">— {h.note}</span>}
                  <span className="text-muted-foreground/60 ml-2">{new Date(h.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
        {post.status === "draft" && (
          <Button size="sm" onClick={onSubmit} disabled={isSubmitting} className="bg-primary text-primary-foreground gap-2">
            <Send className="w-3.5 h-3.5" />
            Submit for Review
          </Button>
        )}
        {post.status === "approved" && (
          <Button size="sm" variant="outline" onClick={onSaveToLibrary} className="border-green-400/30 text-green-400 gap-2">
            <BookOpen className="w-3.5 h-3.5" />
            Save to Library
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          disabled={isDeleting}
          className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}

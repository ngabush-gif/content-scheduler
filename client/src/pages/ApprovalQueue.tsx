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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { NICHES } from "@shared/niches";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CheckCircle, CheckSquare, Clock, Loader2, MessageSquare, ThumbsDown, ThumbsUp, XCircle,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function ApprovalQueue() {
  return (
    <DashboardLayout>
      <ApprovalContent />
    </DashboardLayout>
  );
}

function ApprovalContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "revision" | null>(null);

  const isAdmin = user?.role === "admin";

  const { data: pending, isLoading, refetch } = trpc.approval.pending.useQuery(undefined, {
    enabled: isAdmin,
  });

  const utils = trpc.useUtils();

  const approveMutation = trpc.approval.approve.useMutation({
    onSuccess: () => {
      utils.approval.pending.invalidate();
      utils.content.list.invalidate();
      toast.success("Post approved!");
      setSelectedPost(null);
      setReviewAction(null);
      setReviewNote("");
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.approval.reject.useMutation({
    onSuccess: () => {
      utils.approval.pending.invalidate();
      utils.content.list.invalidate();
      toast.success("Post rejected with feedback");
      setSelectedPost(null);
      setReviewAction(null);
      setReviewNote("");
    },
    onError: (e) => toast.error(e.message),
  });

  const revisionMutation = trpc.approval.requestRevision.useMutation({
    onSuccess: () => {
      utils.approval.pending.invalidate();
      utils.content.list.invalidate();
      toast.success("Revision requested");
      setSelectedPost(null);
      setReviewAction(null);
      setReviewNote("");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="p-6 text-center py-20">
        <XCircle className="w-10 h-10 mx-auto mb-4 text-destructive/50" />
        <p className="text-muted-foreground">Admin access required</p>
        <Button className="mt-4" onClick={() => setLocation("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  const handleReviewSubmit = () => {
    if (!selectedPost || !reviewAction) return;
    if ((reviewAction === "reject" || reviewAction === "revision") && !reviewNote.trim()) {
      toast.error("Please provide feedback for the team member");
      return;
    }
    if (reviewAction === "approve") {
      approveMutation.mutate({ id: selectedPost.id, note: reviewNote || undefined });
    } else if (reviewAction === "reject") {
      rejectMutation.mutate({ id: selectedPost.id, note: reviewNote });
    } else {
      revisionMutation.mutate({ id: selectedPost.id, note: reviewNote });
    }
  };

  const isPending = approveMutation.isPending || rejectMutation.isPending || revisionMutation.isPending;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold flex items-center gap-3">
          <CheckSquare className="w-6 h-6 text-primary" />
          Approval Queue
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and approve content before it goes live
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
          <Clock className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-yellow-400">
            {isLoading ? "—" : pending?.length ?? 0} Pending
          </span>
        </div>
      </div>

      {/* Queue */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-card/50 border border-border/30 animate-pulse" />
          ))}
        </div>
      ) : (pending?.length ?? 0) === 0 ? (
        <div className="py-20 text-center">
          <CheckCircle className="w-10 h-10 mx-auto mb-4 text-green-400/40" />
          <p className="text-muted-foreground font-medium">All caught up!</p>
          <p className="text-sm text-muted-foreground/60 mt-1">No content waiting for review</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending?.map((post: any) => {
            const niche = NICHES.find((n) => n.id === post.niche);
            return (
              <Card
                key={post.id}
                className="bg-card border-border/50 hover:border-primary/20 transition-all cursor-pointer"
                onClick={() => { setSelectedPost(post); setReviewAction(null); setReviewNote(""); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{(niche as any)?.emoji ?? "📝"}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{post.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {niche?.label} · {post.platform} · {post.contentType}
                        </p>
                        {(post.caption || post.fullContent) && (
                          <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2 leading-relaxed">
                            {post.caption || post.fullContent}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {new Date(post.updatedAt).toLocaleDateString()}
                      </span>
                      <Button
                        size="sm"
                        className="bg-primary text-primary-foreground text-xs"
                        onClick={(e) => { e.stopPropagation(); setSelectedPost(post); setReviewAction(null); setReviewNote(""); }}
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      {selectedPost && (
        <Dialog open={!!selectedPost} onOpenChange={() => { setSelectedPost(null); setReviewAction(null); setReviewNote(""); }}>
          <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Review: {selectedPost.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Post meta */}
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const niche = NICHES.find((n) => n.id === selectedPost.niche);
                  return (
                    <>
                      <Badge variant="outline" className="border-border/50">{(niche as any)?.emoji} {niche?.label}</Badge>
                      <Badge variant="outline" className="border-border/50">{selectedPost.platform}</Badge>
                      <Badge variant="outline" className="border-border/50">{selectedPost.contentType}</Badge>
                    </>
                  );
                })()}
              </div>

              {/* Content preview */}
              {selectedPost.caption && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Caption</p>
                  <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedPost.caption}</p>
                  </div>
                </div>
              )}
              {selectedPost.hashtags && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Hashtags</p>
                  <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                    <p className="text-sm text-primary/80">{selectedPost.hashtags}</p>
                  </div>
                </div>
              )}
              {selectedPost.script && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Script</p>
                  <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedPost.script}</p>
                  </div>
                </div>
              )}
              {selectedPost.fullContent && !selectedPost.caption && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Full Content</p>
                  <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedPost.fullContent}</p>
                  </div>
                </div>
              )}

              {/* Review Actions */}
              <div className="pt-3 border-t border-border/50 space-y-3">
                <p className="text-sm font-semibold">Your Decision</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setReviewAction("approve")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      reviewAction === "approve"
                        ? "bg-green-400/15 border-green-400/40 text-green-400"
                        : "border-border/40 text-muted-foreground hover:border-green-400/30 hover:text-green-400"
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => setReviewAction("revision")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      reviewAction === "revision"
                        ? "bg-yellow-400/15 border-yellow-400/40 text-yellow-400"
                        : "border-border/40 text-muted-foreground hover:border-yellow-400/30 hover:text-yellow-400"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" /> Request Revision
                  </button>
                  <button
                    onClick={() => setReviewAction("reject")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      reviewAction === "reject"
                        ? "bg-destructive/15 border-destructive/40 text-destructive"
                        : "border-border/40 text-muted-foreground hover:border-destructive/30 hover:text-destructive"
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" /> Reject
                  </button>
                </div>

                {reviewAction && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      {reviewAction === "approve" ? "Optional note for the team member" : "Feedback (required)"}
                    </label>
                    <Textarea
                      placeholder={
                        reviewAction === "approve"
                          ? "Great work! Ready to publish..."
                          : "Please revise the tone to be more empathetic..."
                      }
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      className="bg-input border-border/50 text-sm min-h-[80px]"
                    />
                  </div>
                )}

                {reviewAction && (
                  <Button
                    onClick={handleReviewSubmit}
                    disabled={isPending}
                    className={`w-full gap-2 ${
                      reviewAction === "approve"
                        ? "bg-green-500 hover:bg-green-600 text-white"
                        : reviewAction === "reject"
                        ? "bg-destructive hover:bg-destructive/90 text-white"
                        : "bg-yellow-500 hover:bg-yellow-600 text-black"
                    }`}
                  >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {reviewAction === "approve" ? "Confirm Approval" : reviewAction === "reject" ? "Confirm Rejection" : "Send for Revision"}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { NICHES, PLATFORMS } from "@shared/niches";
import { BookOpen, Copy, Search, Wand2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function ContentLibrary() {
  return (
    <DashboardLayout>
      <LibraryContent />
    </DashboardLayout>
  );
}

function LibraryContent() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [nicheFilter, setNicheFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [selectedPost, setSelectedPost] = useState<any>(null);

  const { data: libraryItems, isLoading } = trpc.content.list.useQuery({ isLibraryItem: true });

  const filtered = (libraryItems ?? []).filter((post: any) => {
    const matchSearch = !search || post.title.toLowerCase().includes(search.toLowerCase()) ||
      (post.caption ?? "").toLowerCase().includes(search.toLowerCase());
    const matchNiche = nicheFilter === "all" || post.niche === nicheFilter;
    const matchPlatform = platformFilter === "all" || post.platform === platformFilter || post.platform === "all";
    return matchSearch && matchNiche && matchPlatform;
  });

  const copyContent = (post: any) => {
    const text = post.fullContent || post.caption || post.script || "";
    const hashtags = post.hashtags ? `\n\n${post.hashtags}` : "";
    navigator.clipboard.writeText(text + hashtags);
    toast.success("Content copied to clipboard!");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            Content Library
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Approved templates and reusable posts
          </p>
        </div>
        <Button onClick={() => setLocation("/generate")} className="bg-primary text-primary-foreground gap-2">
          <Wand2 className="w-4 h-4" />
          Create New
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-input border-border/50 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border/50 bg-input text-sm text-foreground"
          >
            <option value="all">All Niches</option>
            {NICHES.map((n) => <option key={n.id} value={n.id}>{n.emoji} {n.label}</option>)}
          </select>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border/50 bg-input text-sm text-foreground"
          >
            <option value="all">All Platforms</option>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} item{filtered.length !== 1 ? "s" : ""} in library
      </p>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-card/50 border border-border/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">
            {(libraryItems?.length ?? 0) === 0
              ? "Library is empty. Approve content and save it to the library."
              : "No items match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((post: any) => {
            const niche = NICHES.find((n) => n.id === post.niche);
            return (
              <Card
                key={post.id}
                className="bg-card border-border/50 hover:border-primary/20 transition-all group cursor-pointer"
                onClick={() => setSelectedPost(post)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{(niche as any)?.emoji ?? "📝"}</span>
                      <div>
                        <p className="text-xs font-medium text-primary/80">{niche?.label}</p>
                        <p className="text-[10px] text-muted-foreground">{post.platform} · {post.contentType}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyContent(post); }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary/10 text-primary/60 hover:text-primary transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <p className="font-medium text-sm line-clamp-1">{post.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">
                      {post.caption || post.fullContent || post.script || "No preview available"}
                    </p>
                  </div>
                  {post.hashtags && (
                    <p className="text-[10px] text-primary/60 line-clamp-1">{post.hashtags}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <Badge className="status-approved text-[10px]">Library</Badge>
                    <span className="text-[10px] text-muted-foreground/50">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      {selectedPost && (
        <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
          <DialogContent className="max-w-2xl bg-card border-border max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{selectedPost.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const niche = NICHES.find((n) => n.id === selectedPost.niche);
                  return <Badge variant="outline" className="border-border/50">{(niche as any)?.emoji} {niche?.label}</Badge>;
                })()}
                <Badge variant="outline" className="border-border/50">{selectedPost.platform}</Badge>
                <Badge variant="outline" className="border-border/50">{selectedPost.contentType}</Badge>
              </div>
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
              <Button
                onClick={() => copyContent(selectedPost)}
                className="w-full bg-primary text-primary-foreground gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Full Content
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

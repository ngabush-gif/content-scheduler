import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { NICHES, PLATFORMS, CONTENT_TYPES } from "@shared/niches";
import type { NicheId, PlatformId } from "@shared/niches";
import {
  BookOpen, CheckCircle, Copy, Hash, Lightbulb, Loader2,
  Save, Send, Sparkles, Video, Wand2, FileText,
} from "lucide-react";
import { useState } from "react";
import { ImageUploadField } from "@/components/ImageUploadField";
import { useLocation } from "wouter";

type ContentTypeId = "caption" | "script" | "hashtags" | "ideas" | "full_post";

const contentTypeIcons: Record<ContentTypeId, React.ElementType> = {
  caption: FileText,
  hashtags: Hash,
  script: Video,
  ideas: Lightbulb,
  full_post: Sparkles,
};

export default function ContentGenerator() {
  return (
    <DashboardLayout>
      <GeneratorContent />
    </DashboardLayout>
  );
}

function GeneratorContent() {
  const [, setLocation] = useLocation();
  const [selectedNiche, setSelectedNiche] = useState<NicheId | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | "all">("all");
  const [selectedContentType, setSelectedContentType] = useState<ContentTypeId>("full_post");
  const [topic, setTopic] = useState("");
  const [customTone, setCustomTone] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [postTitle, setPostTitle] = useState("");
  const [savedPostId, setSavedPostId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const generateMutation = trpc.generate.content.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(data);
      toast.success("Content generated successfully!");
    },
    onError: (err) => {
      toast.error("Generation failed: " + err.message);
    },
  });

  const createPostMutation = trpc.content.create.useMutation({
    onSuccess: (data) => {
      setSavedPostId(data?.id ?? null);
      utils.content.list.invalidate();
      toast.success("Content saved as draft!");
    },
    onError: (err) => toast.error("Save failed: " + err.message),
  });

  const submitMutation = trpc.content.submitForReview.useMutation({
    onSuccess: () => {
      utils.content.list.invalidate();
      toast.success("Submitted for review!");
      setLocation("/my-content");
    },
    onError: (err) => toast.error(err.message),
  });

  const niche = NICHES.find((n) => n.id === selectedNiche);

  const handleGenerate = () => {
    if (!selectedNiche) {
      toast.error("Please select an audience niche first");
      return;
    }
    generateMutation.mutate({
      niche: selectedNiche,
      platform: selectedPlatform as any,
      contentType: selectedContentType,
      topic: topic || undefined,
      customTone: customTone || undefined,
    });
  };

  const handleSaveDraft = async () => {
    if (!generatedContent || !selectedNiche) return;
    if (!postTitle.trim()) {
      toast.error("Please add a title for this post");
      return;
    }
    const d = generatedContent.data;
    createPostMutation.mutate({
      title: postTitle,
      niche: selectedNiche,
      platform: selectedPlatform as any,
      contentType: selectedContentType,
      caption: d.caption || d.fullPost,
      hashtags: d.hashtags || d.fullSet,
      script: d.fullScript,
      ideas: d.ideas ? JSON.stringify(d.ideas) : undefined,
      fullContent: d.fullPost || d.fullScript || d.caption,
      tone: customTone || niche?.tone,
      imageUrl: imageUrl || undefined,
      aiGeneratedImage: isAiGenerated,
      mediaType: imageUrl ? (imageUrl.includes('video') ? 'video' : 'image') : 'none',
    })
  };

  const handleSubmitForReview = async () => {
    if (savedPostId) {
      submitMutation.mutate({ id: savedPostId });
    } else {
      toast.error("Save as draft first before submitting");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold flex items-center gap-3">
          <Wand2 className="w-6 h-6 text-primary" />
          AI Content Generator
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate platform-optimised content tailored to your audience niche
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-2 space-y-5">
          {/* Niche Selection */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">1. Choose Your Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {NICHES.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNiche(n.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    selectedNiche === n.id
                      ? "border-primary/40 bg-primary/8"
                      : "border-border/40 hover:border-border hover:bg-accent/30"
                  }`}
                >
                  <span className="text-xl shrink-0 mt-0.5">{n.emoji}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${selectedNiche === n.id ? "text-primary" : ""}`}>
                      {n.label}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{n.description}</p>
                  </div>
                  {selectedNiche === n.id && (
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Tone info */}
          {niche && (
            <Card className="bg-primary/5 border-primary/15">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-primary mb-1">Tone Guide for {niche.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{niche.tone}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Config + Output */}
        <div className="lg:col-span-3 space-y-5">
          {/* Platform */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">2. Select Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[{ id: "all", label: "All Platforms", emoji: "🌐" }, ...PLATFORMS.map((p) => ({ id: p.id, label: p.label, emoji: p.id === "facebook" ? "📘" : p.id === "instagram" ? "📸" : "🎵" }))].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlatform(p.id as any)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                      selectedPlatform === p.id
                        ? "border-primary/40 bg-primary/8 text-primary"
                        : "border-border/40 hover:border-border hover:bg-accent/30 text-muted-foreground"
                    }`}
                  >
                    <span className="text-xl">{p.emoji}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content Type */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">3. Content Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CONTENT_TYPES.map((ct) => {
                  const Icon = contentTypeIcons[ct.id as ContentTypeId];
                  return (
                    <button
                      key={ct.id}
                      onClick={() => setSelectedContentType(ct.id as ContentTypeId)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                        selectedContentType === ct.id
                          ? "border-primary/40 bg-primary/8 text-primary"
                          : "border-border/40 hover:border-border hover:bg-accent/30 text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{ct.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Topic & Tone */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">4. Customise (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Topic or Focus</Label>
                <Input
                  placeholder="e.g. 'How I replaced my salary in 6 months'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="bg-input border-border/50 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Custom Tone Instructions</Label>
                <Input
                  placeholder="e.g. 'Be very gentle and reassuring'"
                  value={customTone}
                  onChange={(e) => setCustomTone(e.target.value)}
                  className="bg-input border-border/50 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={!selectedNiche || generateMutation.isPending}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-2 h-12"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating with AI...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Content
              </>
            )}
          </Button>

          {/* Generated Output */}
          {generatedContent && (
            <Card className="bg-card border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Generated Content
                  </CardTitle>
                  <Badge className="status-approved text-xs">Ready</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <GeneratedContentDisplay content={generatedContent} onCopy={copyToClipboard} />

                {/* Image Upload */}
                <div className="pt-3 border-t border-border/50 space-y-3">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Add Image or Video</Label>
                  <ImageUploadField
                    onImageSelect={(url, isAi) => {
                      setImageUrl(url);
                      setIsAiGenerated(isAi);
                    }}
                    caption={generatedContent?.caption || topic}
                    niche={selectedNiche || undefined}
                    tone={customTone}
                  />
                </div>

                {/* Save section */}
                <div className="pt-3 border-t border-border/50 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Post Title (required to save)</Label>
                    <Input
                      placeholder="Give this post a title..."
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      className="bg-input border-border/50 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveDraft}
                      disabled={createPostMutation.isPending || !postTitle.trim()}
                      className="flex-1 border-border/60 gap-2"
                    >
                      {createPostMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Draft
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmitForReview}
                      disabled={!savedPostId || submitMutation.isPending}
                      className="flex-1 bg-primary text-primary-foreground gap-2"
                    >
                      {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Submit for Review
                    </Button>
                  </div>
                  {savedPostId && (
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Saved as draft (ID #{savedPostId})
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function GeneratedContentDisplay({ content, onCopy }: { content: any; onCopy: (text: string) => void }) {
  const d = content.data;
  const type = content.contentType;

  const Section = ({ label, text, large = false }: { label: string; text: string; large?: boolean }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <button
          onClick={() => onCopy(text)}
          className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 transition-colors"
        >
          <Copy className="w-3 h-3" /> Copy
        </button>
      </div>
      <div className={`bg-background/50 rounded-lg p-3 border border-border/30 ${large ? "min-h-[80px]" : ""}`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );

  if (type === "caption") {
    return (
      <div className="space-y-3">
        {d.hook && <Section label="Hook" text={d.hook} />}
        <Section label="Caption" text={d.caption} large />
        {d.cta && <Section label="Call to Action" text={d.cta} />}
        {d.characterCount && (
          <p className="text-xs text-muted-foreground">~{d.characterCount} characters</p>
        )}
      </div>
    );
  }

  if (type === "hashtags") {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">5 Hashtags (Matched to Caption Style)</p>
          <div className="flex flex-wrap gap-1.5">
            {(d.hashtags || []).map((h: string) => (
              <Badge key={h} className="bg-primary/20 text-primary text-xs cursor-pointer hover:bg-primary/30 transition-colors" onClick={() => onCopy(h)}>{h}</Badge>
            ))}
          </div>
        </div>
        {d.fullSet && <Section label="Ready to Post" text={d.fullSet} />}
      </div>
    );
  }

  if (type === "script") {
    return (
      <div className="space-y-3">
        {d.hook && <Section label="Hook (0-3 sec)" text={d.hook} />}
        {d.intro && <Section label="Intro" text={d.intro} />}
        {d.mainContent?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Main Content</p>
            {d.mainContent.map((section: string, i: number) => (
              <div key={i} className="bg-background/50 rounded-lg p-3 border border-border/30">
                <p className="text-xs text-muted-foreground mb-1">Section {i + 1}</p>
                <p className="text-sm leading-relaxed">{section}</p>
              </div>
            ))}
          </div>
        )}
        {d.cta && <Section label="Call to Action" text={d.cta} />}
        {d.estimatedDuration && (
          <p className="text-xs text-muted-foreground">Estimated duration: ~{d.estimatedDuration}s</p>
        )}
        {d.fullScript && <Section label="Full Script" text={d.fullScript} large />}
      </div>
    );
  }

  if (type === "ideas") {
    return (
      <div className="space-y-2">
        {(d.ideas ?? []).map((idea: any, i: number) => (
          <div key={i} className="p-3 rounded-xl border border-border/40 bg-background/30 hover:border-primary/20 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{idea.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{idea.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-[10px] border-border/50">{idea.contentFormat}</Badge>
                  <span className="text-[10px] text-primary/70">💡 {idea.engagementTip}</span>
                </div>
              </div>
              <button onClick={() => onCopy(`${idea.title}\n${idea.description}`)} className="text-primary/60 hover:text-primary shrink-0">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // full_post
  return (
    <div className="space-y-3">
      {d.hook && <Section label="Hook" text={d.hook} />}
      {d.caption && <Section label="Caption" text={d.caption} large />}
      {d.hashtags && <Section label="Hashtags" text={d.hashtags} />}
      {d.cta && <Section label="Call to Action" text={d.cta} />}
      {d.postIdea && <Section label="Visual Idea" text={d.postIdea} />}
      {d.fullPost && <Section label="Full Post (Copy-Ready)" text={d.fullPost} large />}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
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
  const [selectedContentStyle, setSelectedContentStyle] = useState<"motivational" | "engagement" | "personal_story" | "curiosity" | "opportunity" | "tips_values" | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [postTitle, setPostTitle] = useState("");
  const [savedPostId, setSavedPostId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const generateMutation = trpc.generate.content.useMutation({
    onSuccess: (data) => {
      try {
        console.log('[generateMutation] RAW RESPONSE:', JSON.stringify(data, null, 2));
        
        // ─── DEFENSIVE: Validate response structure ───
        if (!data) {
          console.error('[generateMutation] ERROR: data is null/undefined');
          toast.error("Content generation failed: empty response");
          return;
        }
        
        if (!data.data) {
          console.error('[generateMutation] ERROR: data.data is missing');
          toast.error("Content generation failed: invalid response structure");
          return;
        }
        
        const content = data.data;
        console.log('[generateMutation] EXTRACTED CONTENT:', JSON.stringify(content, null, 2));
        
        // ─── DEFENSIVE: Normalize content structure ───
        const normalized = {
          data: {
            caption: '',
            hashtags: [] as string[],
            imagePrompt: '',
          }
        };
        
        // Validate caption
        if (typeof content.caption === 'string' && content.caption.trim()) {
          normalized.data.caption = content.caption.trim();
        } else {
          console.warn('[generateMutation] WARNING: caption is missing or not a string');
        }
        
        // Validate hashtags - CRITICAL CHECK
        if (Array.isArray(content.hashtags) && content.hashtags.length > 0) {
          normalized.data.hashtags = content.hashtags
            .slice(0, 5)
            .map((tag: any) => String(tag).replace(/^#+/, '').trim())
            .filter((tag: string) => tag.length > 0);
          
          // Pad with defaults if needed
          while (normalized.data.hashtags.length < 5) {
            normalized.data.hashtags.push(`tag${normalized.data.hashtags.length + 1}`);
          }
        } else {
          console.warn('[generateMutation] WARNING: hashtags is missing or not an array, using defaults');
          normalized.data.hashtags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
        }
        
        // Validate imagePrompt
        if (typeof content.imagePrompt === 'string' && content.imagePrompt.trim()) {
          normalized.data.imagePrompt = content.imagePrompt.trim();
        } else {
          console.warn('[generateMutation] WARNING: imagePrompt is missing or not a string');
          normalized.data.imagePrompt = 'A professional image related to the caption';
        }
        
        console.log('[generateMutation] NORMALIZED CONTENT:', JSON.stringify(normalized, null, 2));
        
        // ─── SAFE TO SET STATE ───
        setGeneratedContent(normalized);
        toast.success("Content generated successfully!");
      } catch (err) {
        console.error('[generateMutation] CRITICAL ERROR:', err);
        toast.error("Content generation failed: " + (err instanceof Error ? err.message : 'Unknown error'));
      }
    },
    onError: (err) => {
      console.error('[generateMutation] MUTATION ERROR:', err);
      toast.error("Generation failed: " + err.message);
    },
  });

  const createPostMutation = trpc.content.create.useMutation({
    onSuccess: (data) => {
      setSavedPostId((data as any)?.id ?? null);
      utils.content.list.invalidate();
      toast.success("Content created and ready to publish!");
    },
    onError: (err) => toast.error("Save failed: " + err.message),
  });

  const submitMutation = trpc.content.submitForReview.useMutation({
    onSuccess: () => {
      utils.content.list.invalidate();
      toast.success("Content submitted!");
      setLocation("/my-content");
    },
    onError: (err) => toast.error(err.message),
  });

  const niche = NICHES.find((n) => n.id === selectedNiche);

  const handleGenerate = () => {
    try {
      if (!selectedNiche) {
        toast.error("Please select an audience niche first");
        return;
      }
      
      // ─── DEFENSIVE: Safely handle optional contentStyle ───
      let contentStyle: string | undefined = undefined;
      if (selectedContentStyle) {
        contentStyle = selectedContentStyle.replace(/ /g, '_');
      }
      
      generateMutation.mutate({
        niche: selectedNiche,
        platform: selectedPlatform as any,
        contentType: selectedContentType,
        topic: topic || undefined,
        customTone: customTone || undefined,
        contentStyle: contentStyle as any,
      });
    } catch (err) {
      console.error('[handleGenerate] ERROR:', err);
      toast.error("Generation failed: " + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleSaveDraft = async () => {
    if (!generatedContent || !selectedNiche) return;
    if (!postTitle.trim()) {
      toast.error("Please add a title for this post");
      return;
    }

    // ─── DEFENSIVE: Validate generatedContent structure ───
    if (!generatedContent.data) {
      console.error('[handleSaveDraft] ERROR: generatedContent.data is missing');
      toast.error("Generated content is missing. Please try generating again.");
      return;
    }

    const d = generatedContent.data;

    console.log("\n\n========== FRONTEND SAVE DRAFT ==========");
    console.log("[handleSaveDraft] RAW LLM OUTPUT:");
    console.log(JSON.stringify(d, null, 2));

    // ─── EXPLICIT PARSING & VALIDATION ───
    let caption = "";
    let hashtags: string[] = [];
    let imagePrompt = "";

    try {
      // ─── DEFENSIVE: Validate caption ───
      if (typeof d.caption !== "string") {
        console.warn('[handleSaveDraft] WARNING: caption is not a string, using empty string');
        caption = "";
      } else {
        caption = d.caption.trim();
      }

      // ─── DEFENSIVE: Validate hashtags ───
      if (!Array.isArray(d.hashtags)) {
        console.warn('[handleSaveDraft] WARNING: hashtags is not an array, using defaults');
        hashtags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
      } else {
        hashtags = d.hashtags
          .slice(0, 5)
          .map((tag: any) => {
            const cleaned = String(tag).replace(/^#+/, "").trim();
            return cleaned;
          })
          .filter((tag: string) => tag.length > 0);
        
        // Pad with defaults if needed
        while (hashtags.length < 5) {
          hashtags.push(`tag${hashtags.length + 1}`);
        }
      }

      // ─── DEFENSIVE: Validate imagePrompt ───
      if (typeof d.imagePrompt !== "string") {
        console.warn('[handleSaveDraft] WARNING: imagePrompt is not a string, using default');
        imagePrompt = "A professional image related to the caption";
      } else {
        imagePrompt = d.imagePrompt.trim() || "A professional image related to the caption";
      }

      // ─── DEFENSIVE: Sanitize caption ───
      // Remove any hashtags that might have slipped through
      caption = caption.replace(/#[a-zA-Z0-9_]+/g, "").trim();
      
      // Remove any URLs
      caption = caption.replace(/https?:\/\/[^\s]+/g, "").trim();
      
      console.log('[handleSaveDraft] AFTER SANITIZATION:', { caption, hashtags, imagePrompt });
    } catch (err) {
      console.error("[handleSaveDraft] VALIDATION ERROR:", err);
      toast.error(
        `Error processing content: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      return;
    }

    const payload = {
      title: postTitle,
      niche: selectedNiche,
      platform: selectedPlatform as any,
      contentType: selectedContentType,
      caption,
      hashtags: hashtags.join(" "),
      imagePrompt,
      tone: customTone || niche?.tone,
      imageUrl: imageUrl || undefined,
      aiGeneratedImage: isAiGenerated,
      mediaType: imageUrl
        ? imageUrl.includes("video")
          ? "video"
          : "image"
        : "none",
    };

    console.log("[handleSaveDraft] PARSED & VALIDATED:");
    console.log("  caption:", caption.substring(0, 300));
    console.log("  hashtags:", hashtags);
    console.log("  imagePrompt:", imagePrompt.substring(0, 300));

    console.log("[handleSaveDraft] FINAL PAYLOAD TO BACKEND:");
    console.log(JSON.stringify(payload, null, 2));
    console.log("========== END FRONTEND SAVE DRAFT ==========\n\n");

    createPostMutation.mutate(payload as any);
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Generator Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Choose Your Audience */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Choose Your Audience</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {NICHES.map((niche) => (
                <button
                  key={niche.id}
                  onClick={() => setSelectedNiche(niche.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedNiche === niche.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-2xl mb-2">{niche.emoji}</div>
                  <div className="font-semibold text-sm">{niche.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {niche.description}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* 2. Select Platform */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Select Platform</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() =>
                    setSelectedPlatform(
                      platform.id as PlatformId | "all"
                    )
                  }
                  className={`px-4 py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    selectedPlatform === platform.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span>{platform.emoji}</span>
                  <span className="text-sm font-medium">{platform.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* 3. Content Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Content Type</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {CONTENT_TYPES.map((type) => {
                const Icon = contentTypeIcons[type.id as ContentTypeId];
                return (
                  <button
                    key={type.id}
                    onClick={() =>
                      setSelectedContentType(type.id as ContentTypeId)
                    }
                    className={`px-4 py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                      selectedContentType === type.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{type.label}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* 3.5 Content Style */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                3.5 Content Style (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {[
                "motivational",
                "engagement",
                "personal_story",
                "curiosity",
                "opportunity",
                "tips_values",
              ].map((style) => (
                <button
                  key={style}
                  onClick={() =>
                    setSelectedContentStyle(
                      style as
                        | "motivational"
                        | "engagement"
                        | "personal_story"
                        | "curiosity"
                        | "opportunity"
                        | "tips_values"
                    )
                  }
                  className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                    selectedContentStyle === style
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {style.replace(/_/g, " ")}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* 4. Customise (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Customise (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="topic" className="text-sm font-medium">
                  Topic or Focus
                </Label>
                <Input
                  id="topic"
                  placeholder="e.g. 'How I replaced my salary in 6 months'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="tone" className="text-sm font-medium">
                  Custom Tone Instructions
                </Label>
                <Input
                  id="tone"
                  placeholder="e.g. 'Be very gentle and reassuring'"
                  value={customTone}
                  onChange={(e) => setCustomTone(e.target.value)}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !selectedNiche}
            className="w-full h-12 text-base font-semibold"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Content
              </>
            )}
          </Button>
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          {generatedContent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generated Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Post Title</Label>
                  <Input
                    placeholder="Give this post a title"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    className="mt-2"
                  />
                </div>

                {generatedContent.data?.caption && (
                  <div>
                    <Label className="text-sm font-medium">Caption</Label>
                    <Textarea
                      value={generatedContent.data.caption}
                      readOnly
                      className="mt-2 h-32 text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(generatedContent.data.caption)
                      }
                      className="mt-2 w-full"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Caption
                    </Button>
                  </div>
                )}

                {generatedContent.data?.hashtags && (
                  <div>
                    <Label className="text-sm font-medium">Hashtags</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(Array.isArray(generatedContent.data.hashtags)
                        ? generatedContent.data.hashtags
                        : generatedContent.data.hashtags
                            .split(" ")
                            .filter((h: string) => h)
                      ).map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          #{tag.replace(/^#+/, "")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {generatedContent.data?.imagePrompt && (
                  <div>
                    <Label className="text-sm font-medium">Image Prompt</Label>
                    <Textarea
                      value={generatedContent.data.imagePrompt}
                      readOnly
                      className="mt-2 h-20 text-xs"
                    />
                  </div>
                )}

                <ImageUploadField
                  onImageSelect={(url, isAi) => {
                    setImageUrl(url);
                    setIsAiGenerated(isAi);
                  }}
                  caption={generatedContent.data?.caption}
                  niche={selectedNiche || undefined}
                  tone={customTone || undefined}
                />

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSaveDraft}
                    disabled={createPostMutation.isPending || !postTitle.trim()}
                    className="flex-1"
                  >
                    {createPostMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Draft
                      </>
                    )}
                  </Button>
                  {savedPostId && (
                    <Button
                      onClick={handleSubmitForReview}
                      disabled={submitMutation.isPending}
                      variant="default"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Submit
                        </>
                      )}
                    </Button>
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

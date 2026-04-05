import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Loader2, Zap } from "lucide-react";

const NICHES = [
  { value: "time_freedom", label: "Time Freedom Seekers" },
  { value: "parents", label: "Solo/Busy Parents" },
  { value: "side_hustlers", label: "Side Hustlers" },
  { value: "online_business", label: "Online Business Learners" },
  { value: "cultural", label: "Cultural Reach" },
  { value: "over_50", label: "50+ Demographic" },
  { value: "scam_survivors", label: "Scam Survivors" },
];

const PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "all", label: "All Platforms" },
];

export default function BulkGeneration() {
  const { user } = useAuth();
  const [niche, setNiche] = useState("time_freedom");
  const [platform, setPlatform] = useState("all");
  const [tone, setTone] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [count, setCount] = useState([5]);
  const [templateId, setTemplateId] = useState<number | undefined>();
  const [generating, setGenerating] = useState(false);

  const templates = trpc.templates.listByNiche.useQuery({ niche });
  const bulkGenerate = trpc.bulk.generate.useMutation();

  const handleGenerate = async () => {
    if (!customPrompt && !templateId) {
      toast.error("Please provide a custom prompt or select a template");
      return;
    }

    setGenerating(true);
    try {
      const result = await bulkGenerate.mutateAsync({
        niche: niche as any,
        platform: platform as any,
        tone,
        customPrompt: customPrompt || undefined,
        templateId,
        count: count[0],
      });

      toast.success(`Generated ${result.count} posts successfully!`);
      setCustomPrompt("");
      setCount([5]);
    } catch (error) {
      toast.error("Failed to generate posts");
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Bulk Content Generation</h1>
          <p className="text-muted-foreground mt-2">Generate multiple posts at once for faster content creation</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Generation Settings</CardTitle>
              <CardDescription>Configure your bulk generation preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Niche Selection */}
              <div className="space-y-2">
                <Label htmlFor="niche">Target Niche</Label>
                <Select value={niche} onValueChange={setNiche}>
                  <SelectTrigger id="niche">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NICHES.map((n) => (
                      <SelectItem key={n.value} value={n.value}>
                        {n.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Platform Selection */}
              <div className="space-y-2">
                <Label htmlFor="platform">Target Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection */}
              {templates.data && templates.data.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="template">Use Template (Optional)</Label>
                  <Select value={templateId?.toString() || ""} onValueChange={(v) => setTemplateId(v ? parseInt(v) : undefined)}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.data.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tone */}
              <div className="space-y-2">
                <Label htmlFor="tone">Tone (Optional)</Label>
                <Input
                  id="tone"
                  placeholder="e.g., motivational, professional, casual"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                />
              </div>

              {/* Custom Prompt */}
              <div className="space-y-2">
                <Label htmlFor="prompt">Custom Prompt {templateId ? "(Optional)" : "(Required)"}</Label>
                <Textarea
                  id="prompt"
                  placeholder="Describe what kind of posts you want to generate..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Count Slider */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Number of Posts</Label>
                  <span className="text-lg font-semibold text-accent">{count[0]}</span>
                </div>
                <Slider
                  value={count}
                  onValueChange={setCount}
                  min={1}
                  max={20}
                  step={1}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">Generate up to 20 posts at once</p>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={generating || (!customPrompt && !templateId)}
                className="w-full gap-2"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Generate {count[0]} Posts
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Info Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bulk Generation Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-foreground mb-1">Use Templates</p>
                <p className="text-muted-foreground">Select a template to maintain consistency across generated posts.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Detailed Prompts</p>
                <p className="text-muted-foreground">The more specific your prompt, the better the generated content.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Tone Matters</p>
                <p className="text-muted-foreground">Specify a tone to ensure consistency with your brand voice.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Review Before Publishing</p>
                <p className="text-muted-foreground">Always review generated posts before submitting for approval.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useState } from "react";
import { Upload, Wand2, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface ImageUploadFieldProps {
  onImageSelect: (imageUrl: string, isAiGenerated: boolean) => void;
  caption?: string;
  niche?: string;
  tone?: string;
}

export function ImageUploadField({
  onImageSelect,
  caption,
  niche,
  tone,
}: ImageUploadFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  const generateImageMutation = trpc.media.generateImage.useMutation();
  const uploadImageMutation = trpc.media.uploadImage.useMutation();

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit");
      return;
    }

    // Validate file type
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error("Unsupported file type. Use images or videos.");
      return;
    }

    setIsLoading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        if (!base64) {
          toast.error("Failed to read file");
          setIsLoading(false);
          return;
        }

        try {
          const result = await uploadImageMutation.mutateAsync({
            fileData: base64,
            fileName: file.name,
            mimeType: file.type,
          });

          setPreviewUrl(result.url);
          setIsAiGenerated(false);
          onImageSelect(result.url, false);
          toast.success("Image uploaded successfully");
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to upload image"
          );
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Failed to process file");
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!caption || !niche) {
      toast.error("Caption and niche are required to generate an image");
      return;
    }

    setIsLoading(true);
    try {
      const result = await generateImageMutation.mutateAsync({
        caption,
        niche: niche as any,
        tone,
      });

      setPreviewUrl(result.url);
      setIsAiGenerated(true);
      onImageSelect(result.url, true);
      toast.success("Image generated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate image"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setPreviewUrl(null);
    setIsAiGenerated(false);
    onImageSelect("", false);
  };

  return (
    <div className="space-y-3">
      {previewUrl ? (
        <Card className="bg-primary/5 border-primary/20 p-4">
          <div className="space-y-3">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {previewUrl.includes("video") ? (
                <video
                  src={previewUrl}
                  className="w-full h-full object-cover"
                  controls
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute top-2 right-2 flex gap-1">
                {isAiGenerated && (
                  <div className="bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded flex items-center gap-1">
                    <Wand2 className="w-3 h-3" />
                    AI Generated
                  </div>
                )}
                <button
                  onClick={handleClear}
                  className="bg-destructive/90 hover:bg-destructive text-destructive-foreground p-1.5 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {isAiGenerated
                ? "AI-generated image ready to post"
                : "Uploaded image ready to post"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">Upload Image or Video</p>
            <p className="text-xs text-muted-foreground mb-3">
              JPEG, PNG, WebP, GIF, or MP4
            </p>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              disabled={isLoading}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="cursor-pointer"
              >
                <span>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose File
                    </>
                  )}
                </span>
              </Button>
            </label>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-background text-muted-foreground">
                or
              </span>
            </div>
          </div>

          <Button
            onClick={handleGenerateImage}
            disabled={isLoading || !caption || !niche}
            variant="secondary"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate with AI
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

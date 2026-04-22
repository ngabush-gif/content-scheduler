import { useState } from "react";
import { Zap, Loader2, X, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface QuickImageButtonProps {
  imagePrompt: string;
}

export function QuickImageButton({ imagePrompt }: QuickImageButtonProps) {

  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateImageMutation = trpc.media.generateImageFromPrompt.useMutation();

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      toast.error("❌ Image prompt is empty");
      return;
    }

    setIsLoading(true);
    toast.loading('⏳ Generating image... (5-20 seconds)');
    try {
      console.log('[handleGenerateImage] Sending prompt to server:', imagePrompt.substring(0, 50) + '...');
      const result = await generateImageMutation.mutateAsync({
        prompt: imagePrompt,
      });

      if (result.url) {
        setPreviewUrl(result.url);
        toast.success("✅ Image generated successfully!");
      } else {
        toast.error("❌ Image unavailable, prompt ready for use");
      }
    } catch (error) {
      console.error("[QuickImageButton] Generation error:", error);
      toast.error("❌ Image unavailable, prompt ready for use");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!previewUrl) {
      toast.error("❌ No image to download");
      return;
    }

    try {
      toast.loading('⏳ Downloading image...');
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quick-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("✅ Image downloaded!");
    } catch (error) {
      console.error("[QuickImageButton] Download error:", error);
      toast.error("❌ Failed to download image");
    }
  };

  const handleRegenerate = () => {
    toast.info('🔄 Regenerating image...');
    setPreviewUrl(null);
    handleGenerateImage();
  };

  const handleClose = () => {
    setIsOpen(false);
    setPreviewUrl(null);
  };

  const handleButtonClick = () => {
    setIsOpen(true);
  };

  return (
    <>
      <Button
        onClick={handleButtonClick}
        variant="outline"
        size="sm"
        className="w-full mt-2"
      >
        <Zap className="w-4 h-4 mr-2" />
        ⚡ Quick Image
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Image from Prompt</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Prompt Display */}
            <div>
              <p className="text-sm font-medium mb-2">Prompt</p>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                {imagePrompt}
              </p>
            </div>

            {/* Image Preview or Generate Button */}
            {previewUrl ? (
              <Card className="bg-primary/5 border-primary/20 p-4">
                <div className="space-y-3">
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={previewUrl}
                      alt="Generated"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={handleClose}
                        className="bg-destructive/90 hover:bg-destructive text-destructive-foreground p-1.5 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI-generated image ready to download
                  </p>
                </div>
              </Card>
            ) : (
              <div className="flex items-center justify-center py-12">
                {isLoading ? (
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Generating image... (this may take 5-20 seconds)
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Click "Generate Image" to create an AI image from this prompt
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              {previewUrl ? (
                <>
                  <Button
                    onClick={handleDownloadImage}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Image
                  </Button>
                  <Button
                    onClick={handleRegenerate}
                    variant="outline"
                    disabled={isLoading}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleGenerateImage}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Generate Image
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

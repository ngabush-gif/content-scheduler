import { useState, useEffect } from "react";
import { Zap, Loader2, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useToastGuard } from "@/lib/toastGuard";

interface QuickImageButtonProps {
  imagePrompt: string;
  onImageSelect?: (imageUrl: string, isAiGenerated: boolean) => void;
}

export function QuickImageButton({ imagePrompt, onImageSelect }: QuickImageButtonProps) {

  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const toastGuard = useToastGuard();

  const generateImageMutation = trpc.media.generateImageFromPrompt.useMutation();
  const isLoading = generateImageMutation.isPending;

  // Cleanup when dialog closes
  const handleDialogOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Dialog is closing - cleanup all state
      toastGuard.dismissAll();
      // Reset the mutation to clear any pending state
      generateImageMutation.reset();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      toastGuard.dismissAll();
    };
  }, []);

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      toastGuard.error('quick-image-gen', "❌ Image prompt is empty");
      return;
    }

    toastGuard.loading('quick-image-gen', '⏳ Generating image... (5-20 seconds)');
    try {
      console.log('[handleGenerateImage] Sending prompt to server:', imagePrompt.substring(0, 50) + '...');
      const result = await generateImageMutation.mutateAsync({
        prompt: imagePrompt,
      });
      
      if (result.url) {
        console.log('[QuickImageButton] Generation succeeded, setting preview URL and attaching to card');
        setPreviewUrl(result.url);
        
        // Auto-attach to card
        if (onImageSelect) {
          onImageSelect(result.url, true);
          toastGuard.success('quick-image-gen', "✅ Image generated and attached!");
        } else {
          toastGuard.success('quick-image-gen', "✅ Image generated successfully!");
        }
      } else {
        toastGuard.error('quick-image-gen', "❌ Image unavailable, prompt ready for use");
      }
    } catch (error) {
      console.error("[QuickImageButton] Generation error:", error);
      toastGuard.error('quick-image-gen', "❌ Image unavailable, prompt ready for use");
    }
  };

  const handleRegenerate = () => {
    toastGuard.dismiss('quick-image-gen');
    setPreviewUrl(null);
    generateImageMutation.reset();
    handleGenerateImage();
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

      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
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
                        onClick={() => handleDialogOpenChange(false)}
                        className="bg-destructive/90 hover:bg-destructive text-destructive-foreground p-1.5 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI-generated image attached to card
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
                    onClick={handleRegenerate}
                    variant="outline"
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                  <Button
                    onClick={() => handleDialogOpenChange(false)}
                    className="flex-1"
                  >
                    Done
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

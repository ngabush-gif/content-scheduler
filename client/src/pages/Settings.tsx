import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function Settings() {
  const [autoPublish, setAutoPublish] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current settings
  const { data: settings } = trpc.settings.getSettings.useQuery();

  useEffect(() => {
    if (settings) {
      setAutoPublish(settings.autoPublishAfterGenerate);
      setIsLoading(false);
    }
  }, [settings]);

  // Toggle auto-publish
  const toggleMutation = trpc.settings.toggleAutoPublish.useMutation({
    onSuccess: (data) => {
      setAutoPublish(data.enabled);
    },
  });

  const handleToggle = (checked: boolean) => {
    setAutoPublish(checked);
    toggleMutation.mutate({ enabled: checked });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Publishing Options</CardTitle>
            <CardDescription>
              Configure how your content is published
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Auto-Publish Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <div className="space-y-1">
                <Label htmlFor="auto-publish" className="text-base font-semibold cursor-pointer">
                  Auto Publish After Generate
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically publish content immediately after generation. When disabled, content will be saved as draft for review.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {toggleMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Switch
                  id="auto-publish"
                  checked={autoPublish}
                  onCheckedChange={handleToggle}
                  disabled={toggleMutation.isPending || isLoading}
                />
              </div>
            </div>

            {/* Status Message */}
            {toggleMutation.isSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                ✓ Settings updated successfully
              </div>
            )}

            {toggleMutation.isError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                ✗ Failed to update settings: {toggleMutation.error?.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Auto Publish ON:</strong> Content is generated and published immediately to all connected platforms.
            </p>
            <p>
              <strong>Auto Publish OFF:</strong> Content is generated and saved as draft. You can review and publish manually from My Content.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

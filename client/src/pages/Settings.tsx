import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Facebook, Instagram, Trash2, Loader2, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  return (
    <DashboardLayout>
      <SettingsContent />
    </DashboardLayout>
  );
}

function SettingsContent() {
  const { user } = useAuth();
  const [facebookToken, setFacebookToken] = useState("");
  const [instagramToken, setInstagramToken] = useState("");
  const [tiktokToken, setTiktokToken] = useState("");
  const [facebookUserId, setFacebookUserId] = useState("");
  const [instagramUserId, setInstagramUserId] = useState("");
  const [tiktokUserId, setTiktokUserId] = useState("");

  const { data: connections, isLoading } = trpc.socialConnections.list.useQuery();
  const saveMutation = trpc.socialConnections.save.useMutation({
    onSuccess: () => {
      toast.success("Account connected successfully!");
      setFacebookToken("");
      setInstagramToken("");
      setTiktokToken("");
      setFacebookUserId("");
      setInstagramUserId("");
      setTiktokUserId("");
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const deleteMutation = trpc.socialConnections.delete.useMutation({
    onSuccess: () => {
      toast.success("Account disconnected!");
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const utils = trpc.useUtils();

  const handleConnectFacebook = async () => {
    if (!facebookToken || !facebookUserId) {
      toast.error("Please enter both access token and user ID");
      return;
    }
    await saveMutation.mutateAsync({
      platform: "facebook",
      accessToken: facebookToken,
      platformUserId: facebookUserId,
      platformUsername: "Facebook Account",
    });
    await utils.socialConnections.list.invalidate();
  };

  const handleConnectInstagram = async () => {
    if (!instagramToken || !instagramUserId) {
      toast.error("Please enter both access token and user ID");
      return;
    }
    await saveMutation.mutateAsync({
      platform: "instagram",
      accessToken: instagramToken,
      platformUserId: instagramUserId,
      platformUsername: "Instagram Account",
    });
    await utils.socialConnections.list.invalidate();
  };

  const handleConnectTikTok = async () => {
    if (!tiktokToken || !tiktokUserId) {
      toast.error("Please enter both access token and user ID");
      return;
    }
    await saveMutation.mutateAsync({
      platform: "tiktok",
      accessToken: tiktokToken,
      platformUserId: tiktokUserId,
      platformUsername: "TikTok Account",
    });
    await utils.socialConnections.list.invalidate();
  };

  const handleDisconnect = async (platform: "facebook" | "instagram" | "tiktok") => {
    await deleteMutation.mutateAsync({ platform });
    await utils.socialConnections.list.invalidate();
  };

  const facebookConnection = connections?.find((c) => c.platform === "facebook");
  const instagramConnection = connections?.find((c) => c.platform === "instagram");
  const tiktokConnection = connections?.find((c) => c.platform === "tiktok");

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Connect your social media accounts to publish content
        </p>
      </div>

      {/* Facebook */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Facebook className="w-5 h-5 text-blue-600" />
              <div>
                <CardTitle>Facebook</CardTitle>
                <CardDescription>Connect your Facebook account</CardDescription>
              </div>
            </div>
            {facebookConnection && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {facebookConnection ? (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">User ID: {facebookConnection.platformUserId}</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDisconnect("facebook")}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="facebook-token">Access Token</Label>
                <Input
                  id="facebook-token"
                  placeholder="Paste your Facebook access token"
                  value={facebookToken}
                  onChange={(e) => setFacebookToken(e.target.value)}
                  type="password"
                />
              </div>
              <div>
                <Label htmlFor="facebook-user-id">User ID</Label>
                <Input
                  id="facebook-user-id"
                  placeholder="Your Facebook User ID"
                  value={facebookUserId}
                  onChange={(e) => setFacebookUserId(e.target.value)}
                />
              </div>
              <Button
                onClick={handleConnectFacebook}
                disabled={saveMutation.isPending || !facebookToken || !facebookUserId}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Facebook"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instagram */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-600" />
              <div>
                <CardTitle>Instagram</CardTitle>
                <CardDescription>Connect your Instagram account</CardDescription>
              </div>
            </div>
            {instagramConnection && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {instagramConnection ? (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">User ID: {instagramConnection.platformUserId}</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDisconnect("instagram")}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="instagram-token">Access Token</Label>
                <Input
                  id="instagram-token"
                  placeholder="Paste your Instagram access token"
                  value={instagramToken}
                  onChange={(e) => setInstagramToken(e.target.value)}
                  type="password"
                />
              </div>
              <div>
                <Label htmlFor="instagram-user-id">User ID</Label>
                <Input
                  id="instagram-user-id"
                  placeholder="Your Instagram User ID"
                  value={instagramUserId}
                  onChange={(e) => setInstagramUserId(e.target.value)}
                />
              </div>
              <Button
                onClick={handleConnectInstagram}
                disabled={saveMutation.isPending || !instagramToken || !instagramUserId}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Instagram"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TikTok */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-black rounded-sm flex items-center justify-center text-white text-xs font-bold">
                ♪
              </div>
              <div>
                <CardTitle>TikTok</CardTitle>
                <CardDescription>Connect your TikTok account</CardDescription>
              </div>
            </div>
            {tiktokConnection && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tiktokConnection ? (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">User ID: {tiktokConnection.platformUserId}</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDisconnect("tiktok")}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="tiktok-token">Access Token</Label>
                <Input
                  id="tiktok-token"
                  placeholder="Paste your TikTok access token"
                  value={tiktokToken}
                  onChange={(e) => setTiktokToken(e.target.value)}
                  type="password"
                />
              </div>
              <div>
                <Label htmlFor="tiktok-user-id">User ID</Label>
                <Input
                  id="tiktok-user-id"
                  placeholder="Your TikTok User ID"
                  value={tiktokUserId}
                  onChange={(e) => setTiktokUserId(e.target.value)}
                />
              </div>
              <Button
                onClick={handleConnectTikTok}
                disabled={saveMutation.isPending || !tiktokToken || !tiktokUserId}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect TikTok"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

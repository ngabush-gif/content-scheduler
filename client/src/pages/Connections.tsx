import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2, Trash2, RefreshCw } from "lucide-react";

export default function Connections() {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);

  // Get Facebook auth URL
  const getFacebookAuthUrl = trpc.connections.getFacebookAuthUrl.useQuery(
    { state: user?.id.toString() || "" },
    { enabled: !!user }
  );

  // Get Instagram auth URL
  const getInstagramAuthUrl = trpc.connections.getInstagramAuthUrl.useQuery(
    { state: user?.id.toString() || "" },
    { enabled: !!user }
  );

  // Get connected Facebook pages
  const facebookConnections = trpc.connections.getFacebookConnections.useQuery(undefined, {
    enabled: !!user,
  });

  // Get connected Instagram accounts
  const instagramConnections = trpc.connections.getInstagramConnections.useQuery(undefined, {
    enabled: !!user,
  });

  // Facebook disconnect mutation
  const disconnectMutation = trpc.connections.disconnectFacebook.useMutation({
    onSuccess: () => {
      facebookConnections.refetch();
    },
  });

  // Instagram disconnect mutation
  const disconnectInstagramMutation = trpc.connections.disconnectInstagram.useMutation({
    onSuccess: () => {
      instagramConnections.refetch();
    },
  });

  // Facebook reconnect mutation
  const reconnectMutation = trpc.connections.reconnectFacebook.useMutation({
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
  });

  // Instagram reconnect mutation
  const reconnectInstagramMutation = trpc.connections.reconnectInstagram.useMutation({
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
  });

  const handleConnectFacebook = () => {
    if (getFacebookAuthUrl.data?.url) {
      setIsConnecting(true);
      window.location.href = getFacebookAuthUrl.data.url;
    }
  };

  const handleConnectInstagram = () => {
    if (getInstagramAuthUrl.data?.url) {
      setIsConnectingInstagram(true);
      window.location.href = getInstagramAuthUrl.data.url;
    }
  };

  const handleDisconnect = (connectionId: number) => {
    if (confirm("Are you sure you want to disconnect this Facebook page?")) {
      disconnectMutation.mutate({ connectionId });
    }
  };

  const handleDisconnectInstagram = (connectionId: number) => {
    if (confirm("Are you sure you want to disconnect this Instagram account?")) {
      disconnectInstagramMutation.mutate({ connectionId });
    }
  };

  const handleReconnect = (connectionId: number) => {
    setIsConnecting(true);
    reconnectMutation.mutate({ connectionId });
  };

  const handleReconnectInstagram = (connectionId: number) => {
    setIsConnectingInstagram(true);
    reconnectInstagramMutation.mutate({ connectionId });
  };

  if (!user) {
    return <div className="p-8">Please log in to manage connections.</div>;
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">Platform Connections</h1>
        <p className="text-gray-400">Connect your social media accounts to publish directly from our app.</p>
      </div>

      {/* Facebook Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img src="https://www.facebook.com/favicon.ico" alt="Facebook" className="w-5 h-5" />
            Facebook Pages
          </CardTitle>
          <CardDescription>Connect your Facebook Pages to schedule and publish posts directly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connected Pages */}
          {facebookConnections.data && facebookConnections.data.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Connected Pages</h3>
              {facebookConnections.data.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {connection.isValid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{connection.pageName}</p>
                      <p className="text-xs text-gray-400">
                        {connection.isValid ? "Active" : "Token expired - requires reconnection"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!connection.isValid && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReconnect(connection.id)}
                        disabled={reconnectMutation.isPending}
                      >
                        {reconnectMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Reconnect
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDisconnect(connection.id)}
                      disabled={disconnectMutation.isPending}
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Connect Button */}
          <Button
            onClick={handleConnectFacebook}
            disabled={isConnecting || getFacebookAuthUrl.isLoading}
            className="w-full"
          >
            {isConnecting || getFacebookAuthUrl.isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <img src="https://www.facebook.com/favicon.ico" alt="Facebook" className="w-4 h-4 mr-2" />
                Connect Facebook Page
              </>
            )}
          </Button>

          {facebookConnections.data?.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No Facebook pages connected yet. Click the button above to connect.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Instagram Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img src="https://www.instagram.com/favicon.ico" alt="Instagram" className="w-5 h-5" />
            Instagram Accounts
          </CardTitle>
          <CardDescription>Connect your Instagram Business accounts to publish posts directly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connected Accounts */}
          {instagramConnections.data && instagramConnections.data.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Connected Accounts</h3>
              {instagramConnections.data.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {connection.isValid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">@{connection.accountName}</p>
                      <p className="text-xs text-gray-400">
                        {connection.isValid ? "Active" : "Token expired - requires reconnection"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!connection.isValid && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReconnectInstagram(connection.id)}
                        disabled={reconnectInstagramMutation.isPending}
                      >
                        {reconnectInstagramMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Reconnect
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDisconnectInstagram(connection.id)}
                      disabled={disconnectInstagramMutation.isPending}
                    >
                      {disconnectInstagramMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Connect Button */}
          <Button
            onClick={handleConnectInstagram}
            disabled={isConnectingInstagram || getInstagramAuthUrl.isLoading}
            className="w-full"
          >
            {isConnectingInstagram || getInstagramAuthUrl.isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <img src="https://www.instagram.com/favicon.ico" alt="Instagram" className="w-4 h-4 mr-2" />
                Connect Instagram Account
              </>
            )}
          </Button>

          {instagramConnections.data?.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No Instagram accounts connected yet. Click the button above to connect.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-blue-950 border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-200">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-100 text-sm space-y-2">
          <p>1. Click "Connect Facebook Page" or "Connect Instagram Account" to authorize our app</p>
          <p>2. Select the account you want to connect</p>
          <p>3. Your account will appear in the list above</p>
          <p>4. Go to the Calendar to schedule posts for automatic publishing</p>
        </CardContent>
      </Card>
    </div>
  );
}

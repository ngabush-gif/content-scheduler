import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2, Trash2, RefreshCw } from "lucide-react";

export default function Connections() {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  // Get Facebook auth URL
  const getFacebookAuthUrl = trpc.connections.getFacebookAuthUrl.useQuery(
    { state: user?.id.toString() || "" },
    { enabled: !!user }
  );

  // Get connected Facebook pages
  const facebookConnections = trpc.connections.getFacebookConnections.useQuery(undefined, {
    enabled: !!user,
  });

  // Disconnect mutation
  const disconnectMutation = trpc.connections.disconnectFacebook.useMutation({
    onSuccess: () => {
      facebookConnections.refetch();
    },
  });

  // Reconnect mutation
  const reconnectMutation = trpc.connections.reconnectFacebook.useMutation();

  const handleConnectFacebook = () => {
    if (getFacebookAuthUrl.data?.url) {
      setIsConnecting(true);
      window.location.href = getFacebookAuthUrl.data.url;
    }
  };

  const handleDisconnect = (connectionId: number) => {
    if (confirm("Are you sure you want to disconnect this Facebook page?")) {
      disconnectMutation.mutate({ connectionId });
    }
  };

  const handleReconnect = (connectionId: number) => {
    reconnectMutation.mutate({ connectionId });
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

      {/* Info Box */}
      <Card className="bg-blue-950 border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-200">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-100 text-sm space-y-2">
          <p>1. Click "Connect Facebook Page" to authorize our app</p>
          <p>2. Select the Facebook Page you want to connect</p>
          <p>3. Your page will appear in the list above</p>
          <p>4. Go to the Calendar to schedule posts for automatic publishing</p>
        </CardContent>
      </Card>
    </div>
  );
}

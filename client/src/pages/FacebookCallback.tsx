import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

export default function FacebookCallback() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get URL params
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const errorParam = params.get("error");

  // Handle callback mutation
  const handleCallbackMutation = trpc.connections.handleFacebookCallback.useMutation({
    onSuccess: (data) => {
      setSuccess(true);
      setTimeout(() => {
        setLocation("/connections");
      }, 2000);
    },
    onError: (error) => {
      setError(error.message || "Failed to connect Facebook page");
    },
  });

  useEffect(() => {
    // Handle error from Facebook
    if (errorParam) {
      setError(`Facebook error: ${errorParam}`);
      return;
    }

    // Handle missing code
    if (!code) {
      setError("No authorization code received from Facebook");
      return;
    }

    // Handle missing user
    if (!user) {
      setError("User not authenticated");
      return;
    }

    // Exchange code for token
    handleCallbackMutation.mutate({
      code,
      state: state || "",
      userId: user.id,
    });
  }, [code, state, errorParam, user, handleCallbackMutation]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connecting Facebook</CardTitle>
          <CardDescription>Please wait while we connect your Facebook page...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {handleCallbackMutation.isPending && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm text-gray-400">Exchanging authorization code...</p>
            </div>
          )}

          {success && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <p className="text-sm text-gray-200">Successfully connected!</p>
              <p className="text-xs text-gray-400">Redirecting to connections page...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="text-sm text-red-200">{error}</p>
              <button
                onClick={() => setLocation("/connections")}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white"
              >
                Back to Connections
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

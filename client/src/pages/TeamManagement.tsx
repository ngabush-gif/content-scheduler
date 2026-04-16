import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { Users, ExternalLink, Shield } from "lucide-react";
import { useLocation } from "wouter";

export default function TeamManagement() {
  return (
    <DashboardLayout>
      <TeamContent />
    </DashboardLayout>
  );
}

function TeamContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          Team Management
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage team members and access</p>
      </div>

      {/* Main Info Card */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            How to Add Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Team member access is managed through the Manus Management UI. Follow these steps to add team members:
          </p>

          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-background/50 border border-border/30">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                  1
                </div>
                <div>
                  <p className="font-medium text-sm">Go to Manus Management UI</p>
                  <p className="text-xs text-muted-foreground mt-1">Click the Management UI button in the top-right corner of this app</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-background/50 border border-border/30">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                  2
                </div>
                <div>
                  <p className="font-medium text-sm">Navigate to Settings → Collaborators</p>
                  <p className="text-xs text-muted-foreground mt-1">Find the Collaborators section in the Management UI settings</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-background/50 border border-border/30">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                  3
                </div>
                <div>
                  <p className="font-medium text-sm">Click "Add Collaborator"</p>
                  <p className="text-xs text-muted-foreground mt-1">Enter the team member's email address</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-background/50 border border-border/30">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                  4
                </div>
                <div>
                  <p className="font-medium text-sm">They receive an invite</p>
                  <p className="text-xs text-muted-foreground mt-1">They'll get an email invite and can accept to gain access</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-background/50 border border-border/30">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                  5
                </div>
                <div>
                  <p className="font-medium text-sm">They can now sign in</p>
                  <p className="text-xs text-muted-foreground mt-1">Once they accept the invite, they can log in and access the app</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remove Access Card */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-semibold">How to Remove Team Member Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            To remove a team member's access:
          </p>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Go to Manus Management UI → Settings → Collaborators</li>
            <li>Find the team member in the list</li>
            <li>Click "Remove" or "Revoke Access"</li>
            <li>They immediately lose access to the app</li>
          </ol>
        </CardContent>
      </Card>

      {/* Current User Info */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Your Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium ml-2">{user?.name || "Not set"}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium ml-2">{user?.email || "Not set"}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Role:</span>
              <span className="font-medium ml-2 capitalize">{user?.role || "user"}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => setLocation("/dashboard")} variant="outline">
        Back to Dashboard
      </Button>
    </div>
  );
}

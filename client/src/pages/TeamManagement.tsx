import DashboardLayout from "@/components/DashboardLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Crown, Shield, Users, UserCheck, XCircle, Copy, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

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
  const isAdmin = user?.role === "admin";

  const { data: members, isLoading } = trpc.team.list.useQuery();
  const utils = trpc.useUtils();

  const updateRoleMutation = trpc.team.updateRole.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      toast.success("Role updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: inviteCodes, isLoading: codesLoading } = trpc.team.listInviteCodes.useQuery();
  const generateCodeMutation = trpc.team.generateInviteCode.useMutation({
    onSuccess: () => {
      utils.team.listInviteCodes.invalidate();
      toast.success("Invite code generated!");
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeCodeMutation = trpc.team.revokeInviteCode.useMutation({
    onSuccess: () => {
      utils.team.listInviteCodes.invalidate();
      toast.success("Code revoked");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="p-6 text-center py-20">
        <XCircle className="w-10 h-10 mx-auto mb-4 text-destructive/50" />
        <p className="text-muted-foreground">Admin access required</p>
        <Button className="mt-4" onClick={() => setLocation("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  const admins = (members ?? []).filter((m: any) => m.role === "admin");
  const regularMembers = (members ?? []).filter((m: any) => m.role === "user");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          Team Management
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage team members and their roles</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold font-display">{members?.length ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Members</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold font-display text-primary">{admins.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Admins</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold font-display">{regularMembers.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Members</div>
          </CardContent>
        </Card>
      </div>

      {/* Admins */}
      {admins.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              Administrators
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {admins.map((member: any) => (
              <MemberRow
                key={member.id}
                member={member}
                currentUser={user}
                onRoleChange={(role) => updateRoleMutation.mutate({ userId: member.id, role })}
                isUpdating={updateRoleMutation.isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-accent/20 animate-pulse" />
              ))}
            </div>
          ) : regularMembers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No regular members yet.</p>
              <p className="text-xs mt-1 opacity-70">Members will appear here after they sign in.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {regularMembers.map((member: any) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  currentUser={user}
                  onRoleChange={(role) => updateRoleMutation.mutate({ userId: member.id, role })}
                  isUpdating={updateRoleMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Codes */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Invite Team Members</CardTitle>
          <Button
            size="sm"
            onClick={() => generateCodeMutation.mutate()}
            disabled={generateCodeMutation.isPending}
            className="text-xs h-8"
          >
            Generate Code
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {codesLoading ? (
            <p className="text-xs text-muted-foreground">Loading codes...</p>
          ) : (inviteCodes ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No invite codes yet. Generate one to invite team members.</p>
          ) : (
            <div className="space-y-2">
              {(inviteCodes ?? []).map((code: any) => (
                <div key={code.id} className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/30">
                  <div className="flex-1">
                    <div className="font-mono text-sm font-semibold">{code.code}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {code.usedBy ? `Used by ${code.usedAt ? new Date(code.usedAt).toLocaleDateString() : 'unknown'}` : 'Not used yet'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(code.code);
                        toast.success("Code copied!");
                      }}
                      className="h-7 w-7 p-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    {!code.usedBy && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revokeCodeMutation.mutate({ code: code.code })}
                        disabled={revokeCodeMutation.isPending}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Guide */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-primary">Admin</span>
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Generate AI content</li>
                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> View all team content</li>
                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Approve / reject posts</li>
                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Publish to platforms</li>
                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Manage team roles</li>
                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> View full analytics</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl border border-border/40 bg-card">
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Member</span>
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Generate AI content</li>
                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> View own content</li>
                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Submit for review</li>
                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Browse content library</li>
                <li className="flex items-center gap-1.5"><span className="text-yellow-400">✗</span> Cannot approve posts</li>
                <li className="flex items-center gap-1.5"><span className="text-yellow-400">✗</span> Cannot manage team</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberRow({ member, currentUser, onRoleChange, isUpdating }: {
  member: any;
  currentUser: any;
  onRoleChange: (role: "user" | "admin") => void;
  isUpdating: boolean;
}) {
  const isSelf = member.id === currentUser?.id;
  const isAdmin = member.role === "admin";

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-accent/30 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 border border-border">
          <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
            {member.name?.charAt(0).toUpperCase() ?? "U"}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{member.name || "Unnamed"}</p>
            {isSelf && <Badge variant="outline" className="text-[9px] border-border/50 py-0">You</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{member.email || "No email"}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge className={isAdmin ? "bg-primary/10 text-primary border-primary/20 text-xs" : "bg-secondary text-secondary-foreground text-xs"}>
          {isAdmin ? <><Crown className="w-2.5 h-2.5 mr-1" />Admin</> : "Member"}
        </Badge>
        {!isSelf && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRoleChange(isAdmin ? "user" : "admin")}
            disabled={isUpdating}
            className="text-xs border-border/50 h-7 px-2.5"
          >
            {isAdmin ? "Demote" : "Promote"}
          </Button>
        )}
      </div>
    </div>
  );
}

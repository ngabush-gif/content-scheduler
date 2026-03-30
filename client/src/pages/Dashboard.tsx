import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { NICHES, PLATFORMS, STATUS_CONFIG } from "@shared/niches";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  Send,
  TrendingUp,
  Users,
  Wand2,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: analytics, isLoading } = trpc.analytics.summary.useQuery();
  const { data: myContent } = trpc.content.list.useQuery({ myOnly: true });

  const isAdmin = user?.role === "admin";

  const stats = [
    {
      label: "Total Posts",
      value: analytics?.totalPosts ?? 0,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Pending Review",
      value: analytics?.pendingPosts ?? 0,
      icon: Clock,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    },
    {
      label: "Approved",
      value: analytics?.approvedPosts ?? 0,
      icon: CheckSquare,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      label: "Published",
      value: analytics?.publishedPosts ?? 0,
      icon: Send,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
  ];

  const platformData = (analytics?.platformBreakdown ?? []).map((p: { platform: string; count: number }) => ({
    name: PLATFORMS.find((pl) => pl.id === p.platform)?.label ?? p.platform,
    count: Number(p.count),
  }));

  const nicheData = (analytics?.nicheBreakdown ?? []).map((n: { niche: string; count: number }) => ({
    name: NICHES.find((ni) => ni.id === n.niche)?.label ?? n.niche,
    count: Number(n.count),
  }));

  const chartColors = ["oklch(0.78 0.12 80)", "oklch(0.65 0.15 200)", "oklch(0.70 0.14 160)", "oklch(0.72 0.16 300)", "oklch(0.68 0.18 30)", "oklch(0.65 0.12 240)", "oklch(0.55 0.20 25)"];

  const quickActions = [
    { label: "Generate Content", icon: Wand2, path: "/generate", primary: true },
    { label: "My Content", icon: BookOpen, path: "/my-content", primary: false },
    { label: "Calendar", icon: Calendar, path: "/calendar", primary: false },
    ...(isAdmin ? [{ label: "Approval Queue", icon: CheckSquare, path: "/approval", primary: false }] : []),
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold">
            Welcome back, {user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isAdmin ? "Admin Dashboard · Full team overview" : "Your content workspace"}
          </p>
        </div>
        <Button
          onClick={() => setLocation("/generate")}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Generate Content
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-card border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold font-display">{isLoading ? "—" : stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.path}
              variant={action.primary ? "default" : "outline"}
              onClick={() => setLocation(action.path)}
              className={`gap-2 ${action.primary ? "bg-primary text-primary-foreground" : "border-border/60 hover:border-primary/30 hover:bg-accent/60"}`}
            >
              <action.icon className="w-4 h-4" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Charts row */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Platform breakdown */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Posts by Platform
              </CardTitle>
            </CardHeader>
            <CardContent>
              {platformData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={platformData} barSize={32}>
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "oklch(0.60 0.010 260)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 260)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.14 0.012 260)", border: "1px solid oklch(0.22 0.015 260)", borderRadius: "8px", fontSize: "12px" }}
                      cursor={{ fill: "oklch(0.78 0.12 80 / 0.05)" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {platformData.map((_, i) => (
                        <Cell key={i} fill={chartColors[i % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                  No data yet — start creating content
                </div>
              )}
            </CardContent>
          </Card>

          {/* Niche breakdown */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Posts by Niche
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nicheData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={nicheData} barSize={24} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 260)" }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 260)" }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.14 0.012 260)", border: "1px solid oklch(0.22 0.015 260)", borderRadius: "8px", fontSize: "12px" }}
                      cursor={{ fill: "oklch(0.78 0.12 80 / 0.05)" }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {nicheData.map((_, i) => (
                        <Cell key={i} fill={chartColors[i % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                  No data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Activity */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Recent Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(analytics?.recentActivity ?? []).length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Wand2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No content yet. Start by generating your first post.</p>
              <Button
                size="sm"
                className="mt-4 bg-primary text-primary-foreground"
                onClick={() => setLocation("/generate")}
              >
                Generate Now
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {(analytics?.recentActivity ?? []).slice(0, 6).map((post) => {
                const niche = NICHES.find((n) => n.id === post.niche);
                const statusCfg = STATUS_CONFIG[post.status as keyof typeof STATUS_CONFIG];
                return (
                  <div
                    key={post.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => setLocation("/my-content")}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg shrink-0">{(niche as any)?.emoji ?? "📝"}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{post.title}</p>
                        <p className="text-xs text-muted-foreground">{niche?.label} · {post.platform}</p>
                      </div>
                    </div>
                    <Badge className={`text-[10px] shrink-0 ${statusCfg?.class ?? ""}`}>
                      {statusCfg?.label ?? post.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

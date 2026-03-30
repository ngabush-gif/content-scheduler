import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { NICHES, PLATFORMS, STATUS_CONFIG } from "@shared/niches";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BarChart3, FileText, Send, TrendingUp, Users, CheckSquare, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

export default function Analytics() {
  return (
    <DashboardLayout>
      <AnalyticsContent />
    </DashboardLayout>
  );
}

function AnalyticsContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: analytics, isLoading } = trpc.analytics.summary.useQuery();
  const { data: allPosts } = trpc.content.list.useQuery(
    isAdmin ? {} : { myOnly: true }
  );

  const chartColors = [
    "oklch(0.78 0.12 80)",
    "oklch(0.65 0.15 200)",
    "oklch(0.70 0.14 160)",
    "oklch(0.72 0.16 300)",
    "oklch(0.68 0.18 30)",
    "oklch(0.65 0.12 240)",
    "oklch(0.55 0.20 25)",
  ];

  const platformData = (analytics?.platformBreakdown ?? []).map((p: { platform: string; count: number }) => ({
    name: PLATFORMS.find((pl) => pl.id === p.platform)?.label ?? p.platform,
    count: Number(p.count),
  }));

  const nicheData = (analytics?.nicheBreakdown ?? []).map((n: { niche: string; count: number }) => ({
    name: NICHES.find((ni) => ni.id === n.niche)?.label ?? n.niche,
    count: Number(n.count),
  }));

  const statusBreakdown = Object.entries(STATUS_CONFIG).map(([status, cfg]) => ({
    name: cfg.label,
    value: (allPosts ?? []).filter((p: any) => p.status === status).length,
    color: status === "published" ? "oklch(0.65 0.15 200)" :
           status === "approved" ? "oklch(0.70 0.14 160)" :
           status === "pending_review" ? "oklch(0.78 0.12 80)" :
           status === "rejected" ? "oklch(0.55 0.20 25)" :
           "oklch(0.50 0.010 260)",
  })).filter((s) => s.value > 0);

  const stats = [
    { label: "Total Posts", value: analytics?.totalPosts ?? 0, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "Published", value: analytics?.publishedPosts ?? 0, icon: Send, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Pending Review", value: analytics?.pendingPosts ?? 0, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10" },
    { label: "Approved", value: analytics?.approvedPosts ?? 0, icon: CheckSquare, color: "text-green-400", bg: "bg-green-400/10" },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
          <p className="font-medium mb-1">{label}</p>
          <p className="text-primary">{payload[0].value} posts</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAdmin ? "Team-wide content performance overview" : "Your personal content performance"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-card border-border/50">
            <CardContent className="p-5">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold font-display">{isLoading ? "—" : stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Platform Breakdown */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Posts by Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            {platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={platformData} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "oklch(0.60 0.010 260)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 260)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(0.78 0.12 80 / 0.05)" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {platformData.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown Pie */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Content Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.14 0.012 260)",
                      border: "1px solid oklch(0.22 0.015 260)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ fontSize: "11px", color: "oklch(0.70 0.010 260)" }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Niche Breakdown */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Posts by Audience Niche
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nicheData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={nicheData} barSize={28} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 260)" }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 260)" }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(0.78 0.12 80 / 0.05)" }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {nicheData.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              No data yet — start creating content
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Posts Table */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Recent Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(allPosts?.length ?? 0) === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">No posts yet</div>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                <div className="col-span-5">Title</div>
                <div className="col-span-2">Niche</div>
                <div className="col-span-2">Platform</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1 text-right">Date</div>
              </div>
              {(allPosts ?? []).slice(0, 10).map((post: any) => {
                const niche = NICHES.find((n) => n.id === post.niche);
                const statusCfg = STATUS_CONFIG[post.status as keyof typeof STATUS_CONFIG];
                return (
                  <div key={post.id} className="grid grid-cols-12 px-3 py-2.5 rounded-lg hover:bg-accent/30 transition-colors text-sm items-center">
                    <div className="col-span-5 flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{(niche as any)?.emoji ?? "📝"}</span>
                      <span className="truncate font-medium text-xs">{post.title}</span>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground truncate">{niche?.label}</div>
                    <div className="col-span-2 text-xs text-muted-foreground capitalize">{post.platform}</div>
                    <div className="col-span-2">
                      <Badge className={`text-[9px] ${statusCfg?.class ?? ""}`}>{statusCfg?.label}</Badge>
                    </div>
                    <div className="col-span-1 text-[10px] text-muted-foreground/60 text-right">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </div>
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

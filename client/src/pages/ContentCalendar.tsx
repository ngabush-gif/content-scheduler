import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { NICHES, PLATFORMS } from "@shared/niches";
import {
  Calendar, ChevronLeft, ChevronRight, Clock, Plus, Trash2, Loader2,
} from "lucide-react";
import { useState } from "react";
import * as React from "react";
import { toast } from "sonner";

export default function ContentCalendar() {
  return (
    <DashboardLayout>
      <CalendarContent />
    </DashboardLayout>
  );
}

function CalendarContent() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleModal, setScheduleModal] = useState<{ post: any; open: boolean } | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<"facebook" | "instagram" | "tiktok">("instagram");
  const [selectedDateTime, setSelectedDateTime] = useState("");
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedTimezone, setSelectedTimezone] = useState("AEST"); // Default to AEST for Australian users

  // Get user's platform connections
  const { data: connections } = trpc.connections.getFacebookConnections.useQuery();
  
  // Auto-select first active connection if available
  React.useEffect(() => {
    if (connections && connections.length > 0 && !selectedConnectionId) {
      const activeConnection = connections.find((c) => c.isActive);
      if (activeConnection) {
        setSelectedConnectionId(activeConnection.id);
        setSelectedPageId(activeConnection.pageId);
      }
    }
  }, [connections, selectedConnectionId]);

  const utils = trpc.useUtils();

  // Get month range
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const { data: scheduled } = trpc.schedule.list.useQuery({});

  const { data: approvedPosts } = trpc.content.list.useQuery({ status: "approved" });

  const scheduleMutation = trpc.schedule.create.useMutation({
    onSuccess: () => {
      utils.schedule.list.invalidate();
      toast.success("Post scheduled!");
      setScheduleModal(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMutation = trpc.schedule.cancel.useMutation({
    onSuccess: () => {
      utils.schedule.list.invalidate();
      toast.success("Schedule cancelled");
    },
    onError: (e) => toast.error(e.message),
  });

  // Build calendar grid
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const getScheduledForDay = (day: number) => {
    if (!scheduled) return [];
    return scheduled.filter((s: any) => {
      // Parse the ISO string and get local date components
      // The scheduledAt is stored in UTC, but we need to compare against local calendar
      const d = new Date(s.scheduledAt);
      const localYear = d.getFullYear();
      const localMonth = d.getMonth();
      const localDay = d.getDate();
      return localYear === year && localMonth === month && localDay === day;
    });
  };

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  // Helper to format date for display
  const formatScheduleTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const handleSchedule = () => {
    if (!scheduleModal?.post || !selectedDateTime) {
      toast.error("Please select a date and time");
      return;
    }
    if (!selectedConnectionId) {
      toast.error("Please select a platform connection");
      return;
    }
    
    // Map timezone names to offsets
    const timezoneOffsets: Record<string, number> = {
      'AEST': -600,
      'AEDT': -660,
      'ACST': -570,
      'ACDT': -630,
      'AWST': -480,
      'UTC': 0,
    };
    
    const timezoneOffsetMinutes = timezoneOffsets[selectedTimezone] || 0;
    const localDate = new Date(selectedDateTime);
    
    const utcDate = new Date(localDate.getTime() - (timezoneOffsetMinutes * 60 * 1000));
    
    console.log(`[Schedule] Local: ${selectedDateTime}, TZ: ${selectedTimezone}, Offset: ${timezoneOffsetMinutes}min, UTC: ${utcDate.toISOString()}`);
    
    scheduleMutation.mutate({
      postId: scheduleModal.post.id,
      connectionId: selectedConnectionId,
      pageId: selectedPageId || undefined,
      platform: selectedPlatform,
      scheduledAt: utcDate,
      timezoneOffsetMinutes: 0,
    });
  };

  const platformColors: Record<string, string> = {
    facebook: "platform-facebook",
    instagram: "platform-instagram",
    tiktok: "platform-tiktok",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            Content Calendar
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Schedule and track your content publishing</p>
        </div>
        <Button
          onClick={() => setScheduleModal({ post: null, open: true })}
          className="bg-primary text-primary-foreground gap-2"
        >
          <Plus className="w-4 h-4" />
          Schedule Post
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className="p-2 rounded-lg hover:bg-accent/60 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-display font-semibold min-w-[180px] text-center">
          {monthNames[month]} {year}
        </h2>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className="p-2 rounded-lg hover:bg-accent/60 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {d}
              </div>
            ))}
          </div>
          {/* Cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} className="h-24 rounded-lg" />;
              const dayScheduled = getScheduledForDay(day);
              const isToday =
                new Date().getDate() === day &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;
              return (
                <div
                  key={idx}
                  className={`h-24 rounded-lg border p-1.5 transition-colors ${
                    isToday
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/30 hover:border-border/60"
                  }`}
                >
                  <p className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {day}
                  </p>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayScheduled.slice(0, 3).map((s: any) => {
                      const post = approvedPosts?.find((p: any) => p.id === s.postId);
                      return (
                        <div
                          key={s.id}
                          className={`text-[9px] px-1.5 py-0.5 rounded border truncate ${platformColors[s.platform] ?? ""}`}
                        >
                          {new Date(s.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" · "}{post?.title?.substring(0, 12) ?? s.platform}
                        </div>
                      );
                    })}
                    {dayScheduled.length > 3 && (
                      <p className="text-[9px] text-muted-foreground px-1">+{dayScheduled.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Scheduled */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Upcoming Scheduled Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(scheduled ?? []).filter((s: any) => s.status === "scheduled" || s.status === "publishing").length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No scheduled posts this month</p>
          ) : (
            <div className="space-y-2">
              {(scheduled ?? [])
                .filter((s: any) => s.status === "scheduled" || s.status === "publishing")
                .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .map((s: any) => {
                  const post = approvedPosts?.find((p: any) => p.id === s.postId);
                  return (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          s.platform === "facebook" ? "bg-blue-400" :
                          s.platform === "instagram" ? "bg-pink-400" : "bg-cyan-400"
                        }`} />
                        {post?.imageUrl && (
                          <img
                            src={post.imageUrl}
                            alt={post?.title}
                            className="w-12 h-12 rounded object-cover shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{post?.title ?? `Post #${s.postId}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.platform} · {new Date(s.scheduledAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => cancelMutation.mutate({ id: s.id })}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Modal */}
      <Dialog open={!!scheduleModal} onOpenChange={() => setScheduleModal(null)}>
        <DialogContent className="max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Schedule a Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pr-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Select Approved Post</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-input text-sm text-foreground"
                onChange={(e) => {
                  const post = approvedPosts?.find((p: any) => p.id === Number(e.target.value));
                  setScheduleModal((prev) => prev ? { ...prev, post } : null);
                }}
                defaultValue=""
              >
                <option value="" disabled>Choose a post...</option>
                {(approvedPosts ?? []).map((p: any) => {
                  const niche = NICHES.find((n) => n.id === p.niche);
                  return (
                    <option key={p.id} value={p.id}>
                      {(niche as any)?.emoji} {p.title}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Platform Connection</label>
              {connections && connections.length > 0 ? (
                <select
                  className="w-full px-3 py-2 rounded-lg border border-border/50 bg-input text-sm text-foreground"
                  value={selectedConnectionId || ""}
                  onChange={(e) => {
                    const connId = Number(e.target.value);
                    const conn = connections.find((c) => c.id === connId);
                    if (conn) {
                      setSelectedConnectionId(connId);
                      setSelectedPageId(conn.pageId);
                      setSelectedPlatform("facebook");
                    }
                  }}
                >
                  <option value="" disabled>Select a page...</option>
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      📘 {c.pageName || c.pageId} {!c.isActive ? "(Inactive)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full px-3 py-2 rounded-lg border border-border/50 bg-input text-sm text-muted-foreground">
                  No connections found. <a href="/connections" className="text-primary underline">Connect a page</a>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Platform</label>
              <div className="flex gap-2">
                {["facebook", "instagram", "tiktok"].map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setSelectedPlatform(platform as "facebook" | "instagram" | "tiktok")}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      selectedPlatform === platform
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 bg-input text-muted-foreground hover:border-border"
                    }`}
                  >
                    {platform === "facebook" && "📘 Facebook"}
                    {platform === "instagram" && "📷 Instagram"}
                    {platform === "tiktok" && "🎵 TikTok"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Timezone</label>
              <select
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-input text-sm text-foreground"
              >
                <option value="AEST">AEST (UTC+10) - Australia Eastern</option>
                <option value="AEDT">AEDT (UTC+11) - Australia Eastern Daylight</option>
                <option value="ACST">ACST (UTC+9:30) - Australia Central</option>
                <option value="ACDT">ACDT (UTC+10:30) - Australia Central Daylight</option>
                <option value="AWST">AWST (UTC+8) - Australia Western</option>
                <option value="UTC">UTC (UTC+0) - Coordinated Universal Time</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Date & Time</label>
              <input
                type="datetime-local"
                value={selectedDateTime}
                onChange={(e) => setSelectedDateTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-input text-sm text-foreground"
              />
            </div>
            <Button
              onClick={handleSchedule}
              disabled={scheduleMutation.isPending || !scheduleModal?.post || !selectedDateTime}
              className="w-full bg-primary text-primary-foreground gap-2"
            >
              {scheduleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              Schedule Post
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

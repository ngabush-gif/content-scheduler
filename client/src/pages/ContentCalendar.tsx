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
import { DateTime } from "luxon";
import DashboardLayout from "@/components/DashboardLayout";

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
  const [selectedTimezone, setSelectedTimezone] = useState("AEST");

  // Get user's platform connections
  const { data: connections } = trpc.connections.getFacebookConnections.useQuery();
  
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

  // Get scheduled posts
  const { data: scheduledPosts = [] } = trpc.schedule.list.useQuery();
  const { data: approvedPosts = [] } = trpc.content.list.useQuery({ status: 'approved' });
  
  React.useEffect(() => {
    console.log('[ContentCalendar] Scheduled Posts:', scheduledPosts);
    if (scheduledPosts.length > 0) {
      console.log('[ContentCalendar] First post:', scheduledPosts[0]);
      console.log('[ContentCalendar] First post title:', scheduledPosts[0].title);
      console.log('[ContentCalendar] First post scheduledAt:', scheduledPosts[0].scheduledAt);
    }
  }, [scheduledPosts]);

  // Mutations
  const scheduleMutation = trpc.schedule.create.useMutation({
    onSuccess: () => {
      toast.success("Post scheduled successfully!");
      setScheduleModal(null);
      setSelectedDateTime("");
      utils.schedule.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.schedule.cancel.useMutation({
    onSuccess: () => {
      toast.success("Scheduled post cancelled");
      utils.schedule.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const retryMutation = trpc.schedule.retry.useMutation({
    onSuccess: () => {
      toast.success("Post queued for retry");
      utils.schedule.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSchedule = () => {
    if (!scheduleModal?.post) {
      toast.error("Please select a post to schedule");
      return;
    }
    if (!selectedConnectionId) {
      toast.error("Please select a platform connection");
      return;
    }
    if (!selectedDateTime) {
      toast.error("Please select a date and time");
      return;
    }
    
    // Map timezone names to Luxon zone identifiers
    const timezoneMap: Record<string, string> = {
      'AEST': 'Australia/Brisbane',
      'AEDT': 'Australia/Brisbane',
      'ACST': 'Australia/Adelaide',
      'ACDT': 'Australia/Adelaide',
      'AWST': 'Australia/Perth',
      'UTC': 'UTC',
    };
    
    const luxonZone = timezoneMap[selectedTimezone] || 'Australia/Brisbane';
    
    // Get current time in UTC and selected timezone
    const nowUTC = DateTime.now().toUTC();
    const nowLocal = DateTime.now().setZone(luxonZone);
    
    // Parse the datetime-local input (format: "2026-04-16T07:44")
    // Convert to dd/MM/yyyy HH:mm format for Luxon
    const [datePart, timePart] = selectedDateTime.split('T');
    const [year, month, day] = datePart.split('-');
    const dateTimeString = `${day}/${month}/${year} ${timePart}`;
    
    // Parse using Luxon with explicit timezone
    const selectedLocal = DateTime.fromFormat(dateTimeString, 'dd/MM/yyyy HH:mm', { zone: luxonZone });
    
    if (!selectedLocal.isValid) {
      console.error('[handleSchedule] Invalid date format:', dateTimeString);
      toast.error('Invalid date/time format');
      return;
    }
    
    // Convert to UTC
    const selectedUTC = selectedLocal.toUTC();
    
    // Calculate difference
    const diffMs = selectedUTC.toMillis() - nowUTC.toMillis();
    const diffMinutes = diffMs / (1000 * 60);
    
    // Log all details for debugging
    console.log('[handleSchedule] Timezone-Safe Conversion:', {
      currentClientTimeUTC: nowUTC.toISO(),
      currentClientTimeLocal: nowLocal.toISO(),
      selectedLocalTime: selectedLocal.toISO(),
      selectedUTCTime: selectedUTC.toISO(),
      timezone: luxonZone,
      diffMs,
      diffMinutes: diffMinutes.toFixed(2),
    });
    
    // Require at least 5 minutes in the future (buffer for processing)
    const MIN_FUTURE_MINUTES = 5;
    if (diffMinutes < MIN_FUTURE_MINUTES) {
      console.error('[handleSchedule] VALIDATION FAILED: Time must be at least 5 minutes in the future');
      console.error('[handleSchedule] Details:', {
        currentUTC: nowUTC.toISO(),
        selectedUTC: selectedUTC.toISO(),
        diffMinutes: diffMinutes.toFixed(2),
        required: MIN_FUTURE_MINUTES,
      });
      toast.error(`Scheduled time must be at least ${MIN_FUTURE_MINUTES} minutes in the future`);
      return;
    }
    
    console.log(`[Schedule] Selected: ${dateTimeString} (${luxonZone}) -> UTC: ${selectedUTC.toISO()}`);
    
    scheduleMutation.mutate({
      postId: scheduleModal.post.id,
      connectionId: selectedConnectionId,
      pageId: selectedPageId || undefined,
      platform: selectedPlatform,
      scheduledAt: new Date(selectedUTC.toMillis()),
      timezoneOffsetMinutes: selectedLocal.offset,
      timezoneId: luxonZone,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Content Calendar</h1>
        <Button onClick={() => setScheduleModal({ post: null, open: true })} className="gap-2">
          <Plus className="w-4 h-4" />
          Schedule Post
        </Button>
      </div>

      {/* Upcoming Scheduled Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Upcoming Scheduled Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scheduledPosts.length === 0 ? (
            <p className="text-gray-500">No scheduled posts</p>
          ) : (
            <div className="space-y-3">
              {scheduledPosts.map((post: any) => {
                const statusColors: Record<string, string> = {
                  'scheduled': 'bg-blue-100 text-blue-800',
                  'publishing': 'bg-yellow-100 text-yellow-800',
                  'published': 'bg-green-100 text-green-800',
                  'failed': 'bg-red-100 text-red-800',
                  'cancelled': 'bg-gray-100 text-gray-800',
                };
                const statusColor = statusColors[post.status] || 'bg-gray-100 text-gray-800';
                
                return (
                  <div key={post.id} className="flex flex-col p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {post.imageUrl && (
                          <img src={post.imageUrl} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{post.title || post.platform} | {new Date(post.scheduledAt).toLocaleDateString('en-AU')} {new Date(post.scheduledAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
                          {post.connectionName && (
                            <p className="text-xs text-gray-500 mt-1">
                              <span className="font-medium">{post.connectionName}</span>
                            </p>
                          )}
                          {post.publishedAt && (
                            <p className="text-xs text-green-600 mt-0.5">
                              Published: {new Date(post.publishedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${statusColor}`}>
                          {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Error message for failed posts */}
                    {post.status === 'failed' && post.lastError && (
                      <div className="bg-red-50 p-2 rounded mt-2 mb-2">
                        <p className="text-xs text-red-700">⚠️ {post.lastError}</p>
                      </div>
                    )}
                    
                    {/* Action buttons */}
                    <div className="flex gap-2 justify-end mt-2">
                      {post.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryMutation.mutate({ id: post.id })}
                          disabled={retryMutation.isPending}
                          className="text-xs"
                        >
                          {retryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Retry
                        </Button>
                      )}
                      {(post.status === 'scheduled' || post.status === 'failed') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Cancel this scheduled post?')) {
                              deleteMutation.mutate({ id: post.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="text-xs"
                        >
                          {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3" />}
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Post Modal */}
      <Dialog open={scheduleModal?.open ?? false} onOpenChange={(open) => !open && setScheduleModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Post</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Select Post */}
            <div>
              <label className="text-sm font-medium">Select Approved Post</label>
              <select
                className="w-full p-2 border rounded mt-1"
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const post = approvedPosts.find((p: any) => p.id === parseInt(e.target.value));
                  setScheduleModal({ post, open: true });
                }}
              >
                <option value="">Choose a post...</option>
                {approvedPosts.map((post: any) => (
                  <option key={post.id} value={post.id}>
                    {post.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Platform Connection */}
            <div>
              <label className="text-sm font-medium">
                Platform Connection
                {!selectedConnectionId && <span className="text-red-500 ml-1">*</span>}
              </label>
              <select
                className={`w-full p-2 border rounded mt-1 ${
                  !selectedConnectionId && scheduleModal?.open ? 'border-red-500 bg-red-50' : ''
                }`}
                value={selectedConnectionId || ""}
                onChange={(e) => setSelectedConnectionId(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">Select connection...</option>
                {connections?.map((conn: any) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.pageName || conn.name || `Connection ${conn.id}`} {conn.isActive ? '' : '(Inactive)'}
                  </option>
                ))}
              </select>
              {!selectedConnectionId && scheduleModal?.open && (
                <p className="text-red-500 text-sm mt-1">Platform connection is required</p>
              )}
            </div>

            {/* Platform */}
            <div>
              <label className="text-sm font-medium">Platform</label>
              <div className="flex gap-2 mt-2">
                {['facebook', 'instagram', 'tiktok'].map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setSelectedPlatform(platform as any)}
                    className={`px-4 py-2 rounded border ${
                      selectedPlatform === platform ? 'bg-blue-500 text-white' : 'border-gray-300'
                    }`}
                  >
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="text-sm font-medium">Timezone</label>
              <select
                className="w-full p-2 border rounded mt-1"
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
              >
                <option value="AEST">AEST (UTC+10) - Australia Eastern</option>
                <option value="AEDT">AEDT (UTC+11) - Australia Eastern Daylight</option>
                <option value="ACST">ACST (UTC+9:30) - Australia Central</option>
                <option value="ACDT">ACDT (UTC+10:30) - Australia Central Daylight</option>
                <option value="AWST">AWST (UTC+8) - Australia Western</option>
                <option value="UTC">UTC (UTC+0)</option>
              </select>
            </div>

            {/* Date & Time */}
            <div>
              <label className="text-sm font-medium">
                Date & Time
                <span className="text-blue-600 ml-2 font-semibold">
                  Scheduled in {selectedTimezone === 'AEST' ? 'Australia/Brisbane' : selectedTimezone === 'AEDT' ? 'Australia/Brisbane' : selectedTimezone === 'ACST' ? 'Australia/Adelaide' : selectedTimezone === 'ACDT' ? 'Australia/Adelaide' : selectedTimezone === 'AWST' ? 'Australia/Perth' : 'UTC'} time
                </span>
              </label>
              <input
                type="datetime-local"
                className="w-full p-2 border rounded mt-1"
                value={selectedDateTime}
                onChange={(e) => setSelectedDateTime(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your post will be published at this exact time in your selected timezone.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setScheduleModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={scheduleMutation.isPending || !selectedConnectionId || !selectedDateTime || !scheduleModal?.post}
                className="gap-2"
              >
                {scheduleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Schedule Post
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

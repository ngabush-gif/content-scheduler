/**
 * Comprehensive Scheduler Logging System
 * 
 * Tracks every scheduled post through its entire lifecycle:
 * - Creation (user selects time)
 * - Storage (database)
 * - Worker checks (every 30 seconds)
 * - Publishing attempt
 * - Success/failure
 * - Retries
 * 
 * This logging is critical for debugging multi-day scheduling issues.
 */

import { DateTime } from 'luxon';

interface SchedulerLogEntry {
  timestamp: string;
  timestampUTC: string;
  timestampBrisbane: string;
  postId: number;
  scheduledPostId: number;
  event: string;
  details: Record<string, any>;
}

// In-memory log (will be cleared on server restart, but that's ok for debugging)
const schedulerLogs: SchedulerLogEntry[] = [];
const MAX_LOGS = 10000; // Keep last 10k entries

function getTimestamps() {
  const now = new Date();
  const utc = DateTime.utc();
  const brisbane = utc.setZone('Australia/Brisbane');
  
  return {
    timestamp: now.toISOString(),
    timestampUTC: utc.toISO() || '',
    timestampBrisbane: brisbane.toISO() || '',
  };
}

export function logSchedulerEvent(
  postId: number,
  scheduledPostId: number,
  event: string,
  details: Record<string, any> = {}
) {
  const ts = getTimestamps();
  const entry: SchedulerLogEntry = {
    ...ts,
    postId,
    scheduledPostId,
    event,
    details,
  };
  
  schedulerLogs.push(entry);
  
  // Keep log size manageable
  if (schedulerLogs.length > MAX_LOGS) {
    schedulerLogs.shift();
  }
  
  // Also log to console for immediate visibility
  console.log(`[SchedulerLog] ${event}:`, {
    postId,
    scheduledPostId,
    ...ts,
    ...details,
  });
}

export function logScheduleCreation(
  postId: number,
  scheduledPostId: number,
  userSelectedLocalTime: string,
  userTimezone: string,
  storedUTCMs: number,
  connectionId: number,
  platform: string
) {
  const storedUTC = DateTime.fromMillis(storedUTCMs).toUTC();
  const userLocal = DateTime.fromMillis(storedUTCMs).setZone(userTimezone);
  
  logSchedulerEvent(postId, scheduledPostId, 'SCHEDULE_CREATED', {
    userSelectedLocalTime,
    userTimezone,
    storedUTCMs,
    storedUTC: storedUTC.toISO(),
    userLocalTime: userLocal.toISO(),
    connectionId,
    platform,
    message: `Post scheduled by user for ${userSelectedLocalTime} (${userTimezone})`,
  });
}

export function logWorkerCheck(
  scheduledPostId: number,
  postId: number,
  scheduledAtMs: number,
  userTimezone: string,
  currentServerUTC: Date,
  isReady: boolean,
  minutesUntilReady: number
) {
  const scheduledUTC = DateTime.fromMillis(scheduledAtMs).toUTC();
  const scheduledLocal = DateTime.fromMillis(scheduledAtMs).setZone(userTimezone);
  const currentLocal = DateTime.fromJSDate(currentServerUTC).setZone(userTimezone);
  
  logSchedulerEvent(postId, scheduledPostId, 'WORKER_CHECK', {
    scheduledAtMs,
    scheduledUTC: scheduledUTC.toISO(),
    scheduledLocal: scheduledLocal.toISO(),
    currentServerUTC: currentServerUTC.toISOString(),
    currentLocal: currentLocal.toISO(),
    userTimezone,
    isReady,
    minutesUntilReady: minutesUntilReady.toFixed(2),
    message: isReady 
      ? `Post ready to publish (scheduled ${scheduledLocal.toISO()})` 
      : `Post not ready yet (${minutesUntilReady.toFixed(2)} minutes away)`,
  });
}

export function logPublishAttempt(
  scheduledPostId: number,
  postId: number,
  scheduledAtMs: number,
  userTimezone: string,
  platform: string,
  attemptNumber: number
) {
  const scheduledLocal = DateTime.fromMillis(scheduledAtMs).setZone(userTimezone);
  
  logSchedulerEvent(postId, scheduledPostId, 'PUBLISH_ATTEMPT', {
    scheduledAtMs,
    scheduledLocal: scheduledLocal.toISO(),
    userTimezone,
    platform,
    attemptNumber,
    message: `Attempting to publish to ${platform} (attempt ${attemptNumber})`,
  });
}

export function logPublishSuccess(
  scheduledPostId: number,
  postId: number,
  scheduledAtMs: number,
  userTimezone: string,
  platform: string,
  platformPostId: string,
  facebookTimestamp?: string
) {
  const scheduledLocal = DateTime.fromMillis(scheduledAtMs).setZone(userTimezone);
  const publishedLocal = DateTime.now().setZone(userTimezone);
  const delaySeconds = (Date.now() - scheduledAtMs) / 1000;
  
  logSchedulerEvent(postId, scheduledPostId, 'PUBLISH_SUCCESS', {
    scheduledAtMs,
    scheduledLocal: scheduledLocal.toISO(),
    publishedLocal: publishedLocal.toISO(),
    userTimezone,
    platform,
    platformPostId,
    facebookTimestamp,
    delaySeconds: delaySeconds.toFixed(1),
    message: `Successfully published to ${platform} (${delaySeconds.toFixed(1)}s delay)`,
  });
}

export function logPublishFailure(
  scheduledPostId: number,
  postId: number,
  scheduledAtMs: number,
  userTimezone: string,
  platform: string,
  errorCode: string,
  errorMessage: string,
  attemptNumber: number
) {
  const scheduledLocal = DateTime.fromMillis(scheduledAtMs).setZone(userTimezone);
  
  logSchedulerEvent(postId, scheduledPostId, 'PUBLISH_FAILURE', {
    scheduledAtMs,
    scheduledLocal: scheduledLocal.toISO(),
    userTimezone,
    platform,
    errorCode,
    errorMessage,
    attemptNumber,
    message: `Failed to publish to ${platform}: ${errorMessage}`,
  });
}

export function logRetry(
  scheduledPostId: number,
  postId: number,
  scheduledAtMs: number,
  userTimezone: string,
  platform: string,
  retryCount: number,
  nextRetryAt: Date
) {
  const scheduledLocal = DateTime.fromMillis(scheduledAtMs).setZone(userTimezone);
  const nextRetryLocal = DateTime.fromJSDate(nextRetryAt).setZone(userTimezone);
  
  logSchedulerEvent(postId, scheduledPostId, 'RETRY_SCHEDULED', {
    scheduledAtMs,
    scheduledLocal: scheduledLocal.toISO(),
    userTimezone,
    platform,
    retryCount,
    nextRetryAt: nextRetryAt.toISOString(),
    nextRetryLocal: nextRetryLocal.toISO(),
    message: `Retry scheduled for ${nextRetryLocal.toISO()} (attempt ${retryCount})`,
  });
}

export function logMissedWindow(
  scheduledPostId: number,
  postId: number,
  scheduledAtMs: number,
  userTimezone: string,
  currentServerUTC: Date,
  minutesMissed: number
) {
  const scheduledLocal = DateTime.fromMillis(scheduledAtMs).setZone(userTimezone);
  const currentLocal = DateTime.fromJSDate(currentServerUTC).setZone(userTimezone);
  
  logSchedulerEvent(postId, scheduledPostId, 'MISSED_WINDOW', {
    scheduledAtMs,
    scheduledLocal: scheduledLocal.toISO(),
    currentServerUTC: currentServerUTC.toISOString(),
    currentLocal: currentLocal.toISO(),
    userTimezone,
    minutesMissed: minutesMissed.toFixed(2),
    message: `⚠️ Post missed its scheduled window by ${minutesMissed.toFixed(2)} minutes!`,
  });
}

export function getSchedulerLogs(postId?: number, limit: number = 100): SchedulerLogEntry[] {
  let logs = [...schedulerLogs];
  
  if (postId) {
    logs = logs.filter(log => log.postId === postId);
  }
  
  // Return most recent logs first
  return logs.reverse().slice(0, limit);
}

export function getSchedulerLogsSummary(): Record<string, any> {
  const eventCounts: Record<string, number> = {};
  const postCounts: Record<number, number> = {};
  
  for (const log of schedulerLogs) {
    eventCounts[log.event] = (eventCounts[log.event] || 0) + 1;
    postCounts[log.postId] = (postCounts[log.postId] || 0) + 1;
  }
  
  return {
    totalLogs: schedulerLogs.length,
    eventCounts,
    uniquePosts: Object.keys(postCounts).length,
    postCounts,
    oldestLog: schedulerLogs[0]?.timestamp,
    newestLog: schedulerLogs[schedulerLogs.length - 1]?.timestamp,
  };
}

export function clearSchedulerLogs() {
  const count = schedulerLogs.length;
  schedulerLogs.length = 0;
  console.log(`[SchedulerLog] Cleared ${count} logs`);
}

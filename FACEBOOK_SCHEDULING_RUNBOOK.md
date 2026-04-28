# Facebook Scheduling Runbook

## Quick Reference

| Component | Status | Details |
|-----------|--------|---------|
| **Scheduler Type** | Hybrid | Internal (60s) + External Cron (5min) |
| **Timezone** | Australia/Brisbane | AEST/AEDT (UTC+10) |
| **Endpoint** | `/api/scheduled/publish-due-posts` | POST, Bearer token authenticated |
| **Cron Interval** | Every 5 minutes | External service calls endpoint |
| **Fallback** | Every 60 seconds | Internal scheduler (if external fails) |
| **Max Lateness** | 5 minutes | External + 60 seconds internal = 6 min max |
| **SLA** | ±1 minute | Posts publish within 1 minute of scheduled time |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ User schedules post for 8:00 AM Brisbane                 │
│ Frontend converts to UTC: 10:00 PM previous day          │
│ Stored in database as Unix milliseconds (UTC)            │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌─────────────────────┐      ┌──────────────────┐
│ External Cron       │      │ Internal Fallback│
│ Every 5 minutes     │      │ Every 60 seconds │
│ (Primary)           │      │ (Fallback)       │
└──────────┬──────────┘      └────────┬─────────┘
           │                          │
           └──────────────┬───────────┘
                          │
                          ▼
        ┌─────────────────────────────────┐
        │ /api/scheduled/publish-due-posts│
        │ (Bearer token authenticated)    │
        └──────────────┬──────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────────┐         ┌──────────────────┐
│ Check database   │         │ Log timezone-    │
│ for due posts    │         │ aware times      │
└──────────┬───────┘         └──────────────────┘
           │
           ▼
┌──────────────────────────┐
│ Publish to Facebook      │
│ with full captions       │
└──────────────┬───────────┘
               │
               ▼
┌──────────────────────────┐
│ Post appears on Facebook │
│ at 8:00 AM Brisbane time │
└──────────────────────────┘
```

---

## Daily Operations

### Morning Checklist (Before Business Hours)

**1. Verify Endpoint is Accessible**

```bash
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

Expected response:
```json
{
  "success": true,
  "postsPublished": 0,
  "durationMs": 145,
  "timestamp": "2026-04-28T09:54:42.906Z",
  "source": "external-cron"
}
```

**2. Check Scheduler Health**

```bash
tail -50 .manus-logs/devserver.log | grep "ResilientScheduler.*Health check"
```

Expected: `"status": "running"` with low error count

**3. Verify No Overnight Issues**

```bash
grep "PUBLISH_FAILURE\|❌\|error" .manus-logs/devserver.log | wc -l
```

Expected: 0 errors (or very few)

### During Business Hours

**1. Monitor Cron Calls (Every 30 Minutes)**

```bash
grep "Authorized cron trigger" .manus-logs/devserver.log | tail -5
```

Expected: Multiple entries in last 30 minutes

**2. Check for Stuck Posts**

```bash
# Look for posts stuck in "publishing" state
# SELECT * FROM scheduled_posts WHERE status = 'publishing' AND publishingStartedAt < NOW() - INTERVAL 2 MINUTE;
```

Expected: 0 stuck posts (auto-marked as failed after 2 minutes)

**3. Verify Published Posts**

```bash
grep "PUBLISH_SUCCESS" .manus-logs/devserver.log | tail -10
```

Expected: Recent successful publishes with correct timestamps

### Evening Checklist (End of Business Hours)

**1. Summary of Day's Publishing**

```bash
echo "=== Daily Summary ===" && \
echo "Total publishes:" && \
grep "PUBLISH_SUCCESS" .manus-logs/devserver.log | wc -l && \
echo "Total failures:" && \
grep "PUBLISH_FAILURE" .manus-logs/devserver.log | wc -l && \
echo "Last cron call:" && \
grep "Authorized cron trigger" .manus-logs/devserver.log | tail -1
```

**2. Check for Pending Posts**

```bash
# SELECT COUNT(*) FROM scheduled_posts WHERE status = 'scheduled' AND scheduledAt < NOW();
```

Expected: 0 overdue posts (all should be published)

**3. Verify No Errors**

```bash
grep "error\|Error\|ERROR" .manus-logs/devserver.log | grep -v "lastError" | tail -10
```

Expected: No critical errors

---

## Monitoring

### Real-Time Monitoring

**Watch publishing as it happens:**

```bash
tail -f .manus-logs/devserver.log | grep -E "ResilientScheduler|ScheduledPublish|PUBLISH"
```

### Log Analysis

**Find all publishes in last hour:**

```bash
grep "PUBLISH_SUCCESS" .manus-logs/devserver.log | tail -20
```

**Find all failures in last hour:**

```bash
grep "PUBLISH_FAILURE" .manus-logs/devserver.log | tail -20
```

**Find all cron calls in last hour:**

```bash
grep "Authorized cron trigger" .manus-logs/devserver.log | tail -12
```

**Check timezone conversions:**

```bash
grep "scheduledLocal\|scheduledUTC" .manus-logs/devserver.log | head -10
```

---

## Troubleshooting

### Problem: Posts Not Publishing

**Step 1: Verify endpoint is accessible**

```bash
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

If this fails → Check network connectivity, SSL certificate, endpoint URL

**Step 2: Check if cron is calling endpoint**

```bash
grep "Authorized cron trigger" .manus-logs/devserver.log | tail -5
```

If no recent entries → External cron service is not running, check cron-job.org/EasyCron

**Step 3: Check if posts are in database**

```bash
# SELECT * FROM scheduled_posts WHERE status = 'scheduled' ORDER BY scheduledAt LIMIT 10;
```

If empty → No posts scheduled, or all already published

**Step 4: Check logs for publishing errors**

```bash
grep "PUBLISH_FAILURE\|error" .manus-logs/devserver.log | tail -10
```

If errors found → See "Specific Errors" section below

### Problem: Posts Publishing Late (> 5 Minutes)

**Check 1: Is cron running frequently enough?**

```bash
# Count cron calls in last hour
grep "Authorized cron trigger" .manus-logs/devserver.log | tail -12 | wc -l
```

Expected: ~12 calls per hour (every 5 minutes)

If fewer → External cron service misconfigured

**Check 2: Is publishing taking too long?**

```bash
grep "durationMs" .manus-logs/devserver.log | tail -5
```

Expected: All < 5000ms

If higher → Database slow, Facebook API slow, or network issues

**Check 3: Is there a queue of posts?**

```bash
# SELECT COUNT(*) FROM scheduled_posts WHERE status IN ('scheduled', 'publishing');
```

Expected: 0-1 posts

If higher → Scheduler is backed up, may need to restart

### Problem: Wrong Timezone on Facebook

**Check 1: Verify post is stored in UTC**

```bash
grep "scheduledUTC\|scheduledLocal" .manus-logs/devserver.log | head -5
```

Expected: `scheduledLocal` shows Brisbane time (UTC+10)

If wrong → Frontend timezone conversion bug

**Check 2: Verify Facebook timestamp**

1. Go to Facebook page
2. Click post timestamp
3. Check timezone indicator

Expected: Shows correct Brisbane time

If wrong → Facebook API timestamp issue (rare)

### Problem: Duplicate Posts on Facebook

**Check 1: Look for multiple PUBLISH_SUCCESS entries**

```bash
grep "PUBLISH_SUCCESS" .manus-logs/devserver.log | grep "postId.*123456"
```

Expected: Only 1 entry per post

If multiple → Scheduler ran twice for same post (shouldn't happen with atomic locking)

**Check 2: Check Facebook for duplicates**

Expected: Each post appears exactly once

If duplicates → Manual cleanup needed (delete duplicate from Facebook)

### Specific Errors

**Error: "Unauthorized: Invalid or missing Bearer token"**

- **Cause:** CRON_SECRET_TOKEN not set or incorrect
- **Fix:** Verify token in environment variables, regenerate if needed

**Error: "Database unavailable"**

- **Cause:** Database connection failed
- **Fix:** Check database connection string, verify database is running

**Error: "Content post not found"**

- **Cause:** Post was deleted after scheduling
- **Fix:** Reschedule post, mark as failed in database

**Error: "Platform connection not found"**

- **Cause:** User's Facebook credentials were deleted
- **Fix:** User needs to reconnect Facebook account

**Error: "Facebook API error: (104) Requires valid access token"**

- **Cause:** Facebook access token expired
- **Fix:** User needs to reconnect Facebook account, refresh token

---

## Recovery Procedures

### If Scheduler Stops Running

**Step 1: Check if process is alive**

```bash
ps aux | grep "node\|tsx" | grep -v grep
```

**Step 2: Restart the server**

```bash
# In the Manus UI, click "Restart Server"
# Or manually: kill the process and restart
```

**Step 3: Verify scheduler started**

```bash
tail -20 .manus-logs/devserver.log | grep "ResilientScheduler"
```

Expected: `[ResilientScheduler] ✓ Scheduler started with error recovery`

### If Cron Service Stops Calling Endpoint

**Step 1: Check cron service status**

- **cron-job.org:** Log in → check "Logs" tab
- **EasyCron:** Log in → check "Execution History"
- **AWS EventBridge:** Check CloudWatch logs
- **Google Cloud:** Check Cloud Logging

**Step 2: Verify token is still correct**

```bash
# Check token in cron service configuration
# Compare with CRON_SECRET_TOKEN environment variable
```

**Step 3: Manually trigger endpoint to verify it works**

```bash
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Step 4: Re-enable cron service**

- Check cron service is enabled/active
- Verify URL and headers are correct
- Test with manual trigger first

### If Posts Get Stuck in "Publishing" State

**Step 1: Check how long they've been stuck**

```bash
# SELECT * FROM scheduled_posts WHERE status = 'publishing' AND publishingStartedAt < NOW() - INTERVAL 2 MINUTE;
```

**Step 2: Auto-recovery (happens automatically)**

- Posts stuck > 2 minutes are marked as "failed"
- Check logs for failure reason
- User can manually retry from UI

**Step 3: Manual recovery (if needed)**

```sql
-- Mark stuck post as failed
UPDATE scheduled_posts 
SET status = 'failed', 
    errorMessage = 'Stuck in publishing state, auto-recovered'
WHERE id = 123 AND status = 'publishing';
```

---

## Maintenance

### Weekly Tasks

- [ ] Review publishing logs for errors
- [ ] Check cron service status (cron-job.org, EasyCron, etc.)
- [ ] Verify no stuck posts in database
- [ ] Test endpoint manually with curl
- [ ] Check database connection health

### Monthly Tasks

- [ ] Rotate CRON_SECRET_TOKEN (security best practice)
- [ ] Review and update documentation
- [ ] Test disaster recovery procedures
- [ ] Verify Facebook API access tokens are fresh
- [ ] Clean up old logs (keep last 30 days)

### Quarterly Tasks

- [ ] Full system audit (endpoint, database, logs)
- [ ] Load testing (simulate high volume of scheduled posts)
- [ ] Disaster recovery drill (simulate server failure)
- [ ] Security review (token rotation, access control)
- [ ] Performance optimization review

---

## Performance Targets

| Metric | Target | Acceptable | Alert |
|--------|--------|-----------|-------|
| Endpoint response time | < 500ms | < 2s | > 5s |
| Publishing lateness | ±30 seconds | ±1 minute | > 5 min |
| Cron call frequency | Every 5 min | Every 5-6 min | > 10 min |
| Success rate | 100% | 99.5% | < 99% |
| Database errors | 0 | < 1 per day | > 1 per hour |

---

## Escalation

**If you encounter issues:**

1. **Check troubleshooting section above** - Most issues are covered
2. **Review server logs** - Look for error messages and stack traces
3. **Test endpoint manually** - Verify it's accessible and working
4. **Check external services** - Verify cron service is running, Facebook API is up
5. **Document the issue** - Record exact time, error message, steps to reproduce

**Critical issues requiring immediate action:**

- Endpoint returning 500 errors
- Database connection failures
- Posts not publishing for > 1 hour
- Duplicate posts appearing on Facebook
- Cron service not calling endpoint for > 30 minutes

---

## Contact & Support

For issues or questions:

1. Check this runbook first
2. Review FACEBOOK_VERIFICATION_GUIDE.md for detailed verification steps
3. Check EXTERNAL_CRON_SETUP.md for cron service configuration
4. Review CRON_CURL_EXAMPLES.md for testing examples

---

## Version Information

- **Document Version:** 1.0
- **Last Updated:** 2026-04-28
- **Scheduler Version:** 2.0 (Hybrid Architecture)
- **Timezone:** Australia/Brisbane (AEST/AEDT)
- **Status:** Production Ready (pending 24-48 hour verification)

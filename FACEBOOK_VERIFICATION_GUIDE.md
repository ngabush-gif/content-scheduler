# Facebook Scheduling Verification Guide

## Overview

This guide walks through verifying that Facebook post scheduling is 100% reliable and production-ready. The verification process takes 24-48 hours and confirms posts publish at exact scheduled Brisbane times.

---

## Phase 1: Endpoint Verification (Complete Before Testing)

### 1.1 Verify Endpoint is Accessible

**Test from your local machine:**

```bash
curl -v -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected response (HTTP 200):**

```json
{
  "success": true,
  "postsPublished": 0,
  "durationMs": 145,
  "timestamp": "2026-04-28T09:54:42.906Z",
  "source": "external-cron"
}
```

**Verification checklist:**
- [ ] HTTP status is 200
- [ ] Response contains `"success": true`
- [ ] Response contains `"source": "external-cron"`
- [ ] Response time is < 1 second
- [ ] No SSL certificate errors

### 1.2 Test Bearer Token Authentication

**Test WITHOUT token (should fail):**

```bash
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected response (HTTP 401):**

```json
{
  "error": "Unauthorized: Invalid or missing Bearer token"
}
```

**Test WITH invalid token (should fail):**

```bash
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected response (HTTP 401):**

```json
{
  "error": "Unauthorized: Invalid or missing Bearer token"
}
```

**Verification checklist:**
- [ ] Missing token returns 401
- [ ] Invalid token returns 401
- [ ] Valid token returns 200
- [ ] Error messages are consistent

### 1.3 Check Database Connection

**Monitor server logs for connection errors:**

```bash
grep -i "database\|connection\|error" .manus-logs/devserver.log | tail -20
```

**Expected:** No connection errors in the last 20 lines

**Verification checklist:**
- [ ] No "Database unavailable" errors
- [ ] No "ECONNRESET" errors
- [ ] No "ETIMEDOUT" errors
- [ ] Scheduler health check shows `"status": "running"`

---

## Phase 2: Quick Scheduling Test (5-10 Minutes)

### 2.1 Create Test Post Scheduled for 5 Minutes from Now

1. Go to Calendar page
2. Click "Schedule Post" button
3. Select a simple test post (or create one)
4. Set scheduled time to **5 minutes from now** (Brisbane time)
5. Click "Schedule"
6. Note the exact scheduled time and post ID

**Example:**
- Current time: 10:00 AM Brisbane
- Scheduled time: 10:05 AM Brisbane
- Post ID: 123456

### 2.2 Monitor Logs for Publishing

**Watch the server logs in real-time:**

```bash
tail -f .manus-logs/devserver.log | grep -E "ResilientScheduler|ScheduledPublish|PUBLISH"
```

**Expected log sequence (within 5 minutes):**

```
[ResilientScheduler] ⏱️ Cycle #1 started at 2026-04-28T00:05:00.000Z
[ResilientScheduler] Found 1 scheduled posts
[ResilientScheduler] 🔄 Publishing post 123456 (attempt 1)
[SchedulerLog] PUBLISH_ATTEMPT: Post 123456 scheduled for 10:05 AM Brisbane
[ResilientScheduler] ✅ Post 123456 published successfully to facebook
[SchedulerLog] PUBLISH_SUCCESS: Post published at 10:05 AM Brisbane time
```

**Verification checklist:**
- [ ] Post appears in logs at or before scheduled time
- [ ] Status changes from "scheduled" to "publishing"
- [ ] Status changes from "publishing" to "published"
- [ ] No errors in the publishing attempt
- [ ] Facebook timestamp matches Brisbane time

### 2.3 Verify on Facebook

1. Go to your Facebook page
2. Check the post appeared
3. Click on the post timestamp
4. Verify it shows **exactly 10:05 AM** (or your scheduled time)

**Verification checklist:**
- [ ] Post appears on Facebook page
- [ ] Post timestamp matches scheduled time (±1 minute)
- [ ] Post content is complete (caption, hashtags, image)
- [ ] No duplicate posts

---

## Phase 3: Multi-Time Verification (24-48 Hours)

### 3.1 Schedule Test Posts at Different Times

Schedule 5-10 test posts across different times over the next 24-48 hours:

| Time | Day | Post Title | Status |
|------|-----|-----------|--------|
| 8:00 AM | Tomorrow | Test Morning Post | [ ] |
| 12:30 PM | Tomorrow | Test Midday Post | [ ] |
| 5:00 PM | Tomorrow | Test Evening Post | [ ] |
| 8:00 AM | Day After | Test Day 2 Morning | [ ] |
| 2:00 PM | Day After | Test Day 2 Afternoon | [ ] |

**For each post:**

1. Go to Calendar
2. Click "Schedule Post"
3. Select the post
4. Set scheduled time (Brisbane timezone)
5. Click "Schedule"
6. **Record:**
   - Post ID
   - Scheduled time (exact Brisbane time)
   - Scheduled timestamp (UTC)

### 3.2 Monitor Every 30 Minutes

**Set a reminder to check logs every 30 minutes:**

```bash
# Run this command every 30 minutes
echo "=== $(date) ===" >> facebook_verification.log
grep "Authorized cron trigger\|PUBLISH_SUCCESS\|PUBLISH_FAILURE" .manus-logs/devserver.log | tail -5 >> facebook_verification.log
```

**Or create a monitoring script:**

```bash
#!/bin/bash
while true; do
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
  grep "Authorized cron trigger" .manus-logs/devserver.log | tail -1
  grep "PUBLISH_SUCCESS\|PUBLISH_FAILURE" .manus-logs/devserver.log | tail -2
  sleep 1800  # 30 minutes
done
```

### 3.3 Track Each Post Through Publishing

For each scheduled post, create a tracking record:

```
Post ID: 123456
Title: Test Morning Post
Scheduled Time (Brisbane): 2026-04-29 08:00:00 AEST
Scheduled Time (UTC): 2026-04-28 22:00:00 UTC

Timeline:
- 2026-04-29 07:55:00 AEST: Post marked as "scheduled" ✓
- 2026-04-29 08:00:00 AEST: Cron trigger called endpoint ✓
- 2026-04-29 08:00:15 AEST: Worker found post ready ✓
- 2026-04-29 08:00:30 AEST: Published to Facebook ✓
- 2026-04-29 08:00:45 AEST: Facebook timestamp verified ✓

Actual Publish Time: 2026-04-29 08:00:30 AEST
Scheduled Time: 2026-04-29 08:00:00 AEST
Delay: 30 seconds ✓ (within acceptable range)
```

**Verification checklist:**
- [ ] Post published within ±1 minute of scheduled time
- [ ] Facebook timestamp matches Brisbane time
- [ ] No duplicate publishes
- [ ] No failed publishes
- [ ] Logs show complete publishing flow

### 3.4 Check for Issues

**Monitor for these issues during 24-48 hours:**

| Issue | Check | Expected |
|-------|-------|----------|
| Missed publishes | Posts that don't appear on Facebook | 0 missed |
| Late publishes | Posts published > 5 minutes after scheduled | 0 late |
| Duplicate publishes | Same post appears twice on Facebook | 0 duplicates |
| Wrong timezone | Posts show wrong time on Facebook | All correct |
| Database errors | Connection failures in logs | 0 errors |
| Cron failures | "Authorized cron trigger" entries missing | Every 5 min |

---

## Phase 4: Production Readiness Checklist

### 4.1 Endpoint Health

- [ ] Endpoint responds to all requests < 1 second
- [ ] Bearer token authentication working
- [ ] No database connection errors
- [ ] Response format is valid JSON
- [ ] HTTP status codes are correct (200 for success, 401 for auth failure)

### 4.2 Scheduling Accuracy

- [ ] All test posts published at exact scheduled time (±1 minute)
- [ ] Facebook timestamps match Brisbane timezone
- [ ] No posts missed or delayed
- [ ] No duplicate publishes
- [ ] Catch-up logic works (if server restarted)

### 4.3 Logging & Monitoring

- [ ] Logs show complete publishing flow for each post
- [ ] Timezone conversions are correct (UTC ↔ Brisbane)
- [ ] Error messages are clear and actionable
- [ ] Health checks run every 5 minutes
- [ ] No errors in 24-48 hour period

### 4.4 Documentation

- [ ] EXTERNAL_CRON_SETUP.md is complete
- [ ] CRON_CURL_EXAMPLES.md has working examples
- [ ] FACEBOOK_SCHEDULING_RUNBOOK.md is ready
- [ ] Troubleshooting guide covers common issues
- [ ] Monitoring checklist is documented

---

## Phase 5: Troubleshooting

### Issue: Posts Not Publishing

**Check 1: Is endpoint being called?**

```bash
grep "Authorized cron trigger" .manus-logs/devserver.log | tail -5
```

Expected: Multiple entries in last 30 minutes

**Check 2: Is post in database?**

```bash
# Check scheduled_posts table
# SELECT * FROM scheduled_posts WHERE status = 'scheduled' ORDER BY scheduledAt;
```

Expected: Post appears with status "scheduled"

**Check 3: Is post ready to publish?**

```bash
grep "WORKER_CHECK.*postId.*123456" .manus-logs/devserver.log
```

Expected: Log shows `"isReady": true` when current time >= scheduled time

### Issue: Posts Publishing Late (> 5 minutes)

**Check 1: Is cron running every 5 minutes?**

```bash
grep "Authorized cron trigger" .manus-logs/devserver.log | wc -l
```

Expected: ~12 entries per hour (every 5 minutes)

**Check 2: Is publishing taking too long?**

```bash
grep "durationMs" .manus-logs/devserver.log | tail -5
```

Expected: All < 5000ms (5 seconds)

### Issue: Wrong Timezone on Facebook

**Check 1: Verify scheduled time is in UTC**

```bash
grep "scheduledUTC\|scheduledLocal" .manus-logs/devserver.log | head -5
```

Expected: `scheduledLocal` shows Brisbane time (UTC+10)

**Check 2: Verify Facebook timestamp**

Click post on Facebook → click timestamp → check timezone

Expected: Shows correct Brisbane time

### Issue: Duplicate Publishes

**Check 1: Look for multiple PUBLISH_SUCCESS entries**

```bash
grep "PUBLISH_SUCCESS.*postId.*123456" .manus-logs/devserver.log
```

Expected: Only 1 entry per post

**Check 2: Check Facebook for duplicate posts**

Expected: Each post appears exactly once

---

## Success Criteria

Facebook scheduling is **production-ready** when:

1. **✅ Endpoint Verification**
   - Endpoint responds to all requests
   - Bearer token authentication working
   - No database errors

2. **✅ Scheduling Accuracy**
   - All test posts published at exact scheduled time (±1 minute)
   - Facebook timestamps match Brisbane timezone
   - No missed or late publishes

3. **✅ 24-48 Hour Monitoring**
   - 5-10 test posts published successfully
   - No duplicate publishes
   - No errors in logs
   - Consistent performance across different times

4. **✅ Documentation**
   - Setup guide complete
   - Troubleshooting guide complete
   - Monitoring checklist ready
   - Runbook documented

---

## Next Steps

Once all verification is complete:

1. **Document Results** - Record all test data and findings
2. **Create Final Checkpoint** - Save production-ready state
3. **Declare Production Ready** - Facebook scheduling is stable
4. **Plan Next Phase** - Consider future enhancements (Instagram, video, etc.)

---

## Support

If issues are found during verification:

1. Check the troubleshooting section above
2. Review server logs in `.manus-logs/devserver.log`
3. Test endpoint manually with curl
4. Verify database connection
5. Check Facebook API status

For persistent issues, document:
- Exact time of issue
- Post ID affected
- Error message from logs
- Steps to reproduce

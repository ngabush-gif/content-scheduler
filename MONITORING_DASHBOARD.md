# Facebook Scheduling - 24-48 Hour Monitoring Dashboard

## Test Period Overview

| Item | Value |
|------|-------|
| **Start Time** | [To be filled by user] |
| **End Time** | [To be filled by user] |
| **Duration** | 24-48 hours |
| **Test Posts Scheduled** | [To be filled] |
| **Timezone** | Australia/Brisbane (AEST/AEDT) |
| **External Cron Service** | [cron-job.org / EasyCron / AWS / GCP] |

---

## Test Post Schedule

Create and schedule posts at these times. Record the exact scheduled time and post ID for each.

### Day 1

| Time | Post Title | Post ID | Scheduled Time (Brisbane) | Scheduled Time (UTC) | Status |
|------|-----------|---------|--------------------------|----------------------|--------|
| 8:00 AM | Test Morning Post 1 | [ ] | [ ] | [ ] | [ ] |
| 12:30 PM | Test Midday Post 1 | [ ] | [ ] | [ ] | [ ] |
| 5:00 PM | Test Evening Post 1 | [ ] | [ ] | [ ] | [ ] |

### Day 2

| Time | Post Title | Post ID | Scheduled Time (Brisbane) | Scheduled Time (UTC) | Status |
|------|-----------|---------|--------------------------|----------------------|--------|
| 8:00 AM | Test Morning Post 2 | [ ] | [ ] | [ ] | [ ] |
| 12:30 PM | Test Midday Post 2 | [ ] | [ ] | [ ] | [ ] |
| 5:00 PM | Test Evening Post 2 | [ ] | [ ] | [ ] | [ ] |

---

## Monitoring Checklist

### Every 30 Minutes

**Time: __________ (Brisbane Time)**

```bash
# Run these commands and record results

# 1. Check cron calls
grep "Authorized cron trigger" .manus-logs/devserver.log | tail -1
Result: [ ] Found / [ ] Not found

# 2. Check for errors
grep "PUBLISH_FAILURE\|error\|Error" .manus-logs/devserver.log | tail -3
Result: [ ] No errors / [ ] Errors found (describe below)

# 3. Check recent publishes
grep "PUBLISH_SUCCESS" .manus-logs/devserver.log | tail -3
Result: [ ] Posts published / [ ] No recent publishes

# 4. Check scheduler health
grep "ResilientScheduler.*Health check" .manus-logs/devserver.log | tail -1
Result: [ ] Running / [ ] Issues found
```

**Notes:**
```
[Space for notes about this 30-minute period]
```

---

## Per-Post Tracking

For each scheduled post, create a tracking record using this template:

### Post Template

**Post ID:** ___________
**Title:** ___________
**Platform:** Facebook
**Scheduled Time (Brisbane):** ___________
**Scheduled Time (UTC):** ___________

**Timeline:**

| Event | Time (Brisbane) | Time (UTC) | Status |
|-------|-----------------|-----------|--------|
| Post scheduled | [ ] | [ ] | ✓ |
| Post appears in database | [ ] | [ ] | [ ] |
| Cron trigger called | [ ] | [ ] | [ ] |
| Worker found post ready | [ ] | [ ] | [ ] |
| Publishing started | [ ] | [ ] | [ ] |
| Published to Facebook | [ ] | [ ] | [ ] |
| Facebook timestamp verified | [ ] | [ ] | [ ] |

**Actual Publish Time (Brisbane):** ___________
**Actual Publish Time (UTC):** ___________
**Scheduled Time (Brisbane):** ___________
**Delay:** ___________
**Within SLA (±1 min)?** [ ] Yes / [ ] No

**Facebook Post URL:** ___________
**Facebook Timestamp:** ___________
**Timezone on Facebook:** ___________

**Issues Found:** [ ] None / [ ] Describe below
```
[Space for issues]
```

---

## Daily Summary

### Day 1 Summary

**Date:** ___________

**Posts Scheduled:** ___________
**Posts Published:** ___________
**Posts Failed:** ___________
**Success Rate:** ___________

**Issues Found:**
```
[Space for issues]
```

**Cron Service Status:**
- [ ] Running normally
- [ ] Intermittent failures
- [ ] Not calling endpoint

**Database Status:**
- [ ] Healthy
- [ ] Connection issues
- [ ] Stuck posts

**Scheduler Status:**
- [ ] Running normally
- [ ] Errors in logs
- [ ] Health check issues

**Notes:**
```
[Space for general notes]
```

---

### Day 2 Summary

**Date:** ___________

**Posts Scheduled:** ___________
**Posts Published:** ___________
**Posts Failed:** ___________
**Success Rate:** ___________

**Issues Found:**
```
[Space for issues]
```

**Cron Service Status:**
- [ ] Running normally
- [ ] Intermittent failures
- [ ] Not calling endpoint

**Database Status:**
- [ ] Healthy
- [ ] Connection issues
- [ ] Stuck posts

**Scheduler Status:**
- [ ] Running normally
- [ ] Errors in logs
- [ ] Health check issues

**Notes:**
```
[Space for general notes]
```

---

## Issue Tracking

### Issue #1

**Time Found:** ___________
**Severity:** [ ] Critical / [ ] High / [ ] Medium / [ ] Low
**Description:**
```
[Describe the issue]
```

**Steps to Reproduce:**
```
[How to reproduce]
```

**Error Message:**
```
[Error from logs]
```

**Resolution:**
```
[How it was resolved]
```

**Status:** [ ] Resolved / [ ] Pending / [ ] Investigating

---

### Issue #2

**Time Found:** ___________
**Severity:** [ ] Critical / [ ] High / [ ] Medium / [ ] Low
**Description:**
```
[Describe the issue]
```

**Steps to Reproduce:**
```
[How to reproduce]
```

**Error Message:**
```
[Error from logs]
```

**Resolution:**
```
[How it was resolved]
```

**Status:** [ ] Resolved / [ ] Pending / [ ] Investigating

---

## Performance Metrics

### Cron Execution Frequency

**Expected:** Every 5 minutes
**Actual:** ___________
**Status:** [ ] Correct / [ ] Too frequent / [ ] Too infrequent

### Endpoint Response Time

**Expected:** < 500ms
**Actual (average):** ___________
**Actual (max):** ___________
**Status:** [ ] Acceptable / [ ] Slow / [ ] Very slow

### Publishing Lateness

| Post | Scheduled | Actual | Delay | Within SLA |
|------|-----------|--------|-------|-----------|
| [ ] | [ ] | [ ] | [ ] | [ ] |
| [ ] | [ ] | [ ] | [ ] | [ ] |
| [ ] | [ ] | [ ] | [ ] | [ ] |
| [ ] | [ ] | [ ] | [ ] | [ ] |
| [ ] | [ ] | [ ] | [ ] | [ ] |

**Average Delay:** ___________
**Max Delay:** ___________
**Min Delay:** ___________
**SLA Compliance:** ___________

### Success Rate

**Total Posts:** ___________
**Successfully Published:** ___________
**Failed:** ___________
**Success Rate:** ___________
**Target:** 100%
**Status:** [ ] Pass / [ ] Fail

---

## Database Health

### Scheduled Posts Status

```sql
-- Run this query to check post statuses
SELECT status, COUNT(*) as count FROM scheduled_posts GROUP BY status;
```

**Results:**
```
[Paste results here]
```

### Stuck Posts Check

```sql
-- Run this query to find stuck posts
SELECT * FROM scheduled_posts WHERE status = 'publishing' AND publishingStartedAt < NOW() - INTERVAL 2 MINUTE;
```

**Results:**
```
[Paste results here]
```

**Status:** [ ] No stuck posts / [ ] Stuck posts found (describe below)

---

## Final Verification Checklist

### Endpoint Verification

- [ ] Endpoint accessible from external networks
- [ ] Bearer token authentication working
- [ ] Response format is valid JSON
- [ ] No database connection errors
- [ ] Response time < 1 second

### Scheduling Accuracy

- [ ] All test posts published at exact scheduled time (±1 minute)
- [ ] Facebook timestamps match Brisbane timezone
- [ ] No posts missed or delayed
- [ ] No duplicate publishes
- [ ] Catch-up logic works (if server restarted)

### Logging & Monitoring

- [ ] Logs show complete publishing flow for each post
- [ ] Timezone conversions are correct (UTC ↔ Brisbane)
- [ ] Error messages are clear and actionable
- [ ] Health checks run every 5 minutes
- [ ] No critical errors in 24-48 hour period

### Production Readiness

- [ ] All 26 unit tests passing
- [ ] All test posts published successfully
- [ ] No issues found during monitoring
- [ ] Documentation is complete
- [ ] Team is confident in reliability

---

## Sign-Off

**Monitoring Started:** ___________
**Monitoring Completed:** ___________
**Total Duration:** ___________

**Verified By:** ___________
**Date:** ___________

**Overall Status:**
- [ ] PASS - Ready for production
- [ ] PASS WITH NOTES - Ready with caveats
- [ ] FAIL - Issues found, needs fixes

**Summary:**
```
[Final summary of monitoring results]
```

**Recommendations:**
```
[Any recommendations for improvements]
```

---

## Log Extraction Commands

Use these commands to extract relevant logs during monitoring:

**All cron triggers:**
```bash
grep "Authorized cron trigger" .manus-logs/devserver.log
```

**All successful publishes:**
```bash
grep "PUBLISH_SUCCESS" .manus-logs/devserver.log
```

**All failed publishes:**
```bash
grep "PUBLISH_FAILURE" .manus-logs/devserver.log
```

**All errors:**
```bash
grep -i "error\|failed\|❌" .manus-logs/devserver.log
```

**Scheduler health checks:**
```bash
grep "ResilientScheduler.*Health check" .manus-logs/devserver.log
```

**Timezone conversions:**
```bash
grep "scheduledLocal\|scheduledUTC" .manus-logs/devserver.log
```

**Specific post (replace 123456 with post ID):**
```bash
grep "123456" .manus-logs/devserver.log
```

**Last 100 lines:**
```bash
tail -100 .manus-logs/devserver.log
```

**Real-time monitoring:**
```bash
tail -f .manus-logs/devserver.log | grep -E "ResilientScheduler|ScheduledPublish|PUBLISH"
```

# External Cron Setup Guide

## Overview

The Content Creator Hub uses a **hybrid scheduler architecture** to ensure reliable post publishing:

1. **Internal Resilient Scheduler** (Fallback)
   - Runs every 60 seconds on the server
   - Automatically recovers from connection errors
   - Provides baseline reliability

2. **External Cron Trigger** (Primary)
   - Calls the authenticated endpoint every 5 minutes
   - Guaranteed execution by external service
   - Works even when the server is idle/hibernated

This dual approach ensures posts publish at exact scheduled times, regardless of server state.

---

## Architecture

```
External Cron Service (every 5 minutes)
    ↓
POST /api/scheduled/publish-due-posts
    ↓
Bearer Token Authentication (CRON_SECRET_TOKEN)
    ↓
Check database for due posts
    ↓
Publish to Facebook/Instagram/TikTok
    ↓
Log with timezone-aware timestamps
```

---

## Endpoint Details

**URL:** `https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts`

**Method:** `POST`

**Authentication:** Bearer token in `Authorization` header

**Request Headers:**
```
Authorization: Bearer <CRON_SECRET_TOKEN>
Content-Type: application/json
```

**Request Body:** Empty JSON object
```json
{}
```

**Response (Success):**
```json
{
  "success": true,
  "postsPublished": 0,
  "durationMs": 145,
  "timestamp": "2026-04-28T09:54:42.906Z",
  "source": "external-cron"
}
```

**Response (Post Published):**
```json
{
  "success": true,
  "postsPublished": 1,
  "postId": 123,
  "platformPostId": "facebook_post_id",
  "durationMs": 3200,
  "timestamp": "2026-04-28T10:00:00.000Z",
  "source": "external-cron"
}
```

**Response (Unauthorized):**
```json
{
  "error": "Unauthorized: Invalid or missing Bearer token"
}
```

---

## Setting Up External Cron

### Option 1: cron-job.org (Recommended for Beginners)

1. **Visit:** https://cron-job.org/en/

2. **Create Account** (if needed)

3. **Create New Cronjob:**
   - Click "Create Cronjob"
   - Set **Title:** `ContentHub Post Publisher`
   - Set **URL:** `https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts`
   - Set **Execution time:** Every 5 minutes

4. **Add Headers:**
   - Click "Advanced" or "HTTP Headers"
   - Add header:
     ```
     Authorization: Bearer YOUR_CRON_SECRET_TOKEN
     ```
   - Add header:
     ```
     Content-Type: application/json
     ```

5. **Set Request Method:** `POST`

6. **Set Request Body:** `{}`

7. **Save & Enable**

8. **Verify:** Check the logs in cron-job.org to confirm successful calls

---

### Option 2: EasyCron (Alternative)

1. **Visit:** https://www.easycron.com/

2. **Sign Up** (if needed)

3. **Create New Cron Job:**
   - Click "Add a new cron job"
   - Set **Cron Expression:** `*/5 * * * *` (every 5 minutes)
   - Set **URL:** `https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts`

4. **Add Custom Headers:**
   - In the "HTTP Headers" section, add:
     ```
     Authorization: Bearer YOUR_CRON_SECRET_TOKEN
     Content-Type: application/json
     ```

5. **Set Request Method:** `POST`

6. **Set Request Body:** `{}`

7. **Save**

8. **Verify:** Check the execution history

---

### Option 3: AWS EventBridge (For AWS Users)

1. **Create Rule:**
   ```bash
   aws events put-rule \
     --name contenthub-post-publisher \
     --schedule-expression 'rate(5 minutes)'
   ```

2. **Create Target:**
   ```bash
   aws events put-targets \
     --rule contenthub-post-publisher \
     --targets "Id"="1","Arn"="arn:aws:lambda:REGION:ACCOUNT:function:invoke-http","RoleArn"="arn:aws:iam::ACCOUNT:role/service-role/EventBridgeRole"
   ```

3. **Create Lambda Function** to make HTTP request:
   ```javascript
   exports.handler = async (event) => {
     const https = require('https');
     
     return new Promise((resolve, reject) => {
       const options = {
         hostname: 'contenthub-zayg9ao8.manus.space',
         path: '/api/scheduled/publish-due-posts',
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${process.env.CRON_SECRET_TOKEN}`,
           'Content-Type': 'application/json'
         }
       };
       
       const req = https.request(options, (res) => {
         let data = '';
         res.on('data', (chunk) => { data += chunk; });
         res.on('end', () => resolve(JSON.parse(data)));
       });
       
       req.on('error', reject);
       req.write('{}');
       req.end();
     });
   };
   ```

---

### Option 4: Google Cloud Scheduler

1. **Create Cloud Scheduler Job:**
   ```bash
   gcloud scheduler jobs create http contenthub-post-publisher \
     --schedule="*/5 * * * *" \
     --uri="https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts" \
     --http-method=POST \
     --headers="Authorization=Bearer YOUR_CRON_SECRET_TOKEN,Content-Type=application/json" \
     --message-body="{}"
   ```

2. **Verify:**
   ```bash
   gcloud scheduler jobs describe contenthub-post-publisher
   ```

---

## Monitoring & Verification

### Check Server Logs

Monitor the server logs for successful cron triggers:

```bash
# Look for "Authorized cron trigger" entries
grep "Authorized cron trigger" .manus-logs/devserver.log

# Look for successful publishes
grep "PUBLISH_SUCCESS" .manus-logs/devserver.log

# Look for any errors
grep "ScheduledPublish" .manus-logs/devserver.log | grep "❌"
```

### Expected Log Entries

**Successful trigger (no posts ready):**
```
[ScheduledPublish] ✓ Authorized cron trigger
[ScheduledPublish] 🔄 Cycle started at 2026-04-28T10:00:00.000Z
[ScheduledPublish] Found 5 scheduled posts
[ScheduledPublish] ✓ No posts ready to publish
```

**Successful publish:**
```
[ScheduledPublish] ✓ Authorized cron trigger
[ScheduledPublish] 🔄 Cycle started at 2026-04-28T10:00:00.000Z
[ScheduledPublish] Found 5 scheduled posts
[ScheduledPublish] Publishing post 123 (attempt 1)
[ScheduledPublish] ✅ Published post 123
[ScheduledPublish] PUBLISH_SUCCESS: Post published at 10:00 AM Brisbane time
```

### Test the Endpoint Manually

Use curl to test the endpoint:

```bash
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
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

---

## Timezone Handling

The scheduler uses **Australia/Brisbane** as the default timezone for all posts.

### How it works:

1. **User schedules post** at 8:00 AM Brisbane time
2. **Frontend converts** to UTC: 10:00 PM previous day
3. **Backend stores** as Unix milliseconds (UTC)
4. **Cron trigger checks** every 5 minutes in UTC
5. **Post publishes** at exact scheduled time (±5 minutes)
6. **Logs show** both UTC and Brisbane times

### Example:

- **User selects:** 8:00 AM Brisbane (2026-04-28)
- **Stored as UTC:** 2026-04-27 22:00:00 (previous day)
- **Cron checks:** Every 5 minutes starting from server startup
- **Publishes at:** Exactly 8:00 AM Brisbane (10:00 PM UTC previous day)
- **Log shows:** `scheduledLocal: '2026-04-28T08:00:00.000+10:00'`

---

## Troubleshooting

### Posts Not Publishing

**Check 1: Verify Cron is Running**
```bash
# Look for recent "Authorized cron trigger" entries
grep "Authorized cron trigger" .manus-logs/devserver.log | tail -5
```

**Check 2: Verify Token is Correct**
```bash
# Test with curl
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Check 3: Verify Post is Scheduled**
- Go to the calendar view
- Check if post shows "Scheduled" status
- Verify scheduled time is in the future

**Check 4: Check Logs for Errors**
```bash
# Look for publish failures
grep "PUBLISH_FAILURE\|❌" .manus-logs/devserver.log | tail -10
```

### Cron Service Not Calling Endpoint

**Check 1: Verify URL is Correct**
- Should be: `https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts`
- Not: `http://` (must be HTTPS)

**Check 2: Verify Headers are Set**
- Authorization header must be: `Bearer YOUR_CRON_SECRET_TOKEN`
- Content-Type must be: `application/json`

**Check 3: Verify Request Method is POST**
- Some cron services default to GET
- Must be explicitly set to POST

**Check 4: Check Cron Service Logs**
- cron-job.org: Check "Logs" tab
- EasyCron: Check "Execution History"
- AWS: Check CloudWatch logs
- Google Cloud: Check Cloud Logging

### Timezone Issues

**Check 1: Verify Timezone in UI**
- Calendar should show: "Scheduled in Australia/Brisbane time"
- Posts should show scheduled time in Brisbane timezone

**Check 2: Verify Database Stores UTC**
```bash
# Check a scheduled post in database
# scheduledAt should be Unix milliseconds (UTC)
# timezoneId should be 'Australia/Brisbane'
```

**Check 3: Check Logs for Timezone Conversion**
```bash
grep "scheduledLocal\|scheduledUTC" .manus-logs/devserver.log | head -5
```

---

## Security Best Practices

1. **Use HTTPS Only**
   - Always use `https://` in the URL
   - Never use `http://`

2. **Keep Token Secret**
   - Don't commit token to version control
   - Don't share token in public repositories
   - Regenerate token if compromised

3. **Rotate Token Regularly**
   - Change token every 3-6 months
   - Update all cron services when token changes

4. **Monitor for Unauthorized Access**
   ```bash
   # Check for failed authentication attempts
   grep "Unauthorized" .manus-logs/devserver.log
   ```

5. **Use Strong Token**
   - Token should be at least 32 characters
   - Use random alphanumeric characters
   - Example: `openssl rand -hex 32`

---

## Next Steps

1. **Choose a cron service** (cron-job.org recommended for beginners)
2. **Set up the cronjob** following the instructions above
3. **Verify the endpoint** is being called using curl
4. **Monitor the logs** for successful publishes
5. **Schedule test posts** for the next few hours to verify
6. **Check Facebook/Instagram** to confirm posts appear at scheduled times

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs in `.manus-logs/devserver.log`
3. Verify the endpoint manually with curl
4. Check the cron service logs for errors
5. Ensure the CRON_SECRET_TOKEN environment variable is set correctly

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Content Creator Hub                       │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Hybrid Scheduler Architecture                  │ │
│  │                                                        │ │
│  │  ┌──────────────────┐      ┌──────────────────────┐  │ │
│  │  │ External Cron    │      │ Internal Resilient   │  │ │
│  │  │ (Primary)        │      │ Scheduler (Fallback) │  │ │
│  │  │                  │      │                      │  │ │
│  │  │ Every 5 minutes  │      │ Every 60 seconds     │  │ │
│  │  │ Guaranteed       │      │ Auto-recovery        │  │ │
│  │  │ execution        │      │ Connection retry     │  │ │
│  │  └────────┬─────────┘      └──────────┬───────────┘  │ │
│  │           │                           │               │ │
│  │           └───────────┬───────────────┘               │ │
│  │                       ↓                               │ │
│  │    ┌──────────────────────────────────┐              │ │
│  │    │ /api/scheduled/publish-due-posts │              │ │
│  │    │ (Bearer token authenticated)     │              │ │
│  │    └──────────────┬───────────────────┘              │ │
│  │                   ↓                                   │ │
│  │    ┌──────────────────────────────────┐              │ │
│  │    │ Check database for due posts     │              │ │
│  │    │ (UTC timestamps, Brisbane TZ)    │              │ │
│  │    └──────────────┬───────────────────┘              │ │
│  │                   ↓                                   │ │
│  │    ┌──────────────────────────────────┐              │ │
│  │    │ Publish to Facebook/Instagram    │              │ │
│  │    │ /TikTok with full captions       │              │ │
│  │    └──────────────┬───────────────────┘              │ │
│  │                   ↓                                   │ │
│  │    ┌──────────────────────────────────┐              │ │
│  │    │ Log with timezone-aware times    │              │ │
│  │    │ (UTC + Brisbane local time)      │              │ │
│  │    └──────────────────────────────────┘              │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Version Information

- **Scheduler Version:** 2.0 (Hybrid Architecture)
- **Last Updated:** 2026-04-28
- **Timezone:** Australia/Brisbane (AEST/AEDT)
- **Default Cron Interval:** 5 minutes
- **Fallback Interval:** 60 seconds
- **Max Publish Lateness:** 5 minutes (external) + 60 seconds (internal)

# cron-job.org Setup - Verified Configuration

**Status:** ⚠️ CRITICAL - Current setup is NOT working. Only 1 trigger in entire log history.

---

## Exact Configuration Required

### Endpoint Details

| Setting | Value |
|---------|-------|
| **URL** | `https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts?token=tw_scheduler_9Xk28_secure_2026` |
| **HTTP Method** | `POST` |
| **Schedule** | Every 5 minutes (`*/5 * * * *`) |
| **Timeout** | 30 seconds |

### Headers (ADVANCED Tab)

| Header Name | Header Value |
|-------------|--------------|
| `Content-Type` | `application/json` |

**Note:** Authorization header is NOT needed because token is in query parameter.

### Request Body (ADVANCED Tab)

```json
{}
```

(Empty JSON object)

### Timezone

Set to: `Australia/Brisbane`

---

## Step-by-Step Setup

### 1. Log in to cron-job.org
- Go to https://cron-job.org/en/
- Log in with your account

### 2. Create New Cronjob
- Click "Create Cronjob"
- **COMMON Tab:**
  - Title: `ContentHub Post Publisher`
  - URL: `https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts?token=tw_scheduler_9Xk28_secure_2026`
  - Enable job: **ON** (toggle must be enabled)
  - Save responses: **ON** (so we can see logs)

### 3. Execution Schedule
- Select: **Every 5 minutes**

### 4. ADVANCED Tab
- **Timezone:** `Australia/Brisbane`
- **Request method:** `POST`
- **Headers:**
  - Key: `Content-Type`
  - Value: `application/json`
- **Request body:** `{}`
- **Timeout:** 30 seconds

### 5. Notifications (Optional)
- Enable: "execution of the cronjob fails"
- Notify after: 1 failure

### 6. Save
- Click **SAVE** button

---

## Verification Steps

### Test 1: Manual Test Run
1. Click on your cronjob
2. Click **TEST RUN** button
3. Expected response: HTTP 200 with JSON:
   ```json
   {
     "success": true,
     "postsPublished": 0,
     "durationMs": 123,
     "timestamp": "2026-04-28T01:45:00.000Z",
     "source": "external-cron"
   }
   ```

### Test 2: Check Logs
1. In cron-job.org, view execution history
2. Should show successful executions every 5 minutes
3. Status should be "Success" (green checkmark)

### Test 3: Server Logs
1. Check ContentHub server logs for: `✓ Authorized cron trigger`
2. Should appear every 5 minutes
3. Should show `source: 'external-cron'` in responses

---

## Expected Success Indicators

✅ **When working correctly, you should see:**

1. **cron-job.org UI:**
   - Green checkmarks on execution history
   - No error messages
   - Executions every 5 minutes

2. **Server logs:**
   ```
   [ScheduledPublish] ✓ Authorized cron trigger
   [ScheduledPublish] 🔄 Cycle started at 2026-04-28T01:45:00.000Z
   [ScheduledPublish] Found X scheduled posts
   [ScheduledPublish] ✓ No posts ready to publish
   ```

3. **Posts publishing:**
   - Posts publish at exact scheduled time
   - No need to open app
   - Status changes from "scheduled" → "published" automatically

---

## Troubleshooting

### Issue: 403 Forbidden

**Cause:** Token is incorrect or URL is malformed

**Fix:**
1. Copy the exact URL from this guide
2. Verify token: `tw_scheduler_9Xk28_secure_2026`
3. Ensure `?token=` is in the URL

### Issue: 401 Unauthorized

**Cause:** Token doesn't match

**Fix:**
1. Get current token from server logs
2. Update URL with correct token

### Issue: Timeout (30+ seconds)

**Cause:** Server is slow or unreachable

**Fix:**
1. Test endpoint manually: `curl -X POST "https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts?token=tw_scheduler_9Xk28_secure_2026" -H "Content-Type: application/json" -d "{}"`
2. Increase timeout to 60 seconds
3. Check if domain is accessible

### Issue: No executions showing

**Cause:** Cronjob is disabled or not saved

**Fix:**
1. Click on cronjob
2. Verify "Enable job" toggle is ON
3. Click SAVE
4. Wait 5 minutes for next execution

---

## Manual Testing (Without cron-job.org)

```bash
# Test the endpoint directly
curl -X POST "https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts?token=tw_scheduler_9Xk28_secure_2026" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -v

# Expected response:
# HTTP/1.1 200 OK
# {
#   "success": true,
#   "postsPublished": 0,
#   "durationMs": 123,
#   "timestamp": "2026-04-28T01:45:00.000Z",
#   "source": "external-cron"
# }
```

---

## Token Information

**Current CRON_SECRET_TOKEN:** `tw_scheduler_9Xk28_secure_2026`

This token is set in the environment and verified on every request.

---

## What Happens When Cron Calls Endpoint

1. **Every 5 minutes**, cron-job.org makes POST request to endpoint
2. **Endpoint checks:** Are there any posts with `scheduledAt <= now`?
3. **If yes:** Publishes the post to Facebook
4. **Updates database:** Changes status from "scheduled" → "published"
5. **Returns JSON:** Success response with post details
6. **Logs:** All activity logged with timestamps

---

## Success Criteria

✅ **Facebook scheduling is production-ready when:**

1. cron-job.org shows successful executions every 5 minutes
2. Server logs show `✓ Authorized cron trigger` every 5 minutes
3. Posts publish at exact scheduled time WITHOUT opening the app
4. No "Publishing" stuck status
5. Post appears on Facebook immediately after scheduled time
6. Works 24/7 even when app is closed

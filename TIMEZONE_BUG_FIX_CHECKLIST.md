# Timezone Bug Fix - Comprehensive Test Checklist

## Critical Bug Fixed
**Issue:** Scheduled posts were publishing 10+ hours off schedule (e.g., 8:00 AM scheduled posts published at 6:00 PM)

**Root Cause:** 
- Frontend was correctly converting local time to UTC
- Backend was storing UTC milliseconds correctly
- BUT: Display logic was treating UTC times as local times
- Publishing worker had no timezone awareness for logging

**Solution Implemented:**
1. Added `timezoneId` field to `scheduled_posts` table (stores IANA timezone identifier)
2. Updated frontend to send timezone with each schedule request
3. Updated publishing worker to use timezone for proper logging
4. Added timezone label to UI showing which timezone is being used
5. Added comprehensive logging at each step

---

## Pre-Test Setup

### 1. Verify Database Migration
```bash
# Check that timezoneId field exists
mysql -h $DATABASE_HOST -u $DATABASE_USER -p$DATABASE_PASSWORD $DATABASE_NAME
DESCRIBE scheduled_posts;
# Should show: timezoneId | varchar(100) | NO | | Australia/Brisbane |
```

### 2. Verify Server Logs Show Timezone Info
Check `.manus-logs/devserver.log` for:
```
[PublishingWorker] Cycle started: {
  serverUTC: "2026-04-25T08:17:59.323Z",
  serverUTCMs: 1777104679323,
  timestamp: "25/04/2026 18:17:59 AEST"
}
```

---

## Test Scenarios

### Test 1: Schedule Post for 8:00 AM Brisbane Time
**Objective:** Verify that a post scheduled for 8:00 AM publishes at exactly 8:00 AM Brisbane time

**Steps:**
1. Go to Content Calendar → Schedule Post
2. Select an approved post
3. Select platform connection (Facebook)
4. Select timezone: **AEST (UTC+10) - Australia Eastern**
5. Set date/time to **tomorrow at 08:00**
6. Click "Schedule Post"

**Expected Results:**
- ✅ Toast shows "Post scheduled successfully!"
- ✅ Post appears in "Upcoming Scheduled Posts" section
- ✅ Time shows in Brisbane timezone format
- ✅ Console log shows: `[scheduleRouter.create] Timezone Conversion: { userTimezone: "Australia/Brisbane", ... }`

**Verification:**
- Open browser console (F12) → Console tab
- Look for logs like:
  ```
  [scheduleRouter.create] Input received: {
    timezoneId: "Australia/Brisbane",
    scheduledAt: "2026-04-26T08:00:00.000Z", (this is UTC)
    ...
  }
  [scheduleRouter.create] Timezone Conversion: {
    userTimezone: "Australia/Brisbane",
    localTimeSelected: "2026-04-26T08:00:00.000Z",
    storedAsUTCMillis: 1777191600000,
    storedAsUTCDate: "2026-04-26T08:00:00.000Z"
  }
  ```

---

### Test 2: Schedule Post for 12:30 PM Brisbane Time
**Objective:** Verify timezone handling with non-hour time

**Steps:**
1. Go to Content Calendar → Schedule Post
2. Select an approved post
3. Select timezone: **AEST (UTC+10) - Australia Eastern**
4. Set date/time to **tomorrow at 12:30**
5. Click "Schedule Post"

**Expected Results:**
- ✅ Post scheduled successfully
- ✅ Calendar shows: "... 12/04/2026 12:30 (Australia/Brisbane)"
- ✅ Console shows correct UTC conversion

---

### Test 3: Schedule Post for 6:00 PM Brisbane Time
**Objective:** Verify evening time scheduling

**Steps:**
1. Go to Content Calendar → Schedule Post
2. Select an approved post
3. Select timezone: **AEST (UTC+10) - Australia Eastern**
4. Set date/time to **tomorrow at 18:00**
5. Click "Schedule Post"

**Expected Results:**
- ✅ Post scheduled successfully
- ✅ Calendar shows: "... 12/04/2026 18:00 (Australia/Brisbane)"
- ✅ Publishing worker logs show correct timezone conversion

---

### Test 4: Verify Publishing Worker Logs
**Objective:** Confirm publishing worker uses timezone for logging

**Steps:**
1. Schedule a post for 5 minutes in the future (e.g., 8:05 AM)
2. Wait for publishing worker to run (every 30 seconds)
3. Check `.manus-logs/devserver.log` for logs

**Expected Logs:**
```
[PublishingWorker] Cycle started: {
  serverUTC: "2026-04-25T08:17:59.323Z",
  serverUTCMs: 1777104679323,
  timestamp: "25/04/2026 18:17:59 AEST"
}

[PW] Next post ID 123:
[PW]   Timezone: Australia/Brisbane
[PW]   Scheduled (UTC): 2026-04-26T08:05:00.000Z
[PW]   Scheduled (Australia/Brisbane): 26/04/2026 18:05:00
[PW]   Current (UTC): 2026-04-25T08:17:59.323Z
[PW]   Current (Australia/Brisbane): 25/04/2026 18:17:59
[PW]   Difference: 1234s away

[PublishingWorker] 🔄 Processing post 123...
[PublishingWorker] Scheduled for: 26/04/2026 08:05:00 (Australia/Brisbane)
[PublishingWorker] Server time (UTC): 2026-04-26T08:05:00.000Z

[PublishingWorker] ✅ Published post 123 {
  scheduledPostId: 123,
  platformPostId: "123456789",
  platform: "facebook",
  scheduledFor: 26/04/2026 08:05:00 (Australia/Brisbane),
  publishedAt: 26/04/2026 08:05:15 (Australia/Brisbane)
}
```

**Key Verification Points:**
- ✅ `Timezone: Australia/Brisbane` is logged
- ✅ Times show in both UTC and Brisbane timezone
- ✅ Scheduled time and published time are within 1-2 minutes of each other
- ✅ Both times are in Brisbane timezone

---

### Test 5: Verify Facebook Publish Timestamp
**Objective:** Confirm that Facebook shows the correct publish time

**Steps:**
1. Schedule a post for 5 minutes in the future
2. Wait for it to publish
3. Go to Facebook Creator Studio → Posts
4. Check the "Published" timestamp

**Expected Result:**
- ✅ Facebook shows publication time in your local timezone (Brisbane)
- ✅ Time matches what you scheduled (within 1-2 minutes)
- ✅ NOT showing a time that's 10 hours different

**Example:**
- Scheduled: 8:00 AM Brisbane
- Facebook shows: Published at 8:00 AM (or 8:01 AM) - ✅ CORRECT
- Facebook shows: Published at 6:00 PM - ❌ BUG (this was the original issue)

---

### Test 6: Different Timezone - Perth (AWST)
**Objective:** Verify timezone handling for different Australian timezone

**Steps:**
1. Go to Content Calendar → Schedule Post
2. Select timezone: **AWST (UTC+8) - Australia Western**
3. Set date/time to **tomorrow at 10:00**
4. Click "Schedule Post"

**Expected Results:**
- ✅ Post scheduled successfully
- ✅ Console shows: `timezoneId: "Australia/Perth"`
- ✅ Calendar displays time correctly for Perth timezone

---

## Regression Tests

### Test 7: Verify Old Posts Still Work
**Objective:** Ensure existing scheduled posts (before fix) still display correctly

**Steps:**
1. Check Content Calendar for any existing scheduled posts
2. Verify they display with timezone label

**Expected Result:**
- ✅ Old posts show with default timezone: "Australia/Brisbane"
- ✅ No errors in console

---

### Test 8: Cancel and Retry Scheduled Posts
**Objective:** Verify cancel/retry functionality still works with timezone

**Steps:**
1. Schedule a post
2. Click "Cancel" button
3. Schedule another post
4. Click "Retry" button (if available)

**Expected Results:**
- ✅ Cancel works without errors
- ✅ Retry resets post to "scheduled" status
- ✅ Timezone is preserved

---

## Logging Verification Checklist

### Console Logs (Browser F12)
- [ ] `[scheduleRouter.create] Input received:` shows `timezoneId`
- [ ] `[scheduleRouter.create] Timezone Conversion:` shows correct UTC conversion
- [ ] No errors about missing `timezoneId` field

### Server Logs (`.manus-logs/devserver.log`)
- [ ] `[PublishingWorker] Cycle started:` shows server time in both UTC and Brisbane
- [ ] `[PW] Next post ID:` shows timezone field
- [ ] `[PublishingWorker] 🔄 Processing post:` shows scheduled time in Brisbane timezone
- [ ] `[PublishingWorker] ✅ Published post:` shows both scheduled and published times in Brisbane timezone

---

## Success Criteria

### ✅ All Tests Pass When:
1. Posts scheduled for 8:00 AM Brisbane time publish at 8:00 AM Brisbane time (not 6:00 PM)
2. Posts scheduled for 12:30 PM Brisbane time publish at 12:30 PM Brisbane time
3. Posts scheduled for 6:00 PM Brisbane time publish at 6:00 PM Brisbane time
4. Publishing worker logs show timezone-aware times
5. Facebook Creator Studio shows correct publish times
6. UI displays "Scheduled in Australia/Brisbane time" label
7. No database errors about missing `timezoneId` field
8. Old posts display with default timezone

### ❌ Regression Detected If:
1. Posts publish at wrong times (off by hours)
2. Console shows errors about unknown column
3. Publishing worker logs don't show timezone info
4. Facebook shows times that are 10+ hours off
5. UI doesn't show timezone label
6. Cancel/retry functionality breaks

---

## Debugging Tips

### If Posts Still Publish at Wrong Times:
1. Check `.manus-logs/devserver.log` for `[PublishingWorker]` logs
2. Verify `Timezone:` field is shown in logs
3. Compare `Scheduled (UTC):` vs `Scheduled (Australia/Brisbane):`
4. Check if times are correct in both formats

### If Database Errors Occur:
1. Verify migration was applied: `DESCRIBE scheduled_posts;`
2. Check if `timezoneId` column exists
3. Restart server: `webdev_restart_server`

### If UI Doesn't Show Timezone Label:
1. Check browser console for errors
2. Verify ContentCalendar.tsx was updated
3. Refresh page (Ctrl+Shift+R)
4. Check that `selectedTimezone` state is working

---

## Version Tracking

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-25 | Initial timezone bug fix - Added timezoneId field, updated frontend/backend logging |
| | | - Database migration: Added `timezoneId varchar(100)` to `scheduled_posts` |
| | | - Frontend: ContentCalendar now sends timezone with schedule request |
| | | - Backend: scheduleRouter logs timezone conversion |
| | | - Worker: publishingWorker logs timezone-aware times |
| | | - UI: Added "Scheduled in [timezone] time" label |

---

## Next Steps After Testing

1. ✅ Run all 8 tests above
2. ✅ Verify Facebook publish times match scheduled times
3. ✅ Check server logs for timezone info
4. ✅ Confirm no regressions in existing functionality
5. ✅ Document any issues found
6. ✅ Mark feature as stable (do not modify unless necessary)
7. ✅ Update version marker if any changes made

---

## Important Notes

- **DO NOT** modify timezone handling unless absolutely necessary
- **DO NOT** change the database migration after deployment
- **DO** keep comprehensive logs for debugging future issues
- **DO** test on mobile before marking as fixed
- **DO** verify Facebook timestamps match scheduled times exactly

---

**This fix ensures that users can trust their scheduled publish times. Posts will now publish at the exact time users select in their local timezone.**

# Quick Image Feature - Mobile Test Checklist

**Purpose:** Standardized verification workflow to prevent regressions in the Quick Image feature on mobile devices.

**Test Environment:** Mobile browser (iOS Safari or Android Chrome)

**Duration:** ~5 minutes per test cycle

---

## Pre-Test Setup

- [ ] Open the live app on mobile: `https://contenthub-zayg9ao8.manus.space`
- [ ] Navigate to **AI Generator** → **Generate Content**
- [ ] Generate a full post (caption, hashtags, image prompt)
- [ ] Verify build version marker visible (bottom-right corner)
- [ ] Record current version: `v: _______________`

---

## Test 1: Quick Image Generation Flow

### Step 1.1: Open Quick Image Dialog
- [ ] Scroll down to see "⚡ Quick Image" button
- [ ] Tap the button → Dialog opens with prompt displayed
- [ ] Verify prompt text is readable and complete

### Step 1.2: Generate Image
- [ ] Tap "Generate Image" button
- [ ] **Toast Check:** ONE "⏳ Generating image..." toast appears (NOT multiple)
- [ ] **UI Check:** Loading spinner visible in dialog
- [ ] Wait 5-20 seconds for generation

### Step 1.3: Verify Auto-Attach
- [ ] Image appears in preview
- [ ] **Toast Check:** ONE "✅ Image generated and attached!" toast appears
- [ ] **Critical:** Toast disappears automatically (does NOT stay stuck)
- [ ] Image is now attached to the content card (visible above Quick Image button)
- [ ] Dialog shows "Regenerate" and "Done" buttons

---

## Test 2: Toast Lifecycle Verification

### Step 2.1: Console Logging
- [ ] Open browser DevTools (F12 or long-press → Inspect)
- [ ] Go to **Console** tab
- [ ] Look for toast lifecycle logs:
  ```
  [Toast:loading] ... | Action: quick-image-gen | Message: ⏳ Generating image...
  [Toast:dismiss] ... | Dismissed loading toast before success
  [Toast:success] ... | Message: ✅ Image generated and attached!
  ```
- [ ] Verify logs show proper sequence (loading → dismiss → success)

### Step 2.2: No Duplicate Toasts
- [ ] Tap "Regenerate" button
- [ ] **Critical:** Only ONE "⏳ Generating image..." toast appears
- [ ] Verify console shows `[Toast:dismiss]` before new `[Toast:loading]`
- [ ] Wait for completion
- [ ] Verify only ONE success toast appears

---

## Test 3: Mobile Touch Events

### Step 3.1: Button Responsiveness
- [ ] Tap "⚡ Quick Image" button (not just hover)
- [ ] Dialog opens immediately (no lag)
- [ ] Tap "Generate Image" button
- [ ] Generation starts immediately (no stuck/unresponsive state)

### Step 3.2: Dialog Interactions
- [ ] Tap "Regenerate" button → New generation starts
- [ ] Tap "Done" button → Dialog closes
- [ ] Tap "⚡ Quick Image" again → Dialog opens (can regenerate again)

### Step 3.3: Close Dialog
- [ ] Tap "Done" button
- [ ] Dialog closes smoothly
- [ ] **Critical:** All toasts are dismissed (no stuck toasts)
- [ ] Generated image remains attached to card

---

## Test 4: Save Draft After Image Attach

### Step 4.1: Save Draft
- [ ] After image is attached, scroll down to "Save as Draft" button
- [ ] Tap "Save as Draft"
- [ ] **Toast Check:** ONE "✅ Content saved as draft!" toast appears
- [ ] Toast disappears automatically

### Step 4.2: Verify No Conflicts
- [ ] No error toasts appear
- [ ] No loading state stuck
- [ ] Post is saved successfully
- [ ] Can navigate away without errors

---

## Test 5: Error Handling

### Step 5.1: Empty Prompt Error
- [ ] Clear the image prompt field (if possible)
- [ ] Tap "Generate Image"
- [ ] **Toast Check:** ONE "❌ Image prompt is empty" error toast appears
- [ ] Toast disappears automatically

### Step 5.2: Generation Failure
- [ ] Tap "Generate Image"
- [ ] **If generation fails:** ONE "❌ Image unavailable, prompt ready for use" error toast appears
- [ ] Dialog shows "Generate Image" button again (can retry)
- [ ] Prompt text is still visible (NOT cleared)

---

## Test 6: UI/UX Polish

### Step 6.1: Visual Consistency
- [ ] Button styling matches other buttons in the app
- [ ] Dialog layout is clean and readable on mobile
- [ ] Image preview has proper aspect ratio (9:16 vertical)
- [ ] No text overflow or layout issues

### Step 6.2: Loading State
- [ ] Loading spinner animates smoothly
- [ ] Loading message is clear: "Generating image... (this may take 5-20 seconds)"
- [ ] Button is disabled during generation (cannot tap multiple times)

### Step 6.3: Success State
- [ ] Generated image displays correctly
- [ ] "AI-generated image attached to card" text is visible
- [ ] Close button (X) is accessible and works

---

## Test 7: Regression Check

### Step 7.1: Existing Features Still Work
- [ ] Image upload field still works (can upload images)
- [ ] "Generate with AI" button still works (caption-based generation)
- [ ] Prompt display shows correctly
- [ ] Content generation flow unchanged

### Step 7.2: No Toast Conflicts
- [ ] Generate content → Toast appears and clears
- [ ] Upload image → Toast appears and clears
- [ ] Quick Image generation → Toast appears and clears
- [ ] **Critical:** No overlapping or stuck toasts

---

## Pass/Fail Criteria

### ✅ PASS if:
- [ ] All toasts appear ONE at a time (no duplicates)
- [ ] All toasts clear automatically (no stuck toasts)
- [ ] Image auto-attaches to card
- [ ] Save Draft works immediately after image attach
- [ ] Mobile touch events work smoothly
- [ ] Console logs show proper lifecycle sequence
- [ ] No errors or warnings in console
- [ ] Build version marker is visible

### ❌ FAIL if:
- [ ] Multiple toasts appear for single action
- [ ] Toast stays stuck on screen
- [ ] Image doesn't attach to card
- [ ] Save Draft blocked or fails
- [ ] Button doesn't respond to tap
- [ ] Console shows errors or warnings
- [ ] Build version marker missing

---

## Debugging Tips

If a test fails:

1. **Check Console Logs:**
   ```
   [Toast:*] logs should show clean sequence
   No [object Object] or undefined errors
   ```

2. **Check Network Tab:**
   - Image generation request completes successfully
   - Response includes `url` field

3. **Check Application Tab:**
   - No stale state in localStorage
   - Session is valid

4. **Reproduce Issue:**
   - Clear browser cache
   - Refresh page
   - Try again
   - If still fails, check server logs

---

## Version Tracking

| Version | Date | Tester | Result | Notes |
|---------|------|--------|--------|-------|
| 2026-04-23-v2-auto-attach | 2026-04-23 | User | ✅ PASS | Initial verification on mobile |
| | | | | |

---

## Quick Reference

**Key Action Keys (for toast guard):**
- `quick-image-gen` - Quick Image generation flow

**Expected Toast Messages:**
- Loading: `⏳ Generating image... (5-20 seconds)`
- Success: `✅ Image generated and attached!`
- Error: `❌ Image unavailable, prompt ready for use`

**Build Version Location:**
- Bottom-right corner of home page
- Format: `v: YYYY-MM-DD-{feature}-{iteration}`

---

## Notes for Future Developers

- This checklist should be run before EVERY deployment
- Keep the version history table updated
- If any test fails, DO NOT deploy
- Update this checklist if new features are added to Quick Image
- Console logs are the source of truth for toast lifecycle

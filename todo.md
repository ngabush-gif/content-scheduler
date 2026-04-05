# ContentCreator Hub - TODO

## Phase 1: Architecture & Design System
- [x] Initialize project scaffold
- [x] Create todo.md
- [x] Design system: color palette, typography, global CSS
- [x] Database schema: users, niches, content_posts, approvals, schedules, content_library, platforms

## Phase 2: Backend API
- [x] Niche definitions and tone configs (seeded data)
- [x] Content posts CRUD (create, read, update, delete)
- [x] AI content generation endpoint (captions, hashtags, scripts, ideas per niche/platform)
- [x] Approval workflow (submit for review, approve, reject, request changes)
- [x] Content scheduling (create schedule, list upcoming, mark published)
- [x] Content library (save to library, list, tag, reuse)
- [x] Team management (list members, update roles)
- [x] Analytics data (post counts, approval rates, platform breakdown, team activity)
- [x] Platform publishing simulation (Facebook, Instagram, TikTok)

## Phase 3: Core Frontend
- [x] Global design system (elegant dark/gold palette, typography, CSS variables)
- [x] Landing/login page with brand identity
- [x] DashboardLayout with sidebar navigation
- [x] Route structure in App.tsx

## Phase 4: Content Generator
- [x] AI Content Generator page with niche selector
- [x] Platform selector (Facebook, Instagram, TikTok)
- [x] Tone/style controls per niche
- [x] Generated content display (caption, hashtags, script, ideas)
- [x] Save to draft / submit for approval actions

## Phase 5: Approval, Library & Calendar
- [x] Approval queue page (admin view: pending, approve, reject)
- [x] My Content page (member view: track status)
- [x] Content library page (browse, filter, reuse templates)
- [x] Content calendar page (monthly view, scheduled posts)
- [x] Schedule post modal

## Phase 6: Team, Publishing & Analytics
- [x] Team management page (admin: manage members/roles)
- [x] Platform publishing page (connect platforms, publish approved posts)
- [x] Analytics dashboard (charts: posts by platform, approval rates, team activity)

## Phase 7: Polish & Delivery
- [x] Responsive design across all pages
- [x] Loading states, empty states, error handling
- [x] Vitest unit tests (12 tests, all passing)
- [x] Final checkpoint and delivery

## Platform Integration (Manual Credentials)
- [x] Update DB schema: platform_connections table with encrypted access_token, page_id, account_id per user
- [x] Backend: save/update/delete platform credentials per user
- [x] Backend: real Instagram Graph API publish (photo/caption via access token + account ID)
- [x] Backend: real Facebook Graph API publish (post to page via access token + page ID)
- [x] Backend: TikTok API publish with clear setup instructions
- [x] Frontend: Platform Connections page with per-platform credential forms
- [x] Frontend: Connection status indicators (connected/disconnected/error)
- [x] Frontend: Update Publishing page to use real connected accounts
- [x] Frontend: Per-platform publish result feedback (success/error per platform)
- [x] Persistent connection error state in Platform Connections page (badge + last-test message)
- [x] Instagram publish: clear error when no media URL is present (placeholder image used as fallback)
- [x] TikTok publish: clear error message when no video URL is attached to post
- [x] Platform Connections page shows last test result inline (not only toast)

## Scheduled Auto-Publishing
- [x] Add scheduledPublishTime column to posts table (already in schema)
- [x] Backend: scheduled publishing job that runs every 2 minutes to check for due posts
- [x] Backend: auto-publish due posts to all connected platforms
- [x] Backend: update post status to "published" and store publish timestamps
- [x] Backend: handle publish errors gracefully (error logging, status tracking)
- [x] Backend: Initialize scheduled job on server startup
- [x] Frontend: Calendar page shows scheduled publish time for each post
- [x] Frontend: Publishing page shows "Schedule for later" vs "Publish now" options
- [x] Frontend: Set publish time when publishing posts
- [x] Backend: schedule procedure persists scheduled posts to database
- [x] Frontend: Schedule button calls backend mutation and saves to database
- [x] Frontend: Show countdown timer for upcoming scheduled posts (times displayed in calendar and upcoming list)

## User Refinements
- [x] AI Generator: Limit hashtags to maximum 5 per post
- [x] AI Generator: Hashtags must match caption style and theme of the post

## Media Upload & AI Image Generation
- [x] Database: Add imageUrl column to posts table for storing uploaded/generated images
- [x] Backend: Image upload endpoint with S3 storage integration
- [x] Backend: AI image generation procedure based on caption and niche
- [x] Frontend: Image upload field in content creation flow
- [x] Frontend: "Generate Image" button that calls AI image generation
- [x] Frontend: Image preview in content editor
- [x] Frontend: Show generated image in approval queue
- [x] Publishing: Attach image URL to Instagram/Facebook posts
- [x] Publishing: TikTok requires video (clear error message, in-development)
- [x] Add tests for media fields in content create/update procedures (5 new tests, all passing)

## Simplified Platform Connection UX (Beginner-Friendly)
- [x] Update Platform Connections page with visual step-by-step guides (no developer setup needed)
- [x] Add direct links to Facebook/Instagram token generation
- [x] Add direct links to TikTok token generation
- [x] Add copy-paste helper buttons for tokens
- [x] Simplify error messages to be beginner-friendly
- [x] Add inline tutorial sections with clear instructions
- [x] Two-column layout: steps on left, connection form on right
- [x] Tabbed interface for easy platform switching

## Bulk Content Generation & Templates
- [x] Database: Add contentTemplates table with template name, niche, category, prompt, example content
- [x] Backend: Create/read/update/delete template procedures
- [x] Backend: Bulk generate procedure that creates N posts from a single prompt
- [x] Frontend: Content Templates management page (admin only) to create/edit/delete templates
- [x] Frontend: Template selection in bulk generation page
- [x] Frontend: "Generate Bulk" button that generates 1-20 posts at once
- [x] Frontend: Bulk generation with niche/platform/tone/count controls
- [x] All tests passing (17 tests total)

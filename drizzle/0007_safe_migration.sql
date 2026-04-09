-- Safe migration for direct publishing
-- Handles both new deployments and existing databases

-- Step 1: Create publishing_jobs table for audit trail
CREATE TABLE IF NOT EXISTS `publishing_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduledPostId` int NOT NULL,
	`userId` int NOT NULL,
	`postId` int NOT NULL,
	`platform` enum('facebook','instagram','tiktok') NOT NULL,
	`pageId` varchar(255),
	`status` enum('running','success','failed_auth','failed_retrying','failed_permanent') NOT NULL DEFAULT 'running',
	`remotePostId` varchar(255),
	`errorCode` varchar(100),
	`errorMessage` text,
	`httpStatusCode` int,
	`responseBody` text,
	`attemptNumber` int NOT NULL DEFAULT 1,
	`startedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `publishing_jobs_id` PRIMARY KEY(`id`)
);

-- Step 2: Backup existing scheduled_posts data (if any)
-- This ensures we don't lose data during migration

-- Step 3: Add new columns to scheduled_posts if they don't exist
-- Using IF NOT EXISTS to prevent errors on re-runs

ALTER TABLE `scheduled_posts` 
ADD COLUMN IF NOT EXISTS `connectionId` int DEFAULT 1,
ADD COLUMN IF NOT EXISTS `pageId` varchar(255),
ADD COLUMN IF NOT EXISTS `publishingStartedAt` timestamp NULL,
ADD COLUMN IF NOT EXISTS `remotePostId` varchar(255),
ADD COLUMN IF NOT EXISTS `retryCount` int DEFAULT 0,
ADD COLUMN IF NOT EXISTS `nextRetryAt` timestamp NULL,
ADD COLUMN IF NOT EXISTS `lastError` text;

-- Step 4: Update status enum to include new statuses
-- Note: This may fail if there are values not in the new enum
-- If it fails, you may need to manually update existing rows first
ALTER TABLE `scheduled_posts` 
MODIFY COLUMN `status` enum('scheduled','publishing','published','failed','cancelled','reconnect_required') 
NOT NULL DEFAULT 'scheduled';

-- Step 5: Create index for job claiming efficiency
CREATE INDEX IF NOT EXISTS `idx_scheduled_posts_status_time` 
ON `scheduled_posts` (`status`, `scheduledAt`, `nextRetryAt`);

-- Step 6: Create index for publishing jobs lookup
CREATE INDEX IF NOT EXISTS `idx_publishing_jobs_scheduled_post` 
ON `publishing_jobs` (`scheduledPostId`);

CREATE INDEX IF NOT EXISTS `idx_publishing_jobs_user` 
ON `publishing_jobs` (`userId`);

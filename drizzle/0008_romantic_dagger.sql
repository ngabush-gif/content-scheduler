DROP TABLE `media_uploads`;--> statement-breakpoint
ALTER TABLE `invite_codes` DROP INDEX `invite_codes_code_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `approval_history` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `content_posts` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `content_templates` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `invite_codes` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `platform_connections` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `publish_log` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `publishing_jobs` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `scheduled_posts` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `social_connections` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `users` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `approval_history` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `content_posts` MODIFY COLUMN `isLibraryItem` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `content_posts` MODIFY COLUMN `isLibraryItem` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `content_posts` MODIFY COLUMN `aiGeneratedImage` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `content_posts` MODIFY COLUMN `aiGeneratedImage` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `content_posts` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `content_templates` MODIFY COLUMN `isDefault` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `content_templates` MODIFY COLUMN `isDefault` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `content_templates` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `invite_codes` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `invite_codes` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_connections` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `platform_connections` MODIFY COLUMN `connectedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `publish_log` MODIFY COLUMN `publishedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `publishing_jobs` MODIFY COLUMN `startedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `publishing_jobs` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `scheduled_posts` MODIFY COLUMN `connectionId` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `scheduled_posts` MODIFY COLUMN `retryCount` int;--> statement-breakpoint
ALTER TABLE `scheduled_posts` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `social_connections` MODIFY COLUMN `isActive` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `social_connections` MODIFY COLUMN `connectedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `lastSignedIn` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `timezoneOffsetMinutes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `invite_codes_code_unique` ON `invite_codes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_publishing_jobs_scheduled_post` ON `publishing_jobs` (`scheduledPostId`);--> statement-breakpoint
CREATE INDEX `idx_publishing_jobs_user` ON `publishing_jobs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_posts_status_time` ON `scheduled_posts` (`status`,`scheduledAt`,`nextRetryAt`);--> statement-breakpoint
CREATE INDEX `users_openId_unique` ON `users` (`openId`);
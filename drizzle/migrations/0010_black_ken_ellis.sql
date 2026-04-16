ALTER TABLE `content_posts` MODIFY COLUMN `status` enum('draft','pending_review','approved','rejected','published','failed') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `content_posts` ADD `remotePostId` varchar(255);--> statement-breakpoint
ALTER TABLE `content_posts` ADD `lastError` text;
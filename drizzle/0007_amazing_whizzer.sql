CREATE TABLE `publishing_jobs` (
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
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `publishing_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `scheduled_posts` MODIFY COLUMN `status` enum('scheduled','publishing','published','failed','cancelled','reconnect_required') NOT NULL DEFAULT 'scheduled';--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `connectionId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `pageId` varchar(255);--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `publishingStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `remotePostId` varchar(255);--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `retryCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `nextRetryAt` timestamp;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `lastError` text;
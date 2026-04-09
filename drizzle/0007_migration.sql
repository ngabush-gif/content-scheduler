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

ALTER TABLE `scheduled_posts` MODIFY COLUMN `status` enum('scheduled','publishing','published','failed','cancelled','reconnect_required') NOT NULL DEFAULT 'scheduled';

ALTER TABLE `scheduled_posts` ADD COLUMN `connectionId` int NOT NULL;

ALTER TABLE `scheduled_posts` ADD COLUMN `pageId` varchar(255);

ALTER TABLE `scheduled_posts` ADD COLUMN `publishingStartedAt` timestamp;

ALTER TABLE `scheduled_posts` ADD COLUMN `remotePostId` varchar(255);

ALTER TABLE `scheduled_posts` ADD COLUMN `retryCount` int DEFAULT 0 NOT NULL;

ALTER TABLE `scheduled_posts` ADD COLUMN `nextRetryAt` timestamp;

ALTER TABLE `scheduled_posts` ADD COLUMN `lastError` text;

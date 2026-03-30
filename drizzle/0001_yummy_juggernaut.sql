CREATE TABLE `approval_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`reviewerId` int NOT NULL,
	`action` enum('submitted','approved','rejected','revision_requested','resubmitted') NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`niche` enum('time_freedom','parents','side_hustlers','online_business','cultural','over_50','scam_survivors') NOT NULL,
	`platform` enum('facebook','instagram','tiktok','all') NOT NULL,
	`contentType` enum('caption','script','hashtags','ideas','full_post') NOT NULL,
	`caption` text,
	`hashtags` text,
	`script` text,
	`ideas` text,
	`fullContent` text,
	`tone` varchar(100),
	`status` enum('draft','pending_review','approved','rejected','published') NOT NULL DEFAULT 'draft',
	`rejectionNote` text,
	`approvedById` int,
	`approvedAt` timestamp,
	`publishedAt` timestamp,
	`scheduledAt` timestamp,
	`isLibraryItem` boolean NOT NULL DEFAULT false,
	`tags` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`platform` enum('facebook','instagram','tiktok') NOT NULL,
	`accountName` varchar(255),
	`accountId` varchar(255),
	`accessToken` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publish_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`publishedById` int NOT NULL,
	`platform` enum('facebook','instagram','tiktok') NOT NULL,
	`status` enum('success','failed') NOT NULL,
	`platformPostId` varchar(255),
	`errorMessage` text,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `publish_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`scheduledById` int NOT NULL,
	`platform` enum('facebook','instagram','tiktok') NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`status` enum('pending','published','failed','cancelled') NOT NULL DEFAULT 'pending',
	`publishedAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;
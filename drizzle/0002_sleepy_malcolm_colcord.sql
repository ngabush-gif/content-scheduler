CREATE TABLE `media_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileUrl` text NOT NULL,
	`fileType` enum('image','video') NOT NULL,
	`fileName` varchar(255),
	`fileSize` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `content_posts` ADD `imageUrl` text;--> statement-breakpoint
ALTER TABLE `content_posts` ADD `aiGeneratedImage` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `content_posts` ADD `mediaType` enum('none','image','video') DEFAULT 'none' NOT NULL;
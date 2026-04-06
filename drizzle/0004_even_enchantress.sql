CREATE TABLE `social_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`platform` enum('facebook','instagram','tiktok') NOT NULL,
	`platformUserId` varchar(255) NOT NULL,
	`platformUsername` varchar(255),
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` timestamp,
	`scope` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastVerifiedAt` timestamp,
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `platform_connections` ADD `refreshToken` text;--> statement-breakpoint
ALTER TABLE `platform_connections` ADD `expiresAt` timestamp;
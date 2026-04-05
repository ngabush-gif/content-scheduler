CREATE TABLE `content_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdById` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`niche` enum('time_freedom','parents','side_hustlers','online_business','cultural','over_50','scam_survivors') NOT NULL,
	`category` varchar(100) NOT NULL,
	`prompt` text NOT NULL,
	`exampleContent` text,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_templates_id` PRIMARY KEY(`id`)
);

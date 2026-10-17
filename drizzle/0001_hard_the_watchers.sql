CREATE TABLE `activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prospectId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('note','call','email','meeting','stage_change') NOT NULL DEFAULT 'note',
	`title` varchar(180) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `followUps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prospectId` int NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`dueAt` timestamp NOT NULL,
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('open','completed') NOT NULL DEFAULT 'open',
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `followUps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `importBatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`totalRows` int NOT NULL DEFAULT 0,
	`importedRows` int NOT NULL DEFAULT 0,
	`duplicateRows` int NOT NULL DEFAULT 0,
	`errorRows` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `importBatches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prospects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`firstName` varchar(120),
	`lastName` varchar(120),
	`company` varchar(180),
	`email` varchar(320),
	`phone` varchar(80),
	`source` varchar(120),
	`stage` enum('new','qualified','proposal','negotiation','won','lost') NOT NULL DEFAULT 'new',
	`estimatedValueCents` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prospects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `activities` ADD CONSTRAINT `activities_prospectId_prospects_id_fk` FOREIGN KEY (`prospectId`) REFERENCES `prospects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activities` ADD CONSTRAINT `activities_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `followUps` ADD CONSTRAINT `followUps_prospectId_prospects_id_fk` FOREIGN KEY (`prospectId`) REFERENCES `prospects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `followUps` ADD CONSTRAINT `followUps_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `importBatches` ADD CONSTRAINT `importBatches_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prospects` ADD CONSTRAINT `prospects_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activities_prospect_created_idx` ON `activities` (`prospectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `followups_owner_due_idx` ON `followUps` (`ownerId`,`dueAt`,`status`);--> statement-breakpoint
CREATE INDEX `prospects_owner_updated_idx` ON `prospects` (`ownerId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `prospects_owner_stage_idx` ON `prospects` (`ownerId`,`stage`);
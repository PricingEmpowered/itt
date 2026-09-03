CREATE TABLE `pricing_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`family` varchar(32) NOT NULL,
	`shellSize` varchar(16),
	`contactType` varchar(16),
	`material` varchar(16),
	`basePrice` decimal(10,2) NOT NULL DEFAULT '0.00',
	`customUpchargePct` decimal(5,2) NOT NULL DEFAULT '25.00',
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(64),
	CONSTRAINT `pricing_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`description` varchar(255) NOT NULL,
	`globalPn` varchar(64),
	`regionalPn` varchar(64),
	`stripped` varchar(255),
	`series` varchar(64),
	`line` varchar(128),
	`family` varchar(32),
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quote_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionToken` varchar(128) NOT NULL,
	`partNumber` varchar(255) NOT NULL,
	`isCustom` boolean NOT NULL DEFAULT false,
	`family` varchar(32),
	`series` varchar(64),
	`line` varchar(128),
	`description` text,
	`attributes` json,
	`unitPrice` decimal(10,2),
	`quantity` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quote_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quote_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionToken` varchar(128) NOT NULL,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quote_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `quote_sessions_sessionToken_unique` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `rfq_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionToken` varchar(128),
	`contactName` varchar(128) NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`company` varchar(128),
	`phone` varchar(32),
	`notes` text,
	`items` json,
	`status` enum('pending','reviewing','quoted','closed') NOT NULL DEFAULT 'pending',
	`adminNotes` text,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rfq_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_pr_family` ON `pricing_rules` (`family`);--> statement-breakpoint
CREATE INDEX `idx_description` ON `products` (`description`);--> statement-breakpoint
CREATE INDEX `idx_global_pn` ON `products` (`globalPn`);--> statement-breakpoint
CREATE INDEX `idx_family` ON `products` (`family`);--> statement-breakpoint
CREATE INDEX `idx_series` ON `products` (`series`);--> statement-breakpoint
CREATE INDEX `idx_qi_session` ON `quote_items` (`sessionToken`);
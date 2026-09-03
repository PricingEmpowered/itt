CREATE TABLE `engine_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`ruleType` enum('min_margin','min_markup','family_tether','competitor_tie','max_discount_segment') NOT NULL,
	`scope` enum('global','family','channel','customerTier') NOT NULL DEFAULT 'global',
	`scopeValue` varchar(64),
	`paramValue` decimal(8,4) NOT NULL,
	`competitorName` varchar(64),
	`priority` int NOT NULL DEFAULT 100,
	`active` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(64),
	CONSTRAINT `engine_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_er_ruleType` ON `engine_rules` (`ruleType`);--> statement-breakpoint
CREATE INDEX `idx_er_scope` ON `engine_rules` (`scope`);--> statement-breakpoint
CREATE INDEX `idx_er_priority` ON `engine_rules` (`priority`);--> statement-breakpoint
CREATE INDEX `idx_er_active` ON `engine_rules` (`active`);
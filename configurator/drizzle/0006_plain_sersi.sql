CREATE TABLE `quote_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowToken` varchar(128) NOT NULL,
	`level` int NOT NULL,
	`role` varchar(64) NOT NULL,
	`title` varchar(128) NOT NULL,
	`status` enum('pending','approved','rejected','escalated','delegated','skipped') NOT NULL DEFAULT 'pending',
	`assignedTo` varchar(128),
	`actedBy` varchar(128),
	`actedAt` timestamp,
	`comments` text,
	`escalatedToLevel` int,
	`delegatedTo` varchar(128),
	`discountPct` float DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quote_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_qa_token` ON `quote_approvals` (`workflowToken`);--> statement-breakpoint
CREATE INDEX `idx_qa_level` ON `quote_approvals` (`level`);--> statement-breakpoint
CREATE INDEX `idx_qa_status` ON `quote_approvals` (`status`);
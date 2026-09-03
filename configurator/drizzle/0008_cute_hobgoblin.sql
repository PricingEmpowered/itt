CREATE TABLE `channel_compliance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteToken` varchar(128),
	`customerId` int,
	`customerName` varchar(128) NOT NULL,
	`channel` varchar(32) NOT NULL,
	`partNumber` varchar(128) NOT NULL,
	`productFamily` varchar(64),
	`quotedPrice` decimal(10,2) NOT NULL,
	`listPrice` decimal(10,2),
	`authorisedFloor` decimal(10,2),
	`authorisedCeiling` decimal(10,2),
	`discountPct` float,
	`compliant` boolean NOT NULL DEFAULT true,
	`violationType` enum('below_floor','above_ceiling','no_agreement','compliant') DEFAULT 'compliant',
	`quoteDate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `channel_compliance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_agreements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int,
	`customerName` varchar(128) NOT NULL,
	`customerTier` varchar(32),
	`channel` varchar(32),
	`productFamily` varchar(64),
	`partNumber` varchar(128),
	`description` text,
	`floorPrice` decimal(10,2),
	`targetPrice` decimal(10,2),
	`ceilingPrice` decimal(10,2),
	`maxDiscountPct` float,
	`effectiveDate` date NOT NULL,
	`expirationDate` date NOT NULL,
	`autoRenew` boolean DEFAULT false,
	`renewalNoticeDays` int DEFAULT 30,
	`status` enum('active','pending','expired','cancelled') NOT NULL DEFAULT 'pending',
	`approvedBy` varchar(128),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_agreements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_change_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('price_list_item','product','agreement','quote') NOT NULL,
	`entityId` int NOT NULL,
	`entityLabel` varchar(256),
	`field` varchar(64) NOT NULL,
	`oldValue` varchar(128),
	`newValue` varchar(128),
	`changePct` float,
	`changedBy` varchar(128) NOT NULL,
	`reason` text,
	`approvalToken` varchar(128),
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_change_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `quote_workflows` ADD `effectiveDate` date;--> statement-breakpoint
ALTER TABLE `quote_workflows` ADD `expirationDate` date;--> statement-breakpoint
ALTER TABLE `quote_workflows` ADD `validityDays` int DEFAULT 30;--> statement-breakpoint
CREATE INDEX `idx_cc_customer` ON `channel_compliance` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_cc_channel` ON `channel_compliance` (`channel`);--> statement-breakpoint
CREATE INDEX `idx_cc_compliant` ON `channel_compliance` (`compliant`);--> statement-breakpoint
CREATE INDEX `idx_cc_date` ON `channel_compliance` (`quoteDate`);--> statement-breakpoint
CREATE INDEX `idx_ca_customer` ON `customer_agreements` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_ca_family` ON `customer_agreements` (`productFamily`);--> statement-breakpoint
CREATE INDEX `idx_ca_expiry` ON `customer_agreements` (`expirationDate`);--> statement-breakpoint
CREATE INDEX `idx_ca_status` ON `customer_agreements` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pca_entity` ON `price_change_audit` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `idx_pca_changed_at` ON `price_change_audit` (`changedAt`);--> statement-breakpoint
CREATE INDEX `idx_qw_expiry` ON `quote_workflows` (`expirationDate`);
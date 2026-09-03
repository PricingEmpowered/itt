CREATE TABLE `quote_workflow_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowToken` varchar(128) NOT NULL,
	`itemType` enum('existing','configured','custom') NOT NULL DEFAULT 'existing',
	`partNumber` varchar(255),
	`description` text,
	`family` varchar(32),
	`series` varchar(64),
	`isStandardCatalog` boolean DEFAULT false,
	`configuredAttributes` json,
	`customDescription` text,
	`customBaseFamily` varchar(32),
	`customComplexity` enum('Low','Medium','High','Very High') DEFAULT 'Medium',
	`customMoq` int DEFAULT 1,
	`customLeadTimeDays` int DEFAULT 90,
	`listPrice` decimal(10,2),
	`targetPrice` decimal(10,2),
	`floorPrice` decimal(10,2),
	`quotedPrice` decimal(10,2),
	`quantity` int NOT NULL DEFAULT 1,
	`pricingRationale` text,
	`priceConfidence` enum('High','Medium','Low') DEFAULT 'Medium',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quote_workflow_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quote_workflows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowToken` varchar(128) NOT NULL,
	`customerId` int,
	`customerName` varchar(128) NOT NULL,
	`customerTier` enum('Enterprise','Large','Mid','SMB') DEFAULT 'Mid',
	`customerRegion` varchar(32),
	`customerChannel` enum('OEM','Distribution','Intercompany') DEFAULT 'OEM',
	`customerIndustry` varchar(64),
	`customerPriceIndex` float DEFAULT 1,
	`customerMarginIndex` float DEFAULT 0.68,
	`contactName` varchar(128),
	`contactEmail` varchar(320),
	`contactPhone` varchar(32),
	`dealType` enum('New Business','Repeat Business','Renewal','Expansion') DEFAULT 'New Business',
	`urgency` enum('Standard','Expedite','Emergency') DEFAULT 'Standard',
	`targetMarginPct` float DEFAULT 35,
	`notes` text,
	`status` enum('draft','submitted','quoted','won','lost') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quote_workflows_id` PRIMARY KEY(`id`),
	CONSTRAINT `quote_workflows_workflowToken_unique` UNIQUE(`workflowToken`)
);
--> statement-breakpoint
CREATE INDEX `idx_qwi_token` ON `quote_workflow_items` (`workflowToken`);--> statement-breakpoint
CREATE INDEX `idx_qw_token` ON `quote_workflows` (`workflowToken`);--> statement-breakpoint
CREATE INDEX `idx_qw_customer` ON `quote_workflows` (`customerId`);
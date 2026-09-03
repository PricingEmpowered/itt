CREATE TABLE `ai_model_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelName` varchar(64) NOT NULL,
	`modelType` enum('price_optimization','demand_forecasting','customer_analytics','anomaly_detection') NOT NULL,
	`accuracy` float NOT NULL DEFAULT 0,
	`totalPredictions` int NOT NULL DEFAULT 0,
	`status` enum('Active','Training','Inactive') NOT NULL DEFAULT 'Active',
	`lastRunAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_model_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competitor_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`marketSharePct` float NOT NULL DEFAULT 0,
	`avgPrice` decimal(10,2),
	`priceTrend` enum('up','stable','down') NOT NULL DEFAULT 'stable',
	`keyStrength` varchar(255),
	`keyWeakness` varchar(255),
	`wins` int NOT NULL DEFAULT 0,
	`losses` int NOT NULL DEFAULT 0,
	`winRate` float NOT NULL DEFAULT 0,
	`keyFactors` json,
	`segment` varchar(64) NOT NULL DEFAULT 'All',
	`period` varchar(32) NOT NULL DEFAULT 'Last 12 Months',
	`isUs` boolean NOT NULL DEFAULT false,
	CONSTRAINT `competitor_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`tier` enum('Enterprise','Large','Mid','SMB') NOT NULL DEFAULT 'Mid',
	`industry` varchar(64) NOT NULL,
	`location` varchar(128),
	`region` varchar(32) NOT NULL DEFAULT 'North America',
	`annualVolume` decimal(14,2) NOT NULL DEFAULT '0',
	`priceIndex` float NOT NULL DEFAULT 100,
	`marginIndex` float NOT NULL DEFAULT 100,
	`trend` enum('High','Good','Stable','Low','Declining') NOT NULL DEFAULT 'Stable',
	`channels` json,
	`contracts` json,
	`primaryProducts` json,
	`contactName` varchar(128),
	`contactEmail` varchar(320),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dynamic_pricing_scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productSku` varchar(64) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`currentPrice` decimal(10,2) NOT NULL,
	`strategy` enum('Market-Based','Value-Based','Cost-Plus','Demand-Based') NOT NULL,
	`suggestedPrice` decimal(10,2) NOT NULL,
	`priceLiftPct` float NOT NULL DEFAULT 0,
	`volumeImpactPct` float NOT NULL DEFAULT 0,
	`revenueImpact` decimal(14,2) NOT NULL DEFAULT '0',
	`confidence` float NOT NULL DEFAULT 0,
	`elasticity` float NOT NULL DEFAULT -0.5,
	`segment` varchar(64) NOT NULL DEFAULT 'All',
	`period` varchar(32) NOT NULL DEFAULT 'Current',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dynamic_pricing_scenarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `managed_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(64) NOT NULL,
	`family` varchar(64) NOT NULL,
	`isCustom` boolean NOT NULL DEFAULT false,
	`listPrice` decimal(10,2) NOT NULL,
	`unit` varchar(16) NOT NULL DEFAULT 'EA',
	`complexityMultiplier` float NOT NULL DEFAULT 1,
	`moq` int NOT NULL DEFAULT 1,
	`customizationCount` int NOT NULL DEFAULT 0,
	`status` enum('Active','Inactive','Discontinued') NOT NULL DEFAULT 'Active',
	`basedOnSku` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managed_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `managed_products_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `price_list_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`priceListId` int NOT NULL,
	`sku` varchar(64) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`currentPrice` decimal(10,2) NOT NULL,
	`marginPct` float NOT NULL DEFAULT 0,
	`customers` int NOT NULL DEFAULT 0,
	`winRate` float NOT NULL DEFAULT 0,
	`exceptionPct` float NOT NULL DEFAULT 0,
	`priceAttainment` float NOT NULL DEFAULT 0,
	`aiRecommendation` enum('Increase','Decrease','Hold') NOT NULL DEFAULT 'Hold',
	`aiConfidence` float NOT NULL DEFAULT 0,
	`aiSuggestedPrice` decimal(10,2),
	`status` enum('Pending Review','Approved','Rejected') NOT NULL DEFAULT 'Pending Review',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_list_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_lists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`segment` varchar(64) NOT NULL DEFAULT 'All',
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_lists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quote_mgmt` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteId` varchar(32) NOT NULL,
	`customerId` int,
	`customerName` varchar(128) NOT NULL,
	`contactName` varchar(128),
	`totalValue` decimal(14,2) NOT NULL DEFAULT '0',
	`status` enum('Draft','Pending Approval','Auto-Approved','Approved','Rejected','Expired','Converted') NOT NULL DEFAULT 'Draft',
	`items` json,
	`notes` text,
	`expiryDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quote_mgmt_id` PRIMARY KEY(`id`),
	CONSTRAINT `quote_mgmt_quoteId_unique` UNIQUE(`quoteId`)
);
--> statement-breakpoint
CREATE INDEX `idx_cust_tier` ON `customers` (`tier`);--> statement-breakpoint
CREATE INDEX `idx_cust_industry` ON `customers` (`industry`);--> statement-breakpoint
CREATE INDEX `idx_cust_region` ON `customers` (`region`);--> statement-breakpoint
CREATE INDEX `idx_dps_sku` ON `dynamic_pricing_scenarios` (`productSku`);--> statement-breakpoint
CREATE INDEX `idx_mp_family` ON `managed_products` (`family`);--> statement-breakpoint
CREATE INDEX `idx_mp_category` ON `managed_products` (`category`);--> statement-breakpoint
CREATE INDEX `idx_pli_list` ON `price_list_items` (`priceListId`);--> statement-breakpoint
CREATE INDEX `idx_pli_sku` ON `price_list_items` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_qm_status` ON `quote_mgmt` (`status`);--> statement-breakpoint
CREATE INDEX `idx_qm_customer` ON `quote_mgmt` (`customerName`);
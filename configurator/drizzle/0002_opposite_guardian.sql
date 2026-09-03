CREATE TABLE `analytics_margin_bridge` (
	`id` int AUTO_INCREMENT NOT NULL,
	`period` varchar(7) NOT NULL,
	`productFamily` varchar(64) NOT NULL DEFAULT 'All',
	`region` varchar(32) NOT NULL DEFAULT 'All',
	`channel` varchar(64) NOT NULL DEFAULT 'All',
	`component` varchar(64) NOT NULL,
	`value` decimal(14,2) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `analytics_margin_bridge_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_price_waterfall` (
	`id` int AUTO_INCREMENT NOT NULL,
	`period` varchar(7) NOT NULL,
	`productFamily` varchar(64) NOT NULL DEFAULT 'All',
	`region` varchar(32) NOT NULL DEFAULT 'All',
	`channel` varchar(64) NOT NULL DEFAULT 'All',
	`segment` varchar(64) NOT NULL DEFAULT 'All',
	`component` varchar(64) NOT NULL,
	`value` decimal(14,2) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isTotal` boolean NOT NULL DEFAULT false,
	CONSTRAINT `analytics_price_waterfall_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partNumber` varchar(64) NOT NULL,
	`productFamily` varchar(64) NOT NULL,
	`sales` decimal(14,2) NOT NULL DEFAULT '0',
	`marginAtListPct` float NOT NULL DEFAULT 0,
	`avgDiscountPct` float NOT NULL DEFAULT 0,
	`discountType` enum('list_price','standard_discount','custom_discount') NOT NULL DEFAULT 'list_price',
	`competitivePremiums` json,
	`paretoCategory` enum('A','B','C','D') NOT NULL DEFAULT 'D',
	`period` varchar(7) NOT NULL,
	CONSTRAINT `analytics_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_quote_funnel` (
	`id` int AUTO_INCREMENT NOT NULL,
	`period` varchar(7) NOT NULL,
	`region` varchar(32) NOT NULL DEFAULT 'All',
	`channel` varchar(64) NOT NULL DEFAULT 'All',
	`segment` varchar(64) NOT NULL DEFAULT 'All',
	`stage` enum('Technical Review','Negotiation','Won') NOT NULL,
	`newBusiness` int NOT NULL DEFAULT 0,
	`repeatBusiness` int NOT NULL DEFAULT 0,
	`newValue` decimal(14,2) NOT NULL DEFAULT '0',
	`repeatValue` decimal(14,2) NOT NULL DEFAULT '0',
	`avgCycleTimeDays` float NOT NULL DEFAULT 0,
	CONSTRAINT `analytics_quote_funnel_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`period` varchar(7) NOT NULL,
	`productFamily` varchar(64) NOT NULL DEFAULT 'All',
	`region` varchar(32) NOT NULL DEFAULT 'All',
	`channel` varchar(64) NOT NULL DEFAULT 'All',
	`revenue` decimal(14,2) NOT NULL DEFAULT '0',
	`activeQuotes` int NOT NULL DEFAULT 0,
	`winRate` float NOT NULL DEFAULT 0,
	`activeCustomers` int NOT NULL DEFAULT 0,
	`priceIndex` float NOT NULL DEFAULT 100,
	`costIndex` float NOT NULL DEFAULT 100,
	`valueGapPct` float NOT NULL DEFAULT 0,
	CONSTRAINT `analytics_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_mb_period` ON `analytics_margin_bridge` (`period`);--> statement-breakpoint
CREATE INDEX `idx_pw_period` ON `analytics_price_waterfall` (`period`);--> statement-breakpoint
CREATE INDEX `idx_ap_family` ON `analytics_products` (`productFamily`);--> statement-breakpoint
CREATE INDEX `idx_ap_period` ON `analytics_products` (`period`);--> statement-breakpoint
CREATE INDEX `idx_qf_period` ON `analytics_quote_funnel` (`period`);--> statement-breakpoint
CREATE INDEX `idx_snap_period` ON `analytics_snapshots` (`period`);--> statement-breakpoint
CREATE INDEX `idx_snap_family` ON `analytics_snapshots` (`productFamily`);
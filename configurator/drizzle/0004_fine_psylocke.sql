ALTER TABLE `customers` ADD `country` varchar(64);--> statement-breakpoint
ALTER TABLE `customers` ADD `state` varchar(8);--> statement-breakpoint
ALTER TABLE `customers` ADD `channel` enum('OEM','Distribution','Intercompany') DEFAULT 'OEM';--> statement-breakpoint
ALTER TABLE `customers` ADD `industryCode` varchar(16);--> statement-breakpoint
ALTER TABLE `customers` ADD `salesRep` varchar(128);--> statement-breakpoint
ALTER TABLE `customers` ADD `contractStatus` varchar(32) DEFAULT 'Active';--> statement-breakpoint
ALTER TABLE `customers` ADD `contractExpiry` varchar(16);--> statement-breakpoint
ALTER TABLE `customers` ADD `preferredFamily` varchar(64);
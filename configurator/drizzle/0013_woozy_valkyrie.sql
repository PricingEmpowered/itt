ALTER TABLE `bulk_quote_opportunity_items` MODIFY COLUMN `reviewStatus` enum('pending','approved_target','target_overridden','exception','rejected','invalid') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `bulk_quote_review_events` MODIFY COLUMN `action` enum('imported','priced','bulk_approved','tier_changed','target_overridden','exception_flagged','exception_resolved','rejected','submitted') NOT NULL;--> statement-breakpoint
ALTER TABLE `bulk_quote_opportunity_items` ADD `targetOverridePrice` decimal(12,4);--> statement-breakpoint
ALTER TABLE `bulk_quote_opportunity_items` ADD `targetOverrideReason` text;--> statement-breakpoint
ALTER TABLE `bulk_quote_opportunity_items` ADD `targetOverrideOwner` varchar(128);--> statement-breakpoint
ALTER TABLE `bulk_quote_opportunity_items` ADD `targetOverrideAt` timestamp;
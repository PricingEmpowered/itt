-- Move to local user accounts.
--
-- `openId` and `loginMethod` came from an external identity provider that is
-- no longer used, so accounts are keyed by email and carry their own
-- password hash.
--
-- Existing rows have no password and cannot be migrated to one: re-provision
-- accounts with `pnpm create-user`. The email unique index is added after the
-- old rows are cleared so duplicate or null emails cannot block it.

DELETE FROM `users`;
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `loginMethod`;
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255) NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);

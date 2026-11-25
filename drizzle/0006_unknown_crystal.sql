CREATE TABLE `canva_accounts` (
	`owner` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`secret` text NOT NULL,
	`expires` text NOT NULL,
	`refresh_claim` text,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `canva_settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated` text NOT NULL
);

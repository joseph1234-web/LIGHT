CREATE TABLE `provider_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`secret` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_app_owner` ON `provider_apps` (`owner`,`provider`);
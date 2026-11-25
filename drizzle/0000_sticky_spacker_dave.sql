CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`message` text NOT NULL,
	`kind` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`key` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`duration` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`hash` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`platform` text NOT NULL,
	`account_id` text NOT NULL,
	`label` text NOT NULL,
	`secret` text NOT NULL,
	`expires` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connection_owner_platform` ON `connections` (`owner`,`platform`);--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`draft_id` text NOT NULL,
	`platform` text NOT NULL,
	`status` text NOT NULL,
	`scheduled` text NOT NULL,
	`payload` text NOT NULL,
	`remote_id` text,
	`message` text DEFAULT '' NOT NULL,
	`claimed` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_delivery_per_draft_platform` ON `jobs` (`owner`,`draft_id`,`platform`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`created` text NOT NULL,
	`verifier` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `preferences` (
	`owner` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated` text NOT NULL
);

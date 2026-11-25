CREATE TABLE `church_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`series` text NOT NULL,
	`event_id` text DEFAULT '' NOT NULL,
	`local_date` text NOT NULL,
	`scheduled` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`image_key` text,
	`remote_id` text,
	`page_id` text,
	`message` text DEFAULT '' NOT NULL,
	`claimed` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `church_post_once` ON `church_posts` (`owner`,`series`,`event_id`,`local_date`);--> statement-breakpoint
CREATE TABLE `church_settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated` text NOT NULL
);

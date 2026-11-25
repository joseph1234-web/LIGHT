CREATE TABLE `church_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`png_key` text NOT NULL,
	`pixels_key` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL
);

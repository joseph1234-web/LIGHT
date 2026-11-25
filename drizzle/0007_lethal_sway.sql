CREATE TABLE `canva_page_rotations` (
	`owner` text NOT NULL,
	`series` text NOT NULL,
	`event_id` text DEFAULT '' NOT NULL,
	`source_url` text NOT NULL,
	`design_id` text NOT NULL,
	`page_count` integer NOT NULL,
	`next_page` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canva_page_rotation_key` ON `canva_page_rotations` (`owner`,`series`,`event_id`,`source_url`);
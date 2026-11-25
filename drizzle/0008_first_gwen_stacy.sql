DROP INDEX `church_post_once`;--> statement-breakpoint
CREATE UNIQUE INDEX `church_post_once` ON `church_posts` (`owner`,`series`,`event_id`,`local_date`) WHERE "church_posts"."status" <> 'removed';
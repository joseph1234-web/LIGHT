CREATE TABLE `runner_locks` (
	`owner` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);

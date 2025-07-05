PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_party` (
	`id` integer PRIMARY KEY NOT NULL,
	`holder` text NOT NULL,
	`players` text NOT NULL,
	`is_in_queue` integer DEFAULT 0
);
--> statement-breakpoint
INSERT INTO `__new_party`("id", "holder", "players", "is_in_queue") SELECT "id", "holder", "players", "is_in_queue" FROM `party`;--> statement-breakpoint
DROP TABLE `party`;--> statement-breakpoint
ALTER TABLE `__new_party` RENAME TO `party`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
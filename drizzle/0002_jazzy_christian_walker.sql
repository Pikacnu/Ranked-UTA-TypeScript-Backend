PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_game` (
	`id` text PRIMARY KEY NOT NULL,
	`status` integer DEFAULT 0,
	`team_data` text,
	`gameType` text NOT NULL,
	`map_id` integer,
	`startTime` integer,
	`endTime` integer,
	`win_team` integer DEFAULT -1,
	`event_data` text
);
--> statement-breakpoint
INSERT INTO `__new_game`("id", "status", "team_data", "gameType", "map_id", "startTime", "endTime", "win_team", "event_data") SELECT "id", "status", "team_data", "gameType", NULL, "startTime", "endTime", -1, "event_data" FROM `game`;--> statement-breakpoint
DROP TABLE `game`;--> statement-breakpoint
ALTER TABLE `__new_game` RENAME TO `game`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `player` ADD `assistCount` integer;
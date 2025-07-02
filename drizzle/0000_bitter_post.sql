CREATE TABLE `game` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` integer DEFAULT 0,
	`team_data` text,
	`gameType` text NOT NULL,
	`startTime` integer,
	`endTime` integer,
	`event_data` text
);
--> statement-breakpoint
CREATE TABLE `party` (
	`id` integer PRIMARY KEY NOT NULL,
	`holder` text NOT NULL,
	`players` text NOT NULL,
	FOREIGN KEY (`holder`) REFERENCES `player`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `player` (
	`uuid` text PRIMARY KEY NOT NULL,
	`minecraftId` text NOT NULL,
	`discordID` text NOT NULL,
	`discordName` text,
	`deathCount` integer,
	`killCount` integer,
	`gameCount` integer,
	`rankScore` integer DEFAULT 0
);

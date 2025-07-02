import db from '../db';

export class Player {
	minecraftName: string;
	discordID: string;
	discordName: string;
	deathCount: number = 0;
	killCount: number = 0;
	PlayedGameCount: number = 0;

	constructor(minecraftName: string, discordID: string, discordName?: string) {
		this.minecraftName = minecraftName;
		this.discordID = discordID;
		this.discordName = discordName || '';
	}
}

import type { Action, Message as WSMessage } from '@/types';
import {
	SlashCommandBuilder,
	CommandInteraction,
	type SlashCommandOptionsOnlyBuilder,
	ChatInputCommandInteraction,
} from 'discord.js';

export type CommandData = {
	commandBuilder: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export class ICommand {
	public commandBuilder: CommandData['commandBuilder'];
	public execute: CommandData['execute'];

	constructor({ commandBuilder, execute }: CommandData) {
		this.commandBuilder = commandBuilder;
		this.execute = execute;
	}
}

export type MesssageQueueEntry = {
	action: Action;
	timestamp: number;
	callback: (message: Message) => void;
};

export type Message = Omit<WSMessage, 'sessionId'> & {
	status?: number;
	sessionId?: string;
};

export type RankData = {
	range: [number, number] | [number, null];
	level: number;
	name: string;
};

export const RANK_TIERS: RankData[] = [
	{ range: [0, 1200], level: 1, name: 'Ruins' },
	{ range: [1201, 1400], level: 6, name: 'Snowdin' },
	{ range: [1401, 1600], level: 10, name: 'Waterfall' },
	{ range: [1601, 1800], level: 13, name: 'Hotland' },
	{ range: [1801, 2000], level: 15, name: 'Core' },
	{ range: [2001, 2200], level: 16, name: 'New Home' },
	{ range: [2201, null], level: 20, name: 'GENOCIDE' },
];

export function getRankByElo(elo: number): RankData | null {
	return (
		RANK_TIERS.find((tier) => {
			const [min, max] = tier.range;
			return elo >= min && (max === null || elo <= max);
		}) || null
	);
}

import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
	type QueueName,
	type Message,
	type PartyPlayer,
	GameStatus,
} from '../../types';

export const playerTable = sqliteTable('player', {
	uuid: text().notNull().primaryKey(),
	minecraftId: text('minecraftId').notNull(),
	discordID: text().notNull(),
	discordName: text(),
	deathCount: int(),
	killCount: int(),
	assistCount: int(),
	gameCount: int(),
	rankScore: int().default(0),
});

export const partyTable = sqliteTable('party', {
	id: int().notNull().primaryKey(),
	holder: text()
		.notNull()
		.references(() => playerTable.uuid),
	players: text('players', { mode: 'json' }).notNull().$type<PartyPlayer[]>(),
	isInQueue: int('is_in_queue').default(0),
});

export const gameTable = sqliteTable('game', {
	id: text().notNull().primaryKey(),
	status: int().default(0).$type<GameStatus>(),
	teamData: text('team_data', { mode: 'json' }).$type<
		{ uuids: string[]; team_score: number }[]
	>(),
	gameType: text().notNull().$type<QueueName>(),
	mapId: int('map_id'),
	banCharacter: text('ban_character', { mode: 'json' }).$type<number[]>(),
	startTime: int(),
	endTime: int(),
	winTeam: int('win_team').default(-1),
	eventData: text('eventData', { mode: 'json' }).$type<Message>(),
});

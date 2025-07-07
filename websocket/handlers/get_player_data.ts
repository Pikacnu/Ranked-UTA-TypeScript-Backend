import { eq, or, sql } from 'drizzle-orm';
import db, { playerTable, partyTable } from '../../src/db';
import { Action, status, WebSocketError, type Message } from '../types';
import type { Handler } from './types';

export const action = Action.get_player_data;

export const handler: Handler = async ({ ws, message, logger }) => {
	const { payload } = message;
	let playerUuid = payload?.player?.uuid;
	const playerMinecraftId = payload?.player?.minecraftId;

	if (!playerUuid) {
		if (!playerMinecraftId) {
			logger.error('Player UUID or Minecraft ID are missing');
			ws.sendText(
				JSON.stringify({
					status: status.error,
					action: Action.get_player_data,
					payload: {
						message: 'Player UUID or Minecraft ID are required',
					},
				} as Message),
			);
			return;
		}
		playerUuid = (
			await db
				.select()
				.from(playerTable)
				.where(eq(playerTable.minecraftId, playerMinecraftId))
				.execute()
		)[0].uuid;
	}

	const playerDataFromDB = (
		await db
			.select()
			.from(playerTable)
			.leftJoin(
				partyTable,
				or(
					eq(partyTable.holder, playerUuid),
					sql`EXISTS (
						SELECT 1 FROM JSON_EACH(${partyTable.players}) 
						WHERE value = ${playerUuid}
					)`,
				),
			)
			.where(eq(playerTable.uuid, playerUuid))
			.execute()
	)[0];

	if (!playerDataFromDB) {
		const playerData = {
			uuid: playerUuid,
			minecraftId: playerMinecraftId,
			score: 1000,
			isInParty: false,
			partyId: undefined,
			isInQueue: false,
			gameCount: 0,
			deathCount: 0,
			killCount: 0,
		};
		ws.sendText(
			JSON.stringify({
				status: status.success,
				action: Action.get_player_data,
				payload: {
					player: playerData,
				},
			} as Message),
		);
		await db.insert(playerTable).values({
			uuid: playerUuid || '',
			minecraftId: playerMinecraftId || '',
			discordID: '',
			discordName: '',
			deathCount: 0,
			killCount: 0,
			gameCount: 0,
			rankScore: 1000,
		});
		return;
	}

	if (
		playerDataFromDB.player.minecraftId === null &&
		playerDataFromDB.player.minecraftId !== playerMinecraftId
	) {
		await db
			.update(playerTable)
			.set({
				minecraftId: playerMinecraftId,
			})
			.where(eq(playerTable.uuid, playerUuid));
	}

	const playerData = {
		uuid: playerUuid,
		minecraftId: playerDataFromDB.player.minecraftId,
		score: playerDataFromDB.player.rankScore,
		isInParty: !!playerDataFromDB.party,
		partyId: playerDataFromDB.party ? playerDataFromDB.party.id : undefined,
		isInQueue: false,
		gameCount: playerDataFromDB.player.gameCount || 0,
		deathCount: playerDataFromDB.player.deathCount || 0,
		killCount: playerDataFromDB.player.killCount || 0,
	};
	ws.sendText(
		JSON.stringify({
			status: status.success,
			action: Action.get_player_data,
			payload: {
				player: playerData,
			},
		} as Message),
	);
};

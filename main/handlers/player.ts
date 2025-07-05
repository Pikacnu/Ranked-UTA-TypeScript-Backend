import { eq, or, sql } from 'drizzle-orm';
import db, { playerTable, partyTable } from '../../src/db';
import { Action, status, WebSocketError, type Message } from '../../types';
import type { Handler } from './types';

const scoreDefault = 1000;

export const getPlayerDataHandler: Handler = async ({
	ws,
	message,
	logger,
}) => {
	const { payload } = message;
	const playerUuid = payload?.player?.uuid;
	const playerMinecraftId = payload?.player?.minecraftId;

	if (!playerUuid || playerUuid === '') {
		throw new WebSocketError('Player UUID is required');
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
			score: scoreDefault,
			isInParty: false,
			partyId: undefined,
			isInQueue: false,
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
		await db
			.insert(playerTable)
			.values({
				uuid: playerUuid || '',
				minecraftId: playerMinecraftId || '',
				discordID: '',
				discordName: '',
				deathCount: 0,
				killCount: 0,
				gameCount: 0,
				rankScore: scoreDefault,
			})
			.execute();
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
			.where(eq(playerTable.uuid, playerUuid))
			.execute();
	}

	const playerData = {
		uuid: playerUuid,
		minecraftId: playerDataFromDB.player.minecraftId,
		score: playerDataFromDB.player.rankScore,
		isInParty: !!playerDataFromDB.party,
		partyId: playerDataFromDB.party ? playerDataFromDB.party.id : undefined,
		isInQueue: false,
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

export const updatePlayerDataHandler: Handler = async ({ message, logger }) => {
	const { payload } = message;
	const updatePlayerUuid = payload?.player?.uuid;

	if (!updatePlayerUuid || updatePlayerUuid === '') {
		throw new WebSocketError('Player UUID is required');
	}

	try {
		await db
			.update(playerTable)
			.set({
				minecraftId: payload?.player?.minecraftId || 'null',
				deathCount: payload?.player?.deathCount || 0,
				killCount: payload?.player?.killCount || 0,
				gameCount: payload?.player?.gameCount || 0,
			})
			.where(eq(playerTable.uuid, updatePlayerUuid))
			.execute();
	} catch (error) {
		logger.error('Error updating player data', error);
		throw new WebSocketError('Error updating player data');
	}
};

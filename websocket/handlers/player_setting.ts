import {
	Action,
	MinecraftNbtProcessToJsonString,
	UUIDFromArray,
	UUIDStringToArray,
	type PlayerSettingDataStructure,
} from '@/types';
import type { Handler } from './types';
import { status } from '@/types';
import db, { playerTable } from '#/db';
import { Status } from 'discord.js';

export const action = Action.player_setting;

export const handler: Handler = async ({ ws, message, logger }) => {
	const { sessionId, payload } = message;
	if (!payload || !payload.data) {
		throw new Error('Command is required in player setting payload');
	}
	const data = JSON.parse(
		MinecraftNbtProcessToJsonString(payload.data.data[0]),
	) as PlayerSettingDataStructure;
	const playerUuid = UUIDFromArray(data.UUID||[]);
	if (!playerUuid) {
		throw new Error('Invalid UUID format in player setting payload');
	}
	try {
		const playerSetting = {
			uuid: playerUuid,
			N: data.N || 0,
			Q: data.Q || 3,
			S: data.S || 0,
			U: data.U || 0,
			B: data.B || 0,
		};

		await db.transaction(async (tx) => {
			tx.update(playerTable).set(playerSetting);
		});
		logger.info(
			`Player setting processed for UUID: ${playerUuid}`,
			playerSetting,
		);

		ws.send(
			JSON.stringify({
				status: status.success,
				action: Action.player_setting,
				sessionId,
				payload: {
					playerSetting,
				},
			}),
		);
		return;
	} catch (error) {
		logger.error('Error processing player setting', error);
		throw new Error('Error processing player setting');
	}
};

import { Action } from '@/types';
import type { Handler } from './types';
import db, { playerTable } from '#/db';
import { eq } from 'drizzle-orm';

export const action = Action.get_player_setting;

export const handler: Handler = async ({ ws, message, client, logger }) => {
	const { payload } = message;

	if (!payload || !payload.player) {
		throw new Error('Player UUID is required in get player setting payload');
	}

	const playerUuid = payload.player.uuid;
	if (!playerUuid) {
		throw new Error('Invalid UUID format in get player setting payload');
	}

	try {
		let playerSetting = (
			await db
				.select()
				.from(playerTable)
				.where(eq(playerTable.uuid, playerUuid))
				.execute()
		)[0]?.playerSettings;

		if (!playerSetting) {
			// If no player setting exists, create a default one
			playerSetting = {
				uuid: playerUuid,
				N: 0,
				Q: 3,
				S: 0,
				U: 0,
				B: 0,
			};

			await db
				.update(playerTable)
				.set({
					playerSettings: playerSetting,
				})
				.where(eq(playerTable.uuid, playerUuid))
				.execute();
			logger.info(`Created default player setting for UUID: ${playerUuid}`);
		}

		ws.send(
			JSON.stringify({
				status: 'success',
				action: Action.get_player_setting,
				sessionId: message.sessionId,
				payload: {
					playerSetting,
				},
			}),
		);
	} catch (error) {
		logger.error('Error fetching player setting', error);
		throw new Error('Error fetching player setting');
	}
};

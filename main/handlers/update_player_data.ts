import { eq } from 'drizzle-orm';
import db, { playerTable } from '../../src/db';
import { Action, WebSocketError } from '../../types';
import type { Handler } from './types';

export const action = Action.update_player_data;

export const handler: Handler = async ({ message, logger }) => {
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
			.where(eq(playerTable.uuid, updatePlayerUuid));
	} catch (error) {
		logger.error('Error updating player data', error);
		throw new WebSocketError('Error updating player data');
	}
};

import { eq } from 'drizzle-orm';
import db, { gameTable } from '../../src/db';
import {
	Action,
	GameStatus,
	MinecraftNbtProcessToJson,
	ServerStatus,
	status,
	WebSocketError,
} from '../types';
import type { Handler } from './types';

export const action = Action.game_state;

export const handler: Handler = async ({ ws, message, client, logger }) => {
	const { payload } = message;

	if (client?.isLobby) {
		throw new WebSocketError('Cannot change game status in lobby mode');
	}
	if (!payload || !payload.data) {
		throw new WebSocketError('Game status is required');
	}

	try {
		const statusData = payload.data as {
			storage: string;
			key: string;
			data: string[];
		};

		const data = JSON.parse(MinecraftNbtProcessToJson(statusData.data[0]));
		const banCharacter: number[] = data?.ban;
		const map: number = data?.map;
		if (client?.game?.id) {
			await db
				.update(gameTable)
				.set({
					banCharacter: banCharacter,
					mapId: map,
					status: GameStatus.idle,
				})
				.where(eq(gameTable.id, client.game.id))
				.execute();
		}
		return;
	} catch (error) {
		logger.error('Invalid game status', error);
		throw new WebSocketError('Invalid game status');
	}
};

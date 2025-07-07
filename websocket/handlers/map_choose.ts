import { eq } from 'drizzle-orm';
import db, { gameTable } from '../../src/db';
import { Action, WebSocketError } from '../../src/types';
import type { Handler } from './types';

export const action = Action.map_choose;

export const handler: Handler = async ({ message, client }) => {
	const { payload } = message;

	if (client?.game?.id) {
		if (!payload || !payload.data || !(payload.data as any).map) {
			throw new WebSocketError('Map ID is required');
		}
		const mapId = (payload.data as any).map as number;

		if (typeof mapId !== 'number' || mapId <= 0) {
			throw new WebSocketError('Invalid map ID');
		}
		await db
			.update(gameTable)
			.set({
				mapId: mapId,
			})
			.where(eq(gameTable.id, client.game.id))
			.execute();
	} else {
		throw new WebSocketError('No game to choose map for');
	}
};

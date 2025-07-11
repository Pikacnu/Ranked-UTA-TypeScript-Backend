import { eq } from 'drizzle-orm';
import db, { gameTable } from '../../src/db';
import {
	Action,
	GameStatus,
	MinecraftNbtProcessToJsonString,
	ServerStatus,
	status,
	WebSocketError,
} from '../types';
import type { Handler } from './types';

export const action = Action.game_status;

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
			status: GameStatus;
		};
		const gameStatus = (statusData as { status: GameStatus }).status;
		if (client?.game?.id) {
			await db
				.update(gameTable)
				.set({
					status: gameStatus,
				})
				.where(eq(gameTable.id, client.game.id))
				.execute();
		} else {
			throw new WebSocketError('No game to update status');
		}
		if (gameStatus === GameStatus.idle) {
			if (client?.game) {
				//send player to lobby
				ws.send(
					JSON.stringify({
						status: status.success,
						action: Action.transfer,
						payload: {
							transferData: {
								targetServer: 'ranked-uta.pikacnu.com',
								targetPort: 25565,
								uuids: client.game.players.map((p) => p.uuid),
							},
						},
					}),
				);
				client.game = undefined;
				client.status = ServerStatus.pending;
				ws.send(
					JSON.stringify({
						status: status.success,
						action: Action.whitelist_change,
						payload: {
							whitelist: [],
						},
					}),
				);
			} else {
				throw new WebSocketError('No game to set to idle');
			}
		}
	} catch (error) {
		logger.error('Invalid game status', error);
		throw new WebSocketError('Invalid game status');
	}
};

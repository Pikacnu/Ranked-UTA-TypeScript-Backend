import { eq } from 'drizzle-orm';
import db, { gameTable } from '../../src/db';
import {
	Action,
	GameStatus,
	MinecraftNbtProcessToJson,
	ServerStatus,
	status,
	WebSocketError,
} from '../../types';
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
		const statusData = payload.data as unknown as
			| {
					status: GameStatus;
			  }
			| {
					storage: string;
					key: string;
					data: string[];
			  };
		if (
			'storage' in statusData &&
			'key' in statusData &&
			'data' in statusData
		) {
			statusData as {
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
		}
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
								targetServer: 'ruta.pikacnu.com',
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
							whilelist: [],
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

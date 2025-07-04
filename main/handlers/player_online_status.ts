import {
	Action,
	GameStatus,
	status,
	WebSocketError,
	Connection,
	ConnectionStatusStringToEnum,
	QueueNameToSize,
} from '../../types';
import { calculateAverageRating, getRoundByRankScore } from '../rank';
import type { Handler } from './types';

export const action = Action.player_online_status;

export const handler: Handler = async ({ ws, message, client, logger }) => {
	const { sessionId, payload } = message;

	if (!payload || !payload.playerOnlineStatus) {
		throw new WebSocketError('Player online status is required');
	}
	if (!client || !client.game) {
		return;
	}

	logger.info('Updating player online status', {
		sessionId,
	});

	let { uuids, connection } = payload.playerOnlineStatus;
	connection = ConnectionStatusStringToEnum(connection);
	if (!Array.isArray(uuids)) {
		throw new WebSocketError('Player UUIDs are required');
	}

	client.game.players.forEach((player) => {
		if (uuids.includes(player.uuid)) {
			player.isOnline = connection === Connection.CONNECTED;
		}
	});

	if (
		client.game.players.every((player) => player.isOnline) &&
		client.game.status === GameStatus.idle
	) {
		client.game.status = GameStatus.start;
		ws.send(
			JSON.stringify({
				status: status.success,
				action: Action.team_join,
				payload: {
					teamData: [
						{
							names: client.game.players
								.filter((p) => p.isTeam1)
								.flatMap((p) => p.minecraftId),
							team: 1,
						},
						{
							names: client.game.players
								.filter((p) => !p.isTeam1)
								.flatMap((p) => p.minecraftId),
							team: 2,
						},
					],
				},
			}),
		);
		ws.send(
			JSON.stringify({
				status: status.success,
				action: Action.command,
				payload: {
					command: `function ranked:start_game {gameMode:${
						QueueNameToSize[client.game.type] < 3 ? 4 : 7
					},gameRound:${
						QueueNameToSize[client.game.type] > 3
							? 1
							: getRoundByRankScore(
									calculateAverageRating(
										client.game.players.map((p) => p.score),
									) || 0,
							  )
					},banRuleType:1,enableSameChar:1,enableNewSkill:0,enableNewWillSystem:${
						QueueNameToSize[client.game.type] === 1 ? 0 : 1
					}}`,
				},
			}),
		);
		logger.info('Game started - all players online', {
			gameId: client.clientId,
		});
		client.game.status = GameStatus.during;
	}
};

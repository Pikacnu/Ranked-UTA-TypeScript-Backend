import { eq, sql } from 'drizzle-orm';
import db, { gameTable } from '../../src/db';
import { Action, WebSocketError, type KillData } from '../../types';
import type { Handler } from './types';

export const action = Action.kill;

export const handler: Handler = async ({ message, client }) => {
	const { payload } = message;

	if (!payload || !payload.data) {
		throw new WebSocketError('Kill data is required');
	}

	const killData = payload.data as KillData;
	if (!killData.target || !killData.attacker || !killData.type) {
		throw new WebSocketError('Invalid kill data');
	}

	if (!client?.game?.id) {
		throw new WebSocketError('No game to log kill event');
	}

	// Update player stats
	const targetPlayer = client.game.players.find(
		(player) => player.uuid === killData.target,
	);
	const attackerPlayer = client.game.players.find(
		(player) => player.uuid === killData.attacker,
	);
	const assistPlayer = client.game.players.find((player) =>
		killData.assists?.includes(player.uuid),
	);
	if (targetPlayer) {
		targetPlayer.deathCount += 1;
	}
	if (attackerPlayer) {
		attackerPlayer.killCount += 1;
	}
	if (assistPlayer) {
		assistPlayer.assistCount += 1;
	}
	// Log the kill event
	await db
		.update(gameTable)
		.set({
			eventData: sql`JSON_ARRAY_APPEND(COALESCE(eventData, JSON_ARRAY()), '$', ${JSON.stringify(
				killData,
			)})`,
		})
		.where(eq(gameTable.id, client?.game?.id || ''));
};

import { eq, sql } from 'drizzle-orm';
import db, { gameTable } from '../../src/db';
import { Action, WebSocketError, type DamageData } from '../../types';
import type { Handler } from './types';

export const action = Action.damage;

export const handler: Handler = async ({ message, client }) => {
	const { payload } = message;

	if (!payload || !payload.data || !payload.data) {
		throw new WebSocketError('Damage data is required');
	}

	const damageData = payload.data as DamageData;
	if (
		!damageData.target ||
		!damageData.attacker ||
		typeof damageData.damage !== 'number'
	) {
		throw new WebSocketError('Invalid damage data');
	}

	await db
		.update(gameTable)
		.set({
			eventData: sql`json_insert(COALESCE(eventData, json_array()), '$[#]', ${JSON.stringify(
				damageData,
			)})`,
		})
		.where(eq(gameTable.id, client?.game?.id || ''))
		.execute();
};

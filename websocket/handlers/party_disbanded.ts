import { eq } from 'drizzle-orm';
import db, { partyTable } from '../../src/db';
import { Action, status, WebSocketError } from '../types';
import type { Handler } from './types';

export const action = Action.party_disbanded;

export const handler: Handler = async ({ ws, message, logger }) => {
	const { payload } = message;

	if (!payload?.party || !payload.party.partyId) {
		throw new WebSocketError('Party ID is required to disband');
	}

	const disbandPartyId = payload.party.partyId;
	try {
		await db
			.delete(partyTable)
			.where(eq(partyTable.id, disbandPartyId))
			.execute();
		ws.send(
			JSON.stringify({
				status: status.success,
				action: Action.party_disbanded,
				payload: {
					message: 'Party disbanded successfully',
				},
			}),
		);
	} catch (error) {
		logger.error('Error disbanding party', error);
		throw new WebSocketError('Error disbanding party');
	}
};

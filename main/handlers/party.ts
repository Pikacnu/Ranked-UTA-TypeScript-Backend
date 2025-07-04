import { eq } from 'drizzle-orm';
import db, { partyTable } from '../../src/db';
import { Action, status, WebSocketError } from '../../types';
import type { Handler } from './types';

export const action = Action.party;

export const handler: Handler = async ({ ws, message, logger }) => {
	const { payload } = message;

	if (!payload?.party) {
		throw new WebSocketError('Party data is required');
	}

	const { partyId, partyLeaderUUID, partyMembers } = payload.party;
	if (!partyId || !partyLeaderUUID || !partyMembers) {
		throw new WebSocketError('Party ID, leader UUID, and members are required');
	}

	try {
		const existingParty = await db
			.select()
			.from(partyTable)
			.where(eq(partyTable.id, partyId))
			.execute();

		if (existingParty.length > 0) {
			await db
				.update(partyTable)
				.set({
					holder: partyLeaderUUID,
					players: partyMembers,
				})
				.where(eq(partyTable.id, partyId))
				.execute();
		} else {
			await db
				.insert(partyTable)
				.values({
					id: partyId,
					holder: partyLeaderUUID,
					players: partyMembers,
				})
				.execute();
		}
		ws.send(
			JSON.stringify({
				status: status.success,
				action: Action.party,
				payload: {
					message: 'Party updated successfully',
				},
			}),
		);
	} catch (error) {
		logger.error('Error handling party action', error);
		throw new WebSocketError('Error handling party action');
	}
};

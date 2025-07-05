import { eq } from 'drizzle-orm';
import db, { partyTable } from '../../src/db';
import { Action, status, WebSocketError, type PartyPlayer } from '../../types';
import type { Handler } from './types';

// 數據驗證函數
function validatePartyMembers(members: any[]): PartyPlayer[] {
	if (!Array.isArray(members)) {
		throw new WebSocketError('Party members must be an array');
	}

	return members.map((member, index) => {
		if (!member || typeof member !== 'object') {
			throw new WebSocketError(`Invalid party member at index ${index}`);
		}

		if (!member.uuid || typeof member.uuid !== 'string') {
			throw new WebSocketError(
				`Invalid UUID for party member at index ${index}`,
			);
		}

		if (!member.minecraftId || typeof member.minecraftId !== 'string') {
			throw new WebSocketError(
				`Invalid minecraftId for party member at index ${index}`,
			);
		}

		const score = typeof member.score === 'number' ? member.score : 0;

		return {
			uuid: member.uuid,
			minecraftId: member.minecraftId,
			score: score,
		};
	});
}

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
		// 使用事務確保數據一致性
		await db.transaction(async (tx) => {
			const existingParty = await tx
				.select()
				.from(partyTable)
				.where(eq(partyTable.id, partyId))
				.execute();

			// 確保 partyMembers 是正確的數組格式
			const validatedMembers = validatePartyMembers(partyMembers);

			if (existingParty.length > 0) {
				await tx
					.update(partyTable)
					.set({
						holder: partyLeaderUUID,
						players: validatedMembers,
					})
					.where(eq(partyTable.id, partyId))
					.execute();
			} else {
				await tx
					.insert(partyTable)
					.values({
						id: partyId,
						holder: partyLeaderUUID,
						players: validatedMembers,
					})
					.execute();
			}
		});
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

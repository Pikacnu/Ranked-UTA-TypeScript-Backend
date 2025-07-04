import db, { partyTable } from '../../src/db';
import {
	Action,
	QueueNameToSize,
	status,
	WebSocketError,
	type PartyData,
} from '../../types';
import type { Handler } from './types';

export const action = Action.queue;

export const handler: Handler = async ({
	ws,
	message,
	logger,
	queueManager,
}) => {
	const { payload } = message;

	if (!payload?.queue || !payload.queue.queue_name) {
		logger.warn('Queue join failed', {
			reason: 'Queue name is required',
		});
		throw new WebSocketError('Queue name is required');
	}

	if (!QueueNameToSize[payload.queue.queue_name]) {
		logger.warn('Queue join failed', {
			queueName: payload.queue.queue_name,
			reason: 'Queue not found',
		});
		throw new WebSocketError(`Queue ${payload.queue.queue_name} not found`);
	}

	const parties = await db.select().from(partyTable).execute();
	const party = parties.find(
		(p) =>
			p.holder === payload.queue?.uuid ||
			p.players.some((player: any) => player.uuid === payload.queue?.uuid),
	);

	if (!party) {
		logger.warn('Queue join failed', {
			uuid: payload.queue.uuid,
			reason: 'Party not found',
		});
		throw new WebSocketError(`Party not found for UUID ${payload.queue.uuid}`);
	}

	const partyData: PartyData = {
		partyId: party.id,
		partyLeaderUUID: party.holder,
		partyMembers: party.players,
		isInQueue: true,
	};

	try {
		queueManager.enqueue(
			QueueNameToSize[payload.queue.queue_name] || 1,
			partyData,
		);
		logger.info('Party joined queue', {
			partyId: partyData.partyId,
			queueName: payload.queue.queue_name,
		});

		ws.send(
			JSON.stringify({
				status: status.success,
				action: Action.queue,
				payload: {
					message: `Successfully joined ${payload.queue.queue_name} queue`,
				},
			}),
		);
	} catch (error) {
		logger.error('Error adding party to queue', error);
		throw new WebSocketError(
			`Error joining queue: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
		);
	}
};

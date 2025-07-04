import {
	QueueNameToSize,
	SizeToQueueName,
	Action,
	status,
	WebSocketError,
	type PartyData,
} from '../../types';
import type { Handler } from './types';

export const action = Action.queue_leave;

export const handler: Handler = async ({
	ws,
	message,
	logger,
	queueManager,
}) => {
	const { payload } = message;

	logger.debug('Queue leave request', payload);
	if (!payload?.queue) {
		logger.warn('Queue leave failed', {
			reason: 'Queue data is required for leaving queue',
		});
		throw new WebSocketError('Queue data is required for leaving queue');
	}

	if (!payload.queue.uuid) {
		throw new WebSocketError('Player UUID is required');
	}

	let partyToRemove: PartyData | undefined;
	let isRemoved = false;

	Object.values(QueueNameToSize).forEach((queueCount) => {
		if (isRemoved) return;
		const allPartiesInQueue = queueManager.getCandidates(queueCount || 1);
		partyToRemove = allPartiesInQueue.find(
			(party: PartyData) =>
				party.partyLeaderUUID === payload.queue?.uuid ||
				party.partyMembers.some(
					(member: any) => member.uuid === payload.queue?.uuid,
				),
		);
		if (partyToRemove) {
			queueManager.removeFromQueue(queueCount || 1, partyToRemove.partyId);
			logger.info('Party left queue', {
				partyId: partyToRemove.partyId,
				queueName: SizeToQueueName[queueCount],
			});
			isRemoved = true;
		}
		return;
	});

	if (isRemoved) {
		ws.send(
			JSON.stringify({
				status: status.success,
				action: Action.queue_leave,
				payload: {
					message: `Successfully left ${payload.queue.queue_name} queue`,
				},
			}),
		);
	} else {
		throw new WebSocketError('Party not found in queue');
	}
};

import db, { partyTable } from '#/db';
import { eq } from 'drizzle-orm/sqlite-core/expressions';
import {
	QueueNameToSize,
	SizeToQueueName,
	Action,
	status,
	WebSocketError,
	type PartyData,
} from '../../src/types';
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

	// 修復非同步迭代問題
	for (const queueCount of Object.values(QueueNameToSize)) {
		if (isRemoved) break;

		try {
			const allPartiesInQueue = queueManager.getCandidates(queueCount || 1);
			partyToRemove = allPartiesInQueue.find((party: PartyData) => {
				try {
					return (
						party.partyLeaderUUID === payload.queue?.uuid ||
						party.partyMembers.some(
							(member: any) => member && member.uuid === payload.queue?.uuid,
						)
					);
				} catch (error) {
					logger.error('Error checking party member', {
						partyId: party.partyId,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
					return false;
				}
			});

			if (partyToRemove) {
				queueManager.removeFromQueue(queueCount || 1, partyToRemove.partyId);
				logger.info('Party left queue', {
					partyId: partyToRemove.partyId,
					queueName: SizeToQueueName[queueCount],
				});
				isRemoved = true;
				break;
			}
		} catch (error) {
			logger.error('Error processing queue leave', {
				queueCount,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	console.log(partyToRemove);

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

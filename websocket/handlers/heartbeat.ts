import { Action } from '../../src/types';
import type { Handler } from './types';

export const action = Action.heartbeat;

export const handler: Handler = async ({ message, clients, logger }) => {
	const { sessionId } = message;

	if (sessionId) {
		const client = clients.find((c) => c.clientId === sessionId);
		if (client) {
			client.lastHeartbeat = Date.now();
		} else {
			logger.warn('Client heartbeat failed', {
				sessionId,
				reason: 'Client not found',
			});
		}
	}
};

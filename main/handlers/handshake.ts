import { Action, WebSocketError } from '../../types';
import type { Handler } from './types';

export const action = Action.handshake;

export const handler: Handler = async ({ message, client, logger }) => {
	const { sessionId, payload } = message;

	if (!payload || !payload?.lobby) {
		throw new WebSocketError('Lobby information is required');
	}
	if (!client) {
		logger.warn('Client handshake failed', {
			sessionId,
			reason: 'Client not found',
		});
		return;
	}
	client.isLobby = payload?.lobby?.isLobby || false;
};

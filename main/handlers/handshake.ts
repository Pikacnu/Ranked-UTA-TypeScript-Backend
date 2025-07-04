import { Action, WebSocketError } from '../../types';
import type { Handler } from './types';

export const action = Action.handshake;

export const handler: Handler = async ({ ws, message, client, logger }) => {
	const { sessionId, payload } = message;

	if (!payload || !payload?.handshake) {
		throw new WebSocketError('Handshake payload is required');
	}

	if (!client) {
		logger.warn('Client handshake failed', {
			sessionId,
			reason: 'Client not found',
		});
		return;
	}

	if (
		payload.handshake.sessionId &&
		payload.handshake.sessionId !== sessionId
	) {
		ws.unsubscribe(client.clientId);
		ws.subscribe(payload.handshake.sessionId);
		logger.info('Client session ID updated');
		client.clientId = payload.handshake.sessionId;
	}
	client.serverIP = payload.handshake.serverIP;
	client.serverPort = payload.handshake.serverPort;

	client.isLobby = payload?.handshake?.isLobby || false;
};

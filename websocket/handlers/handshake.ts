import { Status } from 'discord.js';
import { Action, status, WebSocketError } from '../types';
import type { Handler } from './types';
import { Webhook } from '@/webhook';

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
		logger.info('Client session ID updated');
		ws.unsubscribe(client.clientId);
		ws.subscribe(payload.handshake.sessionId);
		client.clientId = payload.handshake.sessionId;
	}
	client.serverIP = payload.handshake.serverIP;
	client.serverPort = payload.handshake.serverPort;

	client.isLobby = payload?.handshake?.isLobby || false;
	if (client.clientId !== 'Discord-Client') {
		Webhook.sendOnline(client);
	}
};

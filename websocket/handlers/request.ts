import { Action, status, WebSocketError, type Message } from '../types';
import type { Handler } from './types';

export const action = Action.request_data;

export const handler: Handler = async ({ ws, message, clients }) => {
	const { sessionId, payload } = message;

	if (sessionId) {
		const requestedClient = clients.find((c) => c.clientId === sessionId);
		if (requestedClient) {
			if (!payload?.request_target || payload?.request_target === '') {
				throw new WebSocketError('Request target is required');
			}
			ws.send(
				JSON.stringify({
					status: status.success,
					action: Action.request_data,
					payload: {
						request_target: payload?.request_target,
						data: {
							result: {
								message: 'Hello world',
							},
						},
					},
				} as Message),
			);
		} else {
			throw new WebSocketError(`Client with ID ${sessionId} not found.`);
		}
	}
};

import type { MesssageQueueEntry } from '#/commands/type';
import { Action, type Message as WSMessage } from '@/types';
import { type Message } from '#/commands/type';

export class WebsocketClient {
	private static client: WebSocket | null = null;
	public static RequestQueue: MesssageQueueEntry[] = [];
	private static clientId: string = 'Discord-Client';
	private static connectUrl: string | null = null;
	private static reconnectTime = 5000; // 5 seconds

	public static initialize(url: string): void {
		if (this.client) {
			console.warn('WebSocket client is already initialized.');
			return;
		}
		this.client = new WebSocket(url);
		this.connectUrl = url;
		this.client.onopen = () => {
			console.log('WebSocket connection established.');
		};
		this.client.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as Message;
				if (!data || !data.action) {
					console.error('Invalid message format:', event.data);
					return;
				}
				if (data.action === Action.handshake) {
					this.sendMessage({
						action: Action.handshake,
						sessionId: data.sessionId,
						payload: {
							handshake: {
								isLobby: true,
								sessionId: this.clientId,
								serverIP: '',
								serverPort: 0,
							},
						},
					});
				}
				if (data.action === Action.heartbeat) {
					this.sendMessage({
						action: Action.heartbeat,
					});
				}

				if(data.action === Action.output_win){
					
				}

				if (
					data.action !== Action.handshake &&
					data.action !== Action.heartbeat
				) {
					console.log(`
						Received message: ${data.action}`);
				}

				const request = this.RequestQueue.sort(
					(a, b) => a.timestamp - b.timestamp,
				).find((req) => req.action === data.action);

				request?.callback(data);
				this.RequestQueue = this.RequestQueue.filter(
					(req) =>
						req.action !== data.action && req.timestamp !== request?.timestamp,
				);
			} catch (error) {
				console.error('Error parsing WebSocket message:', error);
			}
		};
		this.client.onerror = (error) => {
			console.error('WebSocket error:', error);
			this.reconnect(); // Attempt to reconnect on error
		};
		this.client.onclose = () => {
			console.log('WebSocket connection closed.');
			this.client = null; // Reset client on close
			this.reconnect(); // Attempt to reconnect on error
		};
	}

	private static reconnect(): void {
		if (this.client && this.client.readyState === WebSocket.OPEN) {
			console.warn('WebSocket client is already connected.');
			return;
		}
		console.log('Reconnecting WebSocket client...');
		setTimeout(() => {
			this.initialize(this.connectUrl || ''); // Replace with your WebSocket server URL
		}, this.reconnectTime);
	}

	public static sendMessage(
		message: Message,
		callback?: (message: Message) => void,
	): void {
		if (!this.client || this.client.readyState !== WebSocket.OPEN) {
			console.error('WebSocket client is not connected.');
			return;
		}
		try {
			this.client.send(
				message.sessionId
					? JSON.stringify({ ...message } as WSMessage)
					: JSON.stringify({
							...message,
							sessionId: this.clientId,
					  } as WSMessage),
			);
			if (
				!(
					message.action === Action.handshake ||
					message.action === Action.heartbeat
				)
			) {
				console.log('Message sent:', message);
			}
			if (callback) {
				this.RequestQueue.push({
					action: message.action,
					timestamp: Date.now(),
					callback,
				});
			}
		} catch (error) {
			console.error('Error sending WebSocket message:', error);
		}
	}
}

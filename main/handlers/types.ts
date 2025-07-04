import type { ServerWebSocket } from 'bun';
import type { Message, Server } from '../../types';
import type { QueueManager } from '../queue';

export interface HandlerContext {
	ws: ServerWebSocket<unknown>;
	message: Message;
	client: Server | undefined;
	clients: Server[];
	logger: {
		info: (message: string, data?: any) => void;
		warn: (message: string, data?: any) => void;
		error: (message: string, error?: any) => void;
		debug: (message: string, data?: any) => void;
		ws: (action: string, sessionId: string, payload: any) => void;
	};
	server: Bun.Server;
	queueManager: QueueManager;
}

export type Handler = (context: HandlerContext) => Promise<void>;

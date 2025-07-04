import type { ServerWebSocket } from 'bun';
import type { Message, Server } from '../../types';

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
	queueManager: any;
}

export type Handler = (context: HandlerContext) => Promise<void>;

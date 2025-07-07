import { Glob } from 'bun';
import type { Handler, HandlerContext } from './types';

// Handler mapping
const handlers: Record<string, Handler> = {};
const handlerFiles: Record<string, string> = {};

async function loadHandlers() {
	try {
		// Manually import each handler file
		const handlerModules = Array.from(
			new Glob('./*.ts').scanSync('./main/handlers'),
		).map((file) => ({
			file: file,
			module: () => import(file),
		}));

		for (const { file, module } of handlerModules) {
			try {
				const mod = await module();

				if (mod.action && typeof mod.action === 'string') {
					if (mod.handler && typeof mod.handler === 'function') {
						handlers[mod.action] = mod.handler;
						handlerFiles[mod.action] = file;
						console.log(`✓ Loaded handler: ${mod.action} from ${file}`);
					} else {
						console.warn(`⚠ Handler function 'handler' not found in ${file}`);
					}
				} else {
					console.warn(`⚠ No action export found in ${file}`);
				}
			} catch (error) {
				console.error(`✗ Failed to load handler from ${file}:`, error);
			}
		}

		console.log(`Loaded ${Object.keys(handlers).length} handlers`);
	} catch (error) {
		console.error('Failed to load handlers:', error);
	}
}

// Load handlers on module initialization
await loadHandlers();

export async function handleMessage(context: HandlerContext): Promise<boolean> {
	const { message, logger } = context;
	const { action } = message;

	const handler = handlers[action];
	if (!handler) {
		logger.warn('Unknown action received', {
			action,
		});
		return false;
	}

	try {
		await handler(context);
		return true;
	} catch (error) {
		logger.error(`Handler ${action} failed`, {
			action,
			handlerFile: handlerFiles[action],
			error: error instanceof Error ? error.message : error,
		});
		throw error;
	}
}

export function getLoadedHandlers(): Record<string, string> {
	return { ...handlerFiles };
}

export function reloadHandlers(): Promise<void> {
	// Clear existing handlers
	Object.keys(handlers).forEach((key) => delete handlers[key]);
	Object.keys(handlerFiles).forEach((key) => delete handlerFiles[key]);

	// Reload all handlers
	return loadHandlers();
}

export type { Handler, HandlerContext } from './types';

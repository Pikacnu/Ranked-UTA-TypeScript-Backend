import { randomUUIDv7 } from 'bun';
import {
	Action,
	GameStatus,
	QueueNameToSize,
	ServerStatus,
	SizeToQueueName,
	status,
	WebSocketError,
	type Message,
	type PartyData,
	type QueueName,
	type Server,
} from './types';
import db, { gameTable } from '../src/db';
import { QueueManager, PartyMatchmaker, MatchResult } from './queue';
import { handleMessage } from './handlers';
import { Webhook } from './webhook';

/*
	Gate File Path "C:\Users\User\AppData\Local\Gate\bin"
	* Use Gate For Forward Minecraft Server
*/

const port = 8080;

const webhookClient = new Webhook(process.env.DiscordWebhookUrl || '');

// Console logging utilities
const logger = {
	info: (message: string, data?: any) => {
		const timestamp = new Date().toISOString();
		console.log(
			`\x1b[90m[${timestamp}]\x1b[0m \x1b[36m${'[INFO]'.padEnd(
				10,
			)}\x1b[0m ${message}`,
			data || '',
		);
	},
	warn: (message: string, data?: any) => {
		const timestamp = new Date().toISOString();
		console.warn(
			`\x1b[90m[${timestamp}]\x1b[0m \x1b[33m${'[WARN]'.padEnd(
				10,
			)}\x1b[0m ${message}`,
			data || '',
		);
	},
	error: (message: string, error?: any) => {
		const timestamp = new Date().toISOString();
		console.error(
			`\x1b[90m[${timestamp}]\x1b[0m \x1b[31m${'[ERROR]'.padEnd(
				10,
			)}\x1b[0m ${message}`,
			error || '',
		);
	},
	debug: (message: string, data?: any) => {
		const timestamp = new Date().toISOString();
		console.log(
			`\x1b[90m[${timestamp}]\x1b[0m \x1b[35m${'[DEBUG]'.padEnd(
				10,
			)}\x1b[0m ${message}`,
			data || '',
		);
	},
	ws: (action: string, sessionId: string, payload: any) => {
		const timestamp = new Date().toISOString();
		const shortId = sessionId?.split('-')[1] || 'unknown';
		console.log(
			`\x1b[90m[${timestamp}]\x1b[0m \x1b[32m${'[WS]'.padEnd(
				10,
			)}\x1b[0m \x1b[34m${action.padEnd(
				20,
				' ',
			)}\x1b[0m | \x1b[93m${shortId}\x1b[0m | ${JSON.stringify(payload)}`,
		);
	},
};

const matchedWaitingQueue: (MatchResult & {
	id: number;
})[] = [];
let clients: Server[] = [];

function newClient() {
	const clientId = randomUUIDv7();
	clients.push({
		clientId,
		lastHeartbeat: Date.now(),
		status: ServerStatus.pending,
		isLobby: false, // Default to false, can be updated later
		serverIP: '', // Placeholder, will be set during handshake
		serverPort: 0, // Placeholder, will be set during handshake
	});
	return clientId;
}

const queueManager = new QueueManager();
const matchmaker = new PartyMatchmaker(queueManager);

const server = Bun.serve({
	port,
	fetch(request, server) {
		const url = new URL(request.url);
		const pathname = url.pathname;
		if (pathname === '/ws' && server.upgrade(request, {})) {
			return;
		}
		return new Response('Not Found', {
			status: 404,
		});
	},
	websocket: {
		open(ws) {
			logger.info('WebSocket connection opened');
			ws.subscribe('heartbeat');
			const sessionId = newClient();
			ws.subscribe(sessionId);
			ws.send(
				JSON.stringify({
					status: status.success,
					action: Action.handshake,
					sessionId,
					payload: {
						sessionId,
					},
				}),
			);
			ws.send(
				JSON.stringify({
					status: status.success,
					action: Action.command,
					payload: {
						command:
							'tellraw @a [{"text":"Success to Connect to the back Server","color":"green"}]',
					},
				}),
			);
		},
		async message(ws, message) {
			if (typeof message !== 'string') {
				logger.error('Received non-string message', { message });
				return;
			}
			try {
				const parsedMessage: Message = JSON.parse(message);
				const { action, sessionId, payload } = parsedMessage;
				const client = clients.find((c) => c.clientId === sessionId);

				// Use the new handler system
				const handled = await handleMessage({
					ws,
					message: parsedMessage,
					client,
					clients,
					logger,
					server,
					queueManager,
				});

				if (!handled) {
					logger.warn('Unhandled action', { action });
				}

				if (parsedMessage.action !== Action.heartbeat)
					logger.ws(
						parsedMessage.action,
						parsedMessage.sessionId || 'unknown',
						payload,
					);
			} catch (error) {
				if (error instanceof SyntaxError) {
					logger.error('Invalid JSON message', { message });
					ws.send(
						JSON.stringify({
							status: status.error,
							action: Action.message,
							payload: {
								message: 'Invalid JSON format',
							},
						}),
					);
				} else if (error instanceof WebSocketError) {
					logger.error('WebSocket error', { error: error.message });
				} else {
					logger.error('Error processing message', error);
					const { action } = JSON.parse(message) as Message;
					ws.send(
						JSON.stringify({
							status: status.error,
							action: action,
							payload: {
								message: 'Error processing message',
							},
						}),
					);
				}
			}
		},
		close(ws, code, reason) {
			logger.info('WebSocket connection closed', { code, reason });
			logger.info(`Online clients count : ${clients.length}`);
		},
	},
});

logger.info(`WebSocket server is running on ws://localhost:${port}/ws`);

function getQueueStatus(): {
	[queueName: string]: {
		targetSize: number;
		partiesCount: number;
		totalPlayers: number;
	};
} {
	const status: {
		[queueName: string]: {
			targetSize: number;
			partiesCount: number;
			totalPlayers: number;
		};
	} = {};

	Object.entries(QueueNameToSize).forEach(([queueName, queueSize]) => {
		const candidates = queueManager.getCandidates(queueSize);
		const totalPlayers = candidates.reduce(
			(sum, party) => sum + party.partyMembers.length,
			0,
		);

		status[queueName] = {
			targetSize: queueSize,
			partiesCount: candidates.length,
			totalPlayers: totalPlayers,
		};
	});

	return status;
}

const partyStatusShower = setInterval(() => {
	const status = getQueueStatus();
	const hasPlayers = Object.entries(status).filter(
		([_, queue]) => queue.totalPlayers > 0,
	);
	if (hasPlayers)
		Object.values(hasPlayers).forEach(([name, queue]) => {
			logger.info('Queue status', {
				queueName: name,
				partiesCount: queue.partiesCount,
				totalPlayers: queue.totalPlayers,
			});
		});
	else logger.info('No players in any queues');
}, 30 * 1000);

const heartbeat = setInterval(() => {
	clients = clients.filter((client) => {
		if (Date.now() - (client.lastHeartbeat || 0) > 60 * 1000) {
			logger.warn('Client timed out', { clientId: client.clientId });
			server.publish(
				client.clientId,
				JSON.stringify({
					status: status.success,
					action: Action.disconnect,
				}),
			);
			Webhook.sendOffline(client);
			return false;
		}
		return true;
	});
	server.publish(
		'heartbeat',
		JSON.stringify({
			status: status.success,
			action: Action.heartbeat,
		}),
	);
}, 10_000);

// Matchmaking loop
setInterval(() => {
	const newMatches = matchmaker.matchAllQueues();
	const matchResults: (MatchResult & {
		id: number;
	})[] = [...matchedWaitingQueue, ...newMatches].map(
		(result, index) =>
			({
				...result,
				id: Date.now() + index, // Assign a unique ID to each match result
			} as MatchResult & {
				id: number;
			}),
	);

	if (matchResults.length === 0) {
		//logger.debug('No matches found in any queues');
		return;
	}

	const pendingServers: Server[] = clients.filter(
		(client) => client.status === ServerStatus.pending && !client.isLobby,
	);

	if (pendingServers.length === 0) {
		logger.warn('No pending servers available for matchmaking');

		// Only add new matches to waiting queue, not existing ones
		const newMatchesToQueue = newMatches.map((result, index) => ({
			...result,
			id: Date.now() + matchedWaitingQueue.length + index,
		}));

		// Limit the waiting queue size to prevent stack overflow
		const maxQueueSize = 100;
		if (matchedWaitingQueue.length + newMatchesToQueue.length > maxQueueSize) {
			logger.warn(
				`Waiting queue size limit reached (${maxQueueSize}), dropping oldest matches`,
			);
			const totalNewSize =
				matchedWaitingQueue.length + newMatchesToQueue.length;
			const itemsToRemove = totalNewSize - maxQueueSize;
			matchedWaitingQueue.splice(0, itemsToRemove);
		}

		matchedWaitingQueue.push(...newMatchesToQueue);
		logger.debug(
			`Added ${newMatchesToQueue.length} new matches to waiting queue. Total waiting: ${matchedWaitingQueue.length}`,
		);
		return;
	}

	// Clear the waiting queue as we're processing matches
	matchedWaitingQueue.length = 0;

	pendingServers.forEach((gameServer) => {
		const result =
			matchResults[Math.floor(Math.random() * matchResults.length)];
		if (!result) {
			logger.warn('No match result found for server', {
				serverId: gameServer.clientId,
			});
			return;
		}

		// Remove the used match result from the array to prevent reuse
		const resultIndex = matchResults.findIndex((r) => r.id === result.id);
		if (resultIndex !== -1) {
			matchResults.splice(resultIndex, 1);
		}

		logger.info('Match found', {
			queueSize: result.queueSize,
			avgDiff: result.avgDiff,
		});

		// Update game server Whitelist
		server.publish(
			gameServer.clientId,
			JSON.stringify({
				status: status.success,
				action: Action.whitelist_change,
				payload: {
					whitelist: [
						...result.teamA.flatMap((party: PartyData) =>
							party.partyMembers.map((member) => ({
								uuid: member.uuid,
								minecraftId: member.minecraftId,
							})),
						),
						...result.teamB.flatMap((party: PartyData) =>
							party.partyMembers.map((member) => ({
								uuid: member.uuid,
								minecraftId: member.minecraftId,
							})),
						),
					],
				},
			}),
		);

		// Notify the lobby server about the match
		clients
			.filter((c) => c.isLobby)
			.forEach((client) => {
				// Notify the lobby server about the match
				server.publish(
					client.clientId,
					JSON.stringify({
						status: status.success,
						action: Action.queue_match,
						payload: {
							queue: {
								queue_name: `${SizeToQueueName[result.queueSize]}`,
								parties: [
									result.teamA.map((party: PartyData) => ({
										partyId: party.partyId,
										partyLeaderUUID: party.partyLeaderUUID,
										partyMembers: party.partyMembers,
									})),
									result.teamB.map((party: PartyData) => ({
										partyId: party.partyId,
										partyLeaderUUID: party.partyLeaderUUID,
										partyMembers: party.partyMembers,
									})),
								],
							},
						},
					}),
				);
				// Notify the lobby server about the transfer
				server.publish(
					client.clientId,
					JSON.stringify({
						status: status.success,
						action: Action.transfer,
						payload: {
							transferData: {
								targetServer: gameServer.serverIP,
								targetPort: gameServer.serverPort,
								uuids: [
									...result.teamA.flatMap((party) =>
										party.partyMembers.map((member) => member.uuid),
									),
									...result.teamB.flatMap((party) =>
										party.partyMembers.map((member) => member.uuid),
									),
								],
							},
						},
					}),
				);
			});

		gameServer.status = ServerStatus.started;
		gameServer.game = {
			id: randomUUIDv7(),
			type: SizeToQueueName[result.queueSize] as QueueName,
			status: GameStatus.idle,
			players: [
				...result.teamA.flatMap((party) =>
					party.partyMembers.map((member) => ({
						uuid: member.uuid,
						minecraftId: member.minecraftId,
						score: member.score,
						isTeam1: true,
					})),
				),
				...result.teamB.flatMap((party) =>
					party.partyMembers.map((member) => ({
						uuid: member.uuid,
						minecraftId: member.minecraftId,
						score: member.score,
						isTeam1: false,
					})),
				),
			].map((player) =>
				Object.assign(player, {
					killCount: 0,
					deathCount: 0,
					assistCount: 0,
					isOnline: false,
				}),
			),
		};

		db.insert(gameTable)
			.values({
				id: gameServer.game?.id,
				status: gameServer.game.status,
				teamData: [
					{
						uuids: result.teamA.flatMap((party) =>
							party.partyMembers.map((member) => member.uuid),
						),
						team_score: 0,
					},
					{
						uuids: result.teamB.flatMap((party) =>
							party.partyMembers.map((member) => member.uuid),
						),
						team_score: 0,
					},
				],
				gameType: gameServer.game.type,
				startTime: new Date().getTime(),
			})
			.execute();
		logger.info('Game started', { gameId: gameServer?.game?.id });
	});

	// Add any remaining unprocessed matches back to waiting queue
	if (matchResults.length > 0) {
		logger.debug(
			`Adding ${matchResults.length} unprocessed matches back to waiting queue`,
		);
		matchedWaitingQueue.push(...matchResults);
	}

	logger.info('Matchmaking completed', JSON.stringify(clients, null, 2));
}, 5 * 1000);

process.on('SIGTERM', async () => await stop());

async function stop() {
	clearInterval(heartbeat);
	await Webhook.sendServerOffline();
	logger.info('Server shutting down...');
	server.stop();
	logger.info('Log saved to log.json');
	process.exit(0);
}

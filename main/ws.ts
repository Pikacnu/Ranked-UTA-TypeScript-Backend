import { randomUUIDv7 } from 'bun';
import {
	Action,
	Connection,
	ConnectionStatusStringToEnum,
	GameStatus,
	QueueNameToSize,
	ServerStatus,
	SizeToQueueName,
	status,
	WebSocketError,
	type DamageData,
	type KillData,
	type Message,
	type PartyData,
	type QueueName,
	type Server,
} from '../types';
import db, { gameTable, partyTable, playerTable } from '../src/db';
import { eq, is, or, sql } from 'drizzle-orm';
import { QueueManager, PartyMatchmaker, MatchResult } from './queue';
import { calculateAverageRating, getRoundByRankScore } from './rank';

/*
	Gate File Path "C:\Users\User\AppData\Local\Gate\bin"
	* Use Gate For Forward Minecraft Server
*/

const port = 8080;

// Console logging utilities
const logger = {
	info: (message: string, data?: any) => {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] [INFO] ${message}`, data || '');
	},
	warn: (message: string, data?: any) => {
		const timestamp = new Date().toISOString();
		console.warn(`[${timestamp}] [WARN] ${message}`, data || '');
	},
	error: (message: string, error?: any) => {
		const timestamp = new Date().toISOString();
		console.error(`[${timestamp}] [ERROR] ${message}`, error || '');
	},
	debug: (message: string, data?: any) => {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] [DEBUG] ${message}`, data || '');
	},
	ws: (action: string, sessionId: string, payload: any) => {
		const timestamp = new Date().toISOString();
		const shortId = sessionId?.split('-')[1] || 'unknown';
		console.log(
			`[${timestamp}] [WS] ${action.padEnd(
				20,
				' ',
			)} | ${shortId} | ${JSON.stringify(payload)}`,
		);
	},
};

const matchedWaitingQueue: MatchResult[] = [];
let clients: Server[] = [];

function newClient() {
	const clientId = randomUUIDv7();
	clients.push({
		clientId,
		lastHeartbeat: Date.now(),
		status: ServerStatus.pending,
	});
	const HandshakeCheck = (sessionId: string) => {
		const client = clients.find((c) => c.clientId === sessionId);
		if (client === undefined || client.isLobby === undefined) {
			logger.warn(`Client handshake timeout`, {
				sessionId,
				reason: 'Client not found or isLobby undefined',
			});
			clients = clients.filter((c) => c.clientId !== sessionId);
			return;
		}
	};
	setTimeout(HandshakeCheck.bind(null, clientId), 10 * 1000);
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
			const sessionId = newClient();
			ws.subscribe('heartbeat');
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
			let isHeartbeat = false;
			if (typeof message !== 'string') {
				logger.error('Received non-string message', { message });
				return;
			}
			try {
				const parsedMessage: Message = JSON.parse(message);
				const { action, sessionId, payload } = parsedMessage;
				const client = clients.find((c) => c.clientId === sessionId);
				switch (action) {
					case Action.handshake:
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
						break;
					case Action.heartbeat:
						isHeartbeat = true;
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
						break;
					case Action.request_data:
						if (sessionId) {
							const requestedClient = clients.find(
								(c) => c.clientId === sessionId,
							);
							if (requestedClient) {
								if (
									!payload?.request_target ||
									payload?.request_target === ''
								) {
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
								throw new WebSocketError(
									`Client with ID ${sessionId} not found.`,
								);
							}
						}
						break;
					case Action.get_player_data:
						const playerUuid = payload?.player?.uuid;
						const playerMinecraftId = payload?.player?.minecraftId;
						if (!playerUuid || playerUuid === '') {
							throw new WebSocketError('Player UUID is required');
						}
						const playerDataFromDB = (
							await db
								.select()
								.from(playerTable)
								.leftJoin(
									partyTable,
									or(
										eq(partyTable.holder, playerUuid),
										// Using SQLite JSON functions for array search
										sql`EXISTS (
											SELECT 1 FROM JSON_EACH(${partyTable.players}) 
											WHERE value = ${playerUuid}
										)`,
									),
								)
								.where(eq(playerTable.uuid, playerUuid))
								.execute()
						)[0];

						if (!playerDataFromDB) {
							const playerData = {
								uuid: playerUuid,
								minecraftId: playerMinecraftId,
								score: 0,
								isInParty: false,
								partyId: undefined,
								isInQueue: false,
							};
							ws.sendText(
								JSON.stringify({
									status: status.success,
									action: Action.get_player_data,
									payload: {
										player: playerData,
									},
								} as Message),
							);
							await db.insert(playerTable).values({
								uuid: playerUuid || '',
								minecraftId: playerMinecraftId || '',
								discordID: '',
								discordName: '',
								deathCount: 0,
								killCount: 0,
								gameCount: 0,
								rankScore: 0,
							});
							break;
						}

						if (
							playerDataFromDB.player.minecraftId === null &&
							playerDataFromDB.player.minecraftId !== playerMinecraftId
						) {
							await db
								.update(playerTable)
								.set({
									minecraftId: playerMinecraftId,
								})
								.where(eq(playerTable.uuid, playerUuid));
						}

						const playerData = {
							uuid: playerUuid,
							minecraftId: playerDataFromDB.player.minecraftId,
							score: playerDataFromDB.player.rankScore,
							isInParty: !!playerDataFromDB.party,
							partyId: playerDataFromDB.party
								? playerDataFromDB.party.id
								: undefined,
							isInQueue: !!false,
						};
						ws.sendText(
							JSON.stringify({
								status: status.success,
								action: Action.get_player_data,
								payload: {
									player: playerData,
								},
							} as Message),
						);
						break;
					case Action.update_player_data:
						const updatePlayerUuid = payload?.player?.uuid;
						if (!updatePlayerUuid || updatePlayerUuid === '') {
							throw new WebSocketError('Player UUID is required');
						}
						try {
							await db
								.update(playerTable)
								.set({
									minecraftId: payload?.player?.minecraftId || 'null',
									deathCount: payload?.player?.deathCount || 0,
									killCount: payload?.player?.killCount || 0,
									gameCount: payload?.player?.gameCount || 0,
								})
								.where(eq(playerTable.uuid, updatePlayerUuid));
						} catch (error) {
							logger.error('Error updating player data', error);
							throw new WebSocketError('Error updating player data');
						}
						break;
					case Action.party:
						if (!payload?.party) {
							throw new WebSocketError('Party data is required');
						}
						const { partyId, partyLeaderUUID, partyMembers } = payload.party;
						if (!partyId || !partyLeaderUUID || !partyMembers) {
							throw new WebSocketError(
								'Party ID, leader UUID, and members are required',
							);
						}
						try {
							const existingParty = await db
								.select()
								.from(partyTable)
								.where(eq(partyTable.id, partyId))
								.execute();

							if (existingParty.length > 0) {
								await db
									.update(partyTable)
									.set({
										holder: partyLeaderUUID,
										players: partyMembers,
									})
									.where(eq(partyTable.id, partyId));
							} else {
								await db.insert(partyTable).values({
									id: partyId,
									holder: partyLeaderUUID,
									players: partyMembers,
								});
							}
							ws.send(
								JSON.stringify({
									status: status.success,
									action: Action.party,
									payload: {
										message: 'Party updated successfully',
									},
								}),
							);
						} catch (error) {
							logger.error('Error handling party action', error);
							throw new WebSocketError('Error handling party action');
						}
						break;
					case Action.party_disbanded:
						if (!payload?.party || !payload.party.partyId) {
							throw new WebSocketError('Party ID is required to disband');
						}
						const disbandPartyId = payload.party.partyId;
						try {
							const existingParty = await db
								.select()
								.from(partyTable)
								.where(eq(partyTable.id, disbandPartyId))
								.execute();

							if (existingParty.length > 0) {
								await db
									.delete(partyTable)
									.where(eq(partyTable.id, disbandPartyId));
								ws.send(
									JSON.stringify({
										status: status.success,
										action: Action.party_disbanded,
										payload: {
											message: 'Party disbanded successfully',
										},
									}),
								);
							} else {
								throw new WebSocketError('Party not found');
							}
						} catch (error) {
							logger.error('Error disbanding party', error);
							throw new WebSocketError('Error disbanding party');
						}
						break;
					case Action.queue:
						if (!payload?.queue || !payload.queue.queue_name) {
							logger.warn('Queue join failed', {
								reason: 'Queue name is required',
							});
							throw new WebSocketError('Queue name is required');
						}

						if (!QueueNameToSize[payload.queue.queue_name]) {
							logger.warn('Queue join failed', {
								queueName: payload.queue.queue_name,
								reason: 'Queue not found',
							});
							throw new WebSocketError(
								`Queue ${payload.queue.queue_name} not found`,
							);
						}

						const parties = await db.select().from(partyTable).execute();
						const party = parties.find(
							(p) =>
								p.holder === payload.queue?.uuid ||
								p.players.some(
									(player: any) => player.uuid === payload.queue?.uuid,
								),
						);

						if (!party) {
							logger.warn('Queue join failed', {
								uuid: payload.queue.uuid,
								reason: 'Party not found',
							});
							throw new WebSocketError(
								`Party not found for UUID ${payload.queue.uuid}`,
							);
						}

						const partyData: PartyData = {
							partyId: party.id,
							partyLeaderUUID: party.holder,
							partyMembers: party.players,
							isInQueue: true,
						};

						// 使用新的隊列管理系統
						try {
							queueManager.enqueue(
								QueueNameToSize[payload.queue.queue_name] || 1,
								partyData,
							);
							logger.info('Party joined queue', {
								partyId: partyData.partyId,
								queueName: payload.queue.queue_name,
							});

							ws.send(
								JSON.stringify({
									status: status.success,
									action: Action.queue,
									payload: {
										message: `Successfully joined ${payload.queue.queue_name} queue`,
									},
								}),
							);
						} catch (error) {
							logger.error('Error adding party to queue', error);
							throw new WebSocketError(
								`Error joining queue: ${
									error instanceof Error ? error.message : 'Unknown error'
								}`,
							);
						}

						break;
					case Action.queue_leave:
						logger.debug('Queue leave request', payload);
						if (!payload?.queue) {
							logger.warn('Queue leave failed', {
								reason: 'Queue data is required for leaving queue',
							});
							throw new WebSocketError(
								'Queue data is required for leaving queue',
							);
						}

						if (!payload.queue.uuid) {
							throw new WebSocketError('Player UUID is required');
						}

						let partyToRemove: PartyData | undefined;
						let isRemoved = false;

						Object.values(QueueNameToSize).forEach((queueCount) => {
							if (isRemoved) return;
							const allPartiesInQueue = queueManager.getCandidates(
								queueCount || 1,
							);
							partyToRemove = allPartiesInQueue.find(
								(party) =>
									party.partyLeaderUUID === payload.queue?.uuid ||
									party.partyMembers.some(
										(member) => member.uuid === payload.queue?.uuid,
									),
							);
							if (partyToRemove) {
								queueManager.removeFromQueue(
									queueCount || 1,
									partyToRemove.partyId,
								);
								logger.info('Party left queue', {
									partyId: partyToRemove.partyId,
									queueName: SizeToQueueName[queueCount],
								});
								isRemoved = true;
							}
							return;
						});

						if (isRemoved) {
							ws.send(
								JSON.stringify({
									status: status.success,
									action: Action.queue_leave,
									payload: {
										message: `Successfully left ${payload.queue.queue_name} queue`,
									},
								}),
							);
						} else {
							throw new WebSocketError('Party not found in queue');
						}
						break;

					case Action.game_status:
						if (client?.isLobby) {
							throw new WebSocketError(
								'Cannot change game status in lobby mode',
							);
						}
						if (!payload || !payload.data) {
							throw new WebSocketError('Game status is required');
						}
						try {
							const statusData = payload.data as unknown as {
								status: GameStatus;
							};
							const gameStatus = statusData.status;
							if (client?.game?.id) {
								await db
									.update(gameTable)
									.set({
										status: gameStatus,
									})
									.where(eq(gameTable.id, client.game.id));
							} else {
								throw new WebSocketError('No game to update status');
							}
							// Update Player Data
							client.game.players.forEach((player) => {
								db.update(playerTable)
									.set({
										gameCount: sql`gameCount + 1`,
										killCount: sql`killCount + ${player.killCount}`,
										deathCount: sql`deathCount + ${player.deathCount}`,
										assistCount: sql`assistCount + ${player.assistCount}`,
									})
									.where(eq(playerTable.uuid, player.uuid))
									.execute();
							});
							if (gameStatus === GameStatus.idle) {
								if (client?.game) {
									ws.send(
										JSON.stringify({
											status: status.success,
											action: Action.transfer,
											payload: {
												transferData: {
													targetServer: 'ruta.pikacnu.com',
													targetPort: 25565,
													uuids: client.game.players.map((p) => p.uuid),
												},
											},
										}),
									);
									client.game = undefined;
									client.status = ServerStatus.pending;
									ws.send(
										JSON.stringify({
											status: status.success,
											action: Action.whitelist_change,
											payload: {
												whilelist: [],
											},
										}),
									);
								} else {
									throw new WebSocketError('No game to set to idle');
								}
							}
						} catch (error) {
							logger.error('Invalid game status', error);
							throw new WebSocketError('Invalid game status');
						}
						break;

					case Action.map_choose:
						if (client?.game?.id) {
							if (!payload || !payload.data || !(payload.data as any).map) {
								throw new WebSocketError('Map ID is required');
							}
							const mapId = (payload.data as any).map as number;

							if (typeof mapId !== 'number' || mapId <= 0) {
								throw new WebSocketError('Invalid map ID');
							}
							await db
								.update(gameTable)
								.set({
									mapId: mapId,
								})
								.where(eq(gameTable.id, client.game.id));
						} else {
							throw new WebSocketError('No game to choose map for');
						}
						break;

					case Action.kill:
						if (!payload || !payload.data) {
							throw new WebSocketError('Kill data is required');
						}
						const killData = payload.data as KillData;
						if (!killData.target || !killData.attacker || !killData.type) {
							throw new WebSocketError('Invalid kill data');
						}

						if (!client?.game?.id) {
							throw new WebSocketError('No game to log kill event');
						}

						// Update player stats
						const targetPlayer = client.game.players.find(
							(player) => player.uuid === killData.target,
						);
						const attackerPlayer = client.game.players.find(
							(player) => player.uuid === killData.attacker,
						);
						const assistPlayer = client.game.players.find((player) =>
							killData.assists?.includes(player.uuid),
						);
						if (targetPlayer) {
							targetPlayer.deathCount += 1;
						}
						if (attackerPlayer) {
							attackerPlayer.killCount += 1;
						}
						if (assistPlayer) {
							assistPlayer.assistCount += 1;
						}
						// Log the kill event
						await db
							.update(gameTable)
							.set({
								eventData: sql`JSON_ARRAY_APPEND(COALESCE(eventData, JSON_ARRAY()), '$', ${JSON.stringify(
									killData,
								)})`,
							})
							.where(eq(gameTable.id, client?.game?.id || ''));

						break;

					case Action.damage:
						if (!payload || !payload.data || !payload.data) {
							throw new WebSocketError('Damage data is required');
						}
						const damageData = payload.data as DamageData;
						if (
							!damageData.target ||
							!damageData.attacker ||
							typeof damageData.damage !== 'number'
						) {
							throw new WebSocketError('Invalid damage data');
						}

						await db
							.update(gameTable)
							.set({
								eventData: sql`JSON_ARRAY_APPEND(COALESCE(eventData, JSON_ARRAY()), '$', ${JSON.stringify(
									damageData,
								)})`,
							})
							.where(eq(gameTable.id, client?.game?.id || ''));

						break;

					case Action.player_online_status:
						if (!payload || !payload.playerOnlineStatus) {
							throw new WebSocketError('Player online status is required');
						}
						if (!client || !client.game) {
							throw new WebSocketError('Client or game not found');
						}
						logger.info('Updating player online status', {
							sessionId,
						});
						let { uuids, connection } = payload.playerOnlineStatus;
						connection = ConnectionStatusStringToEnum(connection);
						if (!Array.isArray(uuids)) {
							throw new WebSocketError('Player UUIDs are required');
						}
						client.game.players.forEach((player) => {
							if (uuids.includes(player.uuid)) {
								player.isOnline = connection === Connection.CONNECTED;
							}
						});

						if (
							client.game.players.every((player) => player.isOnline) &&
							client.game.status === GameStatus.idle
						) {
							client.game.status = GameStatus.start;
							ws.send(
								JSON.stringify({
									status: status.success,
									action: Action.team_join,
									payload: {
										teamData: [
											{
												uuids: client.game.players
													.filter((p) => p.isTeam1)
													.flatMap((p) => p.uuid),
												team: 1,
											},
											{
												uuids: client.game.players
													.filter((p) => !p.isTeam1)
													.flatMap((p) => p.uuid),
												team: 2,
											},
										],
									},
								}),
							);
							ws.send(
								JSON.stringify({
									status: status.success,
									action: Action.command,
									payload: {
										command: `function ranked:start_game {gameMode:${
											QueueNameToSize[client.game.type] < 3 ? 4 : 7
										},gameRound:${
											QueueNameToSize[client.game.type] > 3
												? 1
												: getRoundByRankScore(
														calculateAverageRating(
															client.game.players.map((p) => p.score),
														) || 0,
												  )
										},banRuleType:1,enableSameChar:1,enableNewSkill:0}`,
										// Placeholder for actual command to Start Game
									},
								}),
							);
							logger.info('Game started - all players online', {
								gameId: client.clientId,
							});
							client.game.status = GameStatus.during;
						}

						break;
					default:
						logger.warn('Unknown action received', { action });
				}
				if (!isHeartbeat)
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
		if (Date.now() - (client.lastHeartbeat || 0) > 30 * 1000) {
			logger.warn('Client timed out', { clientId: client.clientId });
			server.publish(
				client.clientId,
				JSON.stringify({
					status: status.success,
					action: Action.disconnect,
				}),
			);
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
}, 10000);

// Matchmaking loop
setInterval(() => {
	const matchResults: MatchResult[] = matchmaker.matchAllQueues();
	if (matchResults.length === 0) {
		//logger.debug('No matches found in any queues');
		return;
	}

	const pendingServers: Server[] = clients.filter(
		(client) => client.status === ServerStatus.pending && !client.isLobby,
	);

	if (pendingServers.length === 0) {
		logger.warn('No pending servers available for matchmaking');
		matchedWaitingQueue.push(...matchResults);
		return;
	}

	pendingServers.forEach((gameServer) => {
		const result =
			matchResults[Math.floor(Math.random() * matchResults.length)];

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

		// Notify the server about the match
		clients
			.filter((c) => c.isLobby)
			.forEach((client) =>
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
				),
			);

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

		db.insert(gameTable).values({
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
		});
		logger.info('Game started', { gameId: gameServer?.game?.id });
	});
	logger.info('Matchmaking completed', JSON.stringify(clients, null, 2));
}, 20 * 1000);

process.on('SIGINT', () => {
	clearInterval(heartbeat);
	logger.info('Server shutting down...');
	server.stop();
	logger.info('Log saved to log.json');
	process.exit(0);
});

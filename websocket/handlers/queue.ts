import db, { partyTable } from '../../src/db';
import {
	Action,
	QueueNameToSize,
	status,
	WebSocketError,
	type PartyData,
} from '../types';
import type { Handler } from './types';

// 安全的數據庫查詢函數，處理可能損壞的 JSON 數據
async function safeSelectParties() {
	try {
		// 首先嘗試使用 Drizzle
		return await db.select().from(partyTable).execute();
	} catch (error) {
		// 如果失敗，使用原生 SQL 查詢並手動處理 JSON
		console.warn('Drizzle query failed, falling back to raw SQL:', error);

		const database = (db as any).$client;
		const rawParties = database
			.prepare('SELECT id, holder, players, is_in_queue FROM party')
			.all();

		return rawParties
			.map((party: any) => {
				try {
					const players = JSON.parse(party.players);
					return {
						id: party.id,
						holder: party.holder,
						players: Array.isArray(players) ? players : [],
						isInQueue: party.is_in_queue,
					};
				} catch (jsonError) {
					console.warn(
						`Skipping party ${party.id} due to invalid JSON:`,
						jsonError,
					);
					return null;
				}
			})
			.filter(Boolean); // 過濾掉 null 值
	}
}

export const action = Action.queue;

export const handler: Handler = async ({
	ws,
	message,
	logger,
	queueManager,
}) => {
	const { payload } = message;

	if (!payload?.queue || !payload.queue.queue_name) {
		throw new WebSocketError('Queue name is required');
	}

	if (!QueueNameToSize[payload.queue.queue_name]) {
		throw new WebSocketError(`Queue ${payload.queue.queue_name} not found`);
	}

	try {
		const parties = await safeSelectParties();

		// 更安全的 party 查找邏輯，只處理有效數據
		const party = parties.find((p: any) => {
			if (!p) return false; // 跳過 null 值

			try {
				const players = p.players; // 已經在 safeSelectParties 中驗證過
				return (
					p.holder === payload.queue?.uuid ||
					players.some(
						(player: any) => player && player.uuid === payload.queue?.uuid,
					)
				);
			} catch (error) {
				logger.error('Error checking party members', {
					partyId: p.id,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
				return false;
			}
		});

		if (!party) {
			logger.warn('Queue join failed', {
				uuid: payload.queue.uuid,
				reason: 'Party not found',
				totalParties: parties.length,
				availableParties: parties
					.map((p: any) => (p ? { id: p.id, holder: p.holder } : null))
					.filter(Boolean),
			});
			throw new WebSocketError(
				`Party not found for UUID ${payload.queue.uuid}`,
			);
		}

		// 確保 players 數據格式正確
		const players = party.players; // 已經驗證過是數組
		const partyData: PartyData = {
			partyId: party.id,
			partyLeaderUUID: party.holder,
			partyMembers: players,
			isInQueue: true,
		};
		queueManager.enqueue(
			QueueNameToSize[payload.queue.queue_name] || 1,
			partyData,
		);

		logger.info('Party joined queue', {
			partyId: partyData.partyId,
			queueName: payload.queue.queue_name,
			players: partyData.partyMembers.map((p) => p.uuid),
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
};

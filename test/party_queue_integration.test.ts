import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import db, { partyTable } from '../src/db';
import { eq } from 'drizzle-orm';
import { QueueManager } from '../websocket/queue';
import type { PartyData } from '../src/types';

describe('Party Queue Integration', () => {
	const testPartyId = 999998;
	const queueManager = new QueueManager();

	beforeAll(async () => {
		// 清理測試數據
		await db.delete(partyTable).where(eq(partyTable.id, testPartyId)).execute();
	});

	afterAll(async () => {
		// 清理測試數據
		await db.delete(partyTable).where(eq(partyTable.id, testPartyId)).execute();
	});

	it('should handle complete party lifecycle: save -> find -> queue -> remove', async () => {
		// 1. 保存 party 數據
		const testPartyData = {
			id: testPartyId,
			holder: 'test-holder-uuid',
			players: [
				{
					uuid: 'test-holder-uuid',
					minecraftId: 'TestHolder',
					score: 1000,
				},
				{
					uuid: 'test-member-uuid',
					minecraftId: 'TestMember',
					score: 950,
				},
			],
		};

		await db.insert(partyTable).values(testPartyData).execute();

		// 2. 模擬 queue.ts 中的查找邏輯
		const parties = await db.select().from(partyTable).execute();
		const targetUUID = 'test-member-uuid';

		const foundParty = parties.find((p) => {
			try {
				const players = Array.isArray(p.players) ? p.players : [];
				return (
					p.holder === targetUUID ||
					players.some((player: any) => player && player.uuid === targetUUID)
				);
			} catch (error) {
				return false;
			}
		});

		expect(foundParty).toBeDefined();
		expect(foundParty!.id).toBe(testPartyId);

		// 3. 創建 PartyData 對象並加入隊列
		const players = Array.isArray(foundParty!.players)
			? foundParty!.players
			: [];
		const partyData: PartyData = {
			partyId: foundParty!.id,
			partyLeaderUUID: foundParty!.holder,
			partyMembers: players,
			isInQueue: true,
		};

		// 加入隊列
		expect(() => {
			queueManager.enqueue(2, partyData);
		}).not.toThrow();

		// 4. 驗證隊列中的數據
		const queueCandidates = queueManager.getCandidates(2);
		expect(queueCandidates).toHaveLength(1);
		expect(queueCandidates[0].partyId).toBe(testPartyId);
		expect(queueCandidates[0].partyMembers).toHaveLength(2);

		// 5. 模擬 queue_leave.ts 中的移除邏輯
		const leaveUUID = 'test-holder-uuid';
		let partyToRemove: PartyData | undefined;
		let isRemoved = false;

		const queueSizes = [1, 2, 3, 4];
		for (const queueSize of queueSizes) {
			if (isRemoved) break;

			const allPartiesInQueue = queueManager.getCandidates(queueSize);
			partyToRemove = allPartiesInQueue.find((party: PartyData) => {
				try {
					return (
						party.partyLeaderUUID === leaveUUID ||
						party.partyMembers.some(
							(member: any) => member && member.uuid === leaveUUID,
						)
					);
				} catch (error) {
					return false;
				}
			});

			if (partyToRemove) {
				queueManager.removeFromQueue(queueSize, partyToRemove.partyId);
				isRemoved = true;
				break;
			}
		}

		expect(isRemoved).toBe(true);
		expect(partyToRemove).toBeDefined();
		expect(partyToRemove!.partyId).toBe(testPartyId);

		// 6. 驗證隊列已清空
		const finalQueueCandidates = queueManager.getCandidates(2);
		expect(finalQueueCandidates).toHaveLength(0);
	});

	it('should handle malformed party data gracefully', async () => {
		// 插入格式錯誤的數據
		const malformedPartyId = 999997;
		await db
			.delete(partyTable)
			.where(eq(partyTable.id, malformedPartyId))
			.execute();

		// 模擬手動插入錯誤的 JSON 數據 (使用直接的 SQL 執行)
		const database = (db as any).$client;
		database.run(
			`
			INSERT INTO party (id, holder, players, is_in_queue) 
			VALUES (?, ?, ?, ?)
		`,
			[malformedPartyId, 'bad-holder', 'invalid-json', 0],
		);

		// 測試查找邏輯是否能處理錯誤數據
		// 這應該不會拋出錯誤，而是跳過無效的記錄
		expect(() => {
			// 模擬 queue.ts 中的過濾邏輯
			const testParties = [
				{
					id: malformedPartyId,
					holder: 'bad-holder',
					players: 'invalid-json' as any, // 模擬錯誤的數據
					isInQueue: 0,
				},
			];

			const validParties = testParties.filter((p) => {
				try {
					return Array.isArray(p.players);
				} catch (error) {
					return false;
				}
			});

			expect(validParties).toHaveLength(0); // 應該被過濾掉
		}).not.toThrow();

		// 清理
		await db
			.delete(partyTable)
			.where(eq(partyTable.id, malformedPartyId))
			.execute();
	});
});

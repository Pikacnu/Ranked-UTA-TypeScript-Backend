import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import db, { partyTable } from '../src/db';
import { eq } from 'drizzle-orm';

describe('Party Data Handling', () => {
	beforeAll(async () => {
		// 清理測試數據
		await db.delete(partyTable).where(eq(partyTable.id, 999999)).execute();
	});

	afterAll(async () => {
		// 清理測試數據
		await db.delete(partyTable).where(eq(partyTable.id, 999999)).execute();
	});

	it('should save and retrieve party data correctly', async () => {
		const testPartyData = {
			id: 999999,
			holder: 'test-uuid-123',
			players: [
				{
					uuid: 'player-uuid-1',
					minecraftId: 'TestPlayer1',
					score: 1000,
				},
				{
					uuid: 'player-uuid-2',
					minecraftId: 'TestPlayer2',
					score: 950,
				},
			],
		};

		// 插入測試數據
		await db.insert(partyTable).values(testPartyData).execute();

		// 檢索數據
		const retrievedParty = await db
			.select()
			.from(partyTable)
			.where(eq(partyTable.id, 999999))
			.execute();

		expect(retrievedParty).toHaveLength(1);
		expect(retrievedParty[0].id).toBe(999999);
		expect(retrievedParty[0].holder).toBe('test-uuid-123');
		expect(Array.isArray(retrievedParty[0].players)).toBe(true);
		expect(retrievedParty[0].players).toHaveLength(2);

		const players = retrievedParty[0].players;
		expect(players[0].uuid).toBe('player-uuid-1');
		expect(players[0].minecraftId).toBe('TestPlayer1');
		expect(players[0].score).toBe(1000);
	});

	it('should handle party member search correctly', async () => {
		const parties = await db.select().from(partyTable).execute();

		// 測試查找邏輯
		const targetUUID = 'player-uuid-1';
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
		expect(foundParty?.id).toBe(999999);
	});
});

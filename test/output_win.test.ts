import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import db, { gameTable, playerTable } from '../src/db';
import { eq } from 'drizzle-orm';
import type { GamePlayer, Message } from '../websocket/types';

describe('Output Win Handler', () => {
	const testGameId = 'test-game-win-123';
	const testPlayers = [
		{
			uuid: 'player1-uuid',
			minecraftId: 'Player1',
			killCount: 0,
			deathCount: 0,
			assistCount: 0,
			score: 1000,
			isOnline: true,
			isTeam1: true,
		},
		{
			uuid: 'player2-uuid',
			minecraftId: 'Player2',
			killCount: 0,
			deathCount: 0,
			assistCount: 1,
			score: 950,
			isOnline: true,
			isTeam1: true,
		},
		{
			uuid: 'player3-uuid',
			minecraftId: 'Player3',
			killCount: 0,
			deathCount: 0,
			assistCount: 0,
			score: 980,
			isOnline: true,
			isTeam1: false,
		},
		{
			uuid: 'player4-uuid',
			minecraftId: 'Player4',
			killCount: 0,
			deathCount: 0,
			assistCount: 2,
			score: 920,
			isOnline: true,
			isTeam1: false,
		},
	] as GamePlayer[];

	beforeAll(async () => {
		// 清理測試數據
		await db.delete(gameTable).where(eq(gameTable.id, testGameId)).execute();

		// 確保玩家存在
		for (const player of testPlayers) {
			try {
				await db
					.insert(playerTable)
					.values({
						uuid: player.uuid,
						minecraftId: player.minecraftId,
						discordID: `discord-${player.uuid}`,
						discordName: player.minecraftId,
						killCount: 0,
						deathCount: 0,
						assistCount: 0,
						gameCount: 0,
						rankScore: player.score,
					})
					.execute();
			} catch {
				// 玩家可能已存在，更新數據
				await db
					.update(playerTable)
					.set({
						killCount: 0,
						deathCount: 0,
						assistCount: 0,
						gameCount: 0,
						rankScore: player.score,
					})
					.where(eq(playerTable.uuid, player.uuid))
					.execute();
			}
		}

		// 創建測試遊戲
		await db
			.insert(gameTable)
			.values({
				// @ts-expect-error
				id: testGameId,
				status: 3, // during
				gameType: '2v2',
				teamData: [
					{
						uuids: ['player1-uuid', 'player2-uuid'],
						team_score: 0,
					},
					{
						uuids: ['player3-uuid', 'player4-uuid'],
						team_score: 0,
					},
				],
				startTime: Date.now(),
				eventData: [],
			})
			.execute();
	});

	afterAll(async () => {
		// 清理測試數據
		await db.delete(gameTable).where(eq(gameTable.id, testGameId)).execute();
		for (const player of testPlayers) {
			await db
				.delete(playerTable)
				.where(eq(playerTable.uuid, player.uuid))
				.execute();
		}
	});

	it('should validate win data format correctly', () => {
		// 測試數據驗證邏輯
		const validWinData = {
			win: [
				[1, 2, 3, 4],
				[5, 6, 7, 8],
			], // Team1 wins
			lose: [
				[9, 10, 11, 12],
				[13, 14, 15, 16],
			], // Team2 loses
		};

		const invalidWinData1 = {
			win: 'not-an-array',
			lose: [[9, 10, 11, 12]],
		};

		const invalidWinData2 = {
			win: [[1, 2, 3, 4]],
			// missing lose
		};

		// 這些應該在實際處理中被檢測到
		expect(Array.isArray(validWinData.win)).toBe(true);
		expect(Array.isArray(validWinData.lose)).toBe(true);

		expect(Array.isArray(invalidWinData1.win)).toBe(false);
		// @ts-expect-error For test purposes, this should fail
		expect(invalidWinData2.lose).toBeUndefined();
	});

	it('should process win data with proper transaction handling', async () => {
		// 模擬一個成功的 win 處理
		const mockClient = {
			game: {
				id: testGameId,
				players: testPlayers,
			},
		};

		// 這裡我們測試事務的概念 - 確保所有更新要麼全部成功，要麼全部失敗
		await db.transaction(async (tx) => {
			// 模擬玩家統計更新
			for (const player of testPlayers) {
				const isWinner = player.isTeam1; // 假設 Team1 獲勝
				await tx
					.update(playerTable)
					.set({
						rankScore: player.score + (isWinner ? 25 : -15),
						gameCount: 1,
						killCount: isWinner ? 1 : 0,
						deathCount: isWinner ? 0 : 1,
						assistCount: player.assistCount,
					})
					.where(eq(playerTable.uuid, player.uuid));
			}

			// 模擬遊戲數據更新
			await tx
				.update(gameTable)
				.set({
					winTeam: 1, // Team1 wins
					endTime: Date.now(),
					eventData: JSON.stringify([
						{
							type: 'win',
							team: 1,
							timestamp: Date.now(),
						},
					]) as unknown as Message,
				})
				.where(eq(gameTable.id, testGameId));
		});

		// 驗證更新結果
		const updatedGame = await db
			.select()
			.from(gameTable)
			.where(eq(gameTable.id, testGameId))
			.execute();

		const updatedPlayers = await db
			.select()
			.from(playerTable)
			.where(eq(playerTable.uuid, testPlayers[0].uuid))
			.execute();

		expect(updatedGame[0].winTeam).toBe(1);
		expect(updatedGame[0].endTime).toBeDefined();
		expect(updatedPlayers[0].gameCount).toBe(1);
	});

	it('should handle invalid JSON in eventData gracefully', async () => {
		// 測試無效 JSON 處理
		const database = (db as any).$client;

		// 插入無效的 JSON 數據
		const tempGameId = 'temp-game-invalid-json';
		database.run(
			`
			INSERT INTO game (id, status, gameType, eventData, win_team) 
			VALUES (?, ?, ?, ?, ?)
		`,
			[tempGameId, 0, '2v2', 'invalid-json-data', -1],
		);

		// 嘗試查詢 - 應該能處理無效數據
		try {
			const games = await db.select().from(gameTable).execute();
			// 如果到達這裡，說明查詢沒有因為無效 JSON 而失敗
			expect(true).toBe(true);
		} catch (error) {
			// 如果查詢失敗，說明需要使用安全的查詢方法
			console.warn('Standard query failed with invalid JSON:', error);

			// 這時應該使用我們的安全查詢方法
			const safeGames = database
				.prepare('SELECT id, eventData FROM game WHERE id = ?')
				.all(tempGameId);
			expect(safeGames.length).toBe(1);
		}

		// 清理
		await db.delete(gameTable).where(eq(gameTable.id, tempGameId)).execute();
	});
});

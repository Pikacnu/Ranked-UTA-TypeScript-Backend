import { describe, it, expect } from 'bun:test';
import db, { gameTable, playerTable } from '../src/db';
import { eq } from 'drizzle-orm';

describe('事務行為深度分析', () => {
	it('測試 Drizzle 事務的實際行為', async () => {
		const testId = 'tx-behavior-test';

		// 清理
		await db.delete(playerTable).where(eq(playerTable.uuid, testId)).execute();

		// 創建測試數據
		await db
			.insert(playerTable)
			.values({
				uuid: testId,
				minecraftId: 'TxTest',
				discordID: 'discord-tx-test',
				discordName: 'TxTest',
				killCount: 0,
				deathCount: 0,
				assistCount: 0,
				gameCount: 0,
				rankScore: 1000,
			})
			.execute();

		console.log('=== 測試 1: 事務中途拋出錯誤 ===');

		const initial = await db
			.select()
			.from(playerTable)
			.where(eq(playerTable.uuid, testId))
			.execute();
		console.log('初始數據:', {
			rankScore: initial[0].rankScore,
			gameCount: initial[0].gameCount,
		});

		try {
			await db.transaction(async (tx) => {
				console.log('開始事務...');

				// 第一次更新
				await tx
					.update(playerTable)
					.set({ rankScore: 1100, gameCount: 1 })
					.where(eq(playerTable.uuid, testId));
				console.log('第一次更新完成');

				// 檢查中間狀態（在事務內）
				const middle = await tx
					.select()
					.from(playerTable)
					.where(eq(playerTable.uuid, testId))
					.execute();
				console.log('事務內中間狀態:', {
					rankScore: middle[0].rankScore,
					gameCount: middle[0].gameCount,
				});

				// 第二次更新
				await tx
					.update(playerTable)
					.set({ killCount: 5 })
					.where(eq(playerTable.uuid, testId));
				console.log('第二次更新完成');

				// 手動拋出錯誤
				throw new Error('手動錯誤，應該觸發回滾');
			});
		} catch (error) {
			console.log('捕獲錯誤:', (error as Error).message);
		}

		// 檢查最終狀態
		const final = await db
			.select()
			.from(playerTable)
			.where(eq(playerTable.uuid, testId))
			.execute();
		console.log('最終數據:', {
			rankScore: final[0].rankScore,
			gameCount: final[0].gameCount,
			killCount: final[0].killCount,
		});

		console.log('\n=== 測試 2: 數據庫約束違反 ===');

		try {
			await db.transaction(async (tx) => {
				// 嘗試插入重複的主鍵
				await tx.insert(playerTable).values({
					uuid: testId, // 重複的 UUID，應該違反主鍵約束
					minecraftId: 'Duplicate',
					discordID: 'duplicate',
					discordName: 'Duplicate',
					killCount: 0,
					deathCount: 0,
					assistCount: 0,
					gameCount: 0,
					rankScore: 2000,
				});
			});
		} catch (error) {
			console.log('數據庫約束錯誤:', (error as Error).message);
		}

		// 檢查是否有變化
		const afterConstraintError = await db
			.select()
			.from(playerTable)
			.where(eq(playerTable.uuid, testId))
			.execute();
		console.log('約束錯誤後數據:', {
			rankScore: afterConstraintError[0].rankScore,
			gameCount: afterConstraintError[0].gameCount,
		});

		console.log('\n=== 測試 3: 手動回滾 ===');

		// 測試手動回滾
		try {
			await db.transaction(async (tx) => {
				await tx
					.update(playerTable)
					.set({ rankScore: 9999 })
					.where(eq(playerTable.uuid, testId));

				// 手動回滾（如果支持的話）
				throw new Error('ROLLBACK');
			});
		} catch (error) {
			console.log('手動回滾錯誤:', (error as Error).message);
		}

		const afterRollback = await db
			.select()
			.from(playerTable)
			.where(eq(playerTable.uuid, testId))
			.execute();
		console.log('手動回滾後數據:', { rankScore: afterRollback[0].rankScore });

		// 清理
		await db.delete(playerTable).where(eq(playerTable.uuid, testId)).execute();
	});

	it('測試原生 SQL 事務行為', async () => {
		console.log('\n=== 原生 SQL 事務測試 ===');

		const testId = 'native-tx-test';
		const database = (db as any).$client;

		// 準備測試數據
		database.run(
			`
			INSERT OR REPLACE INTO player (uuid, minecraftId, discordID, discordName, killCount, deathCount, assistCount, gameCount, rankScore)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			[testId, 'NativeTest', 'discord-native', 'NativeTest', 0, 0, 0, 0, 1000],
		);

		const initial = database
			.prepare('SELECT rankScore, gameCount FROM player WHERE uuid = ?')
			.get(testId);
		console.log('原生 SQL 初始數據:', initial);

		// 測試原生事務
		try {
			database.run('BEGIN TRANSACTION');
			console.log('開始原生事務');

			database.run(
				'UPDATE player SET rankScore = ?, gameCount = ? WHERE uuid = ?',
				[1500, 5, testId],
			);
			console.log('原生更新完成');

			const middle = database
				.prepare('SELECT rankScore, gameCount FROM player WHERE uuid = ?')
				.get(testId);
			console.log('原生事務內中間狀態:', middle);

			// 手動回滾
			database.run('ROLLBACK');
			console.log('手動回滾完成');
		} catch (error) {
			console.log('原生事務錯誤:', error);
			try {
				database.run('ROLLBACK');
			} catch (rollbackError) {
				console.log('回滾失敗:', rollbackError);
			}
		}

		const final = database
			.prepare('SELECT rankScore, gameCount FROM player WHERE uuid = ?')
			.get(testId);
		console.log('原生事務後最終數據:', final);

		// 清理
		database.run('DELETE FROM player WHERE uuid = ?', [testId]);
	});
});

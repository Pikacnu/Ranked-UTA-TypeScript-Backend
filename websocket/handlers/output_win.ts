import { eq, sql } from 'drizzle-orm';
import db, { gameTable, playerTable } from '../../src/db';
import {
	Action,
	WebSocketError,
	UUIDFromArray,
	UUIDStringToArray,
	MinecraftNbtProcessToJson,
} from '../types';
import {
	calculateAverageRating,
	calculateExpectedScore,
	calculateNewRating,
	calculateTwoTeamAfterGameRating,
	getK,
} from '../rank';
import type { Handler } from './types';

export const action = Action.output_win;

export const handler: Handler = async ({ message, client, logger }) => {
	const { payload } = message;

	if (!payload || !payload.data) {
		throw new WebSocketError('Win data is required');
	}

	// 驗證 client 和 game 的完整性
	if (!client?.game?.id) {
		throw new WebSocketError('No game to process win data');
	}
	if (!client.game.players || client.game.players.length === 0) {
		throw new WebSocketError('No players in game to update stats');
	}

	try {
		console.log(MinecraftNbtProcessToJson(payload.data.data[0]));
		const winData = JSON.parse(MinecraftNbtProcessToJson(payload.data.data[0]));
		const { win, lose } = winData;

		// 驗證 winData 格式
		if (!win || !lose) {
			throw new WebSocketError('Win and Lose data are required');
		}
		if (!Array.isArray(win) || !Array.isArray(lose)) {
			throw new WebSocketError('Win and Lose data must be arrays');
		}

		const winPlayers = win.map((uuid: number[]) => UUIDFromArray(uuid));

		const Team1 = client.game.players.filter((p) => p.isTeam1);
		const Team2 = client.game.players.filter((p) => !p.isTeam1);

		if (Team1.length === 0 || Team2.length === 0) {
			throw new WebSocketError('Invalid team configuration');
		}

		let isTeam1Win;
		if (Team1.every((p) => winPlayers.some((wp: string) => wp === p.uuid))) {
			isTeam1Win = true;
		} else if (
			Team2.every((p) => winPlayers.some((wp: string) => wp === p.uuid))
		) {
			isTeam1Win = false;
		} else {
			throw new WebSocketError('Win data does not match game players');
		}

		// Update player stats
		const team1Rating = calculateAverageRating(
			Team1.map((player) => player.score),
		);
		const team2Rating = calculateAverageRating(
			Team2.map((player) => player.score),
		);

		const team1ExpectedScore = calculateExpectedScore(team1Rating, team2Rating);
		const team2ExpectedScore = calculateExpectedScore(team2Rating, team1Rating);

		const team1ActualScore = isTeam1Win ? 1 : 0;
		const team2ActualScore = isTeam1Win ? 0 : 1;
		const team1K = getK(team1Rating);
		const team2K = getK(team2Rating);

		// 在單一事務中更新所有數據
		await db.transaction(async (tx) => {
			// 更新玩家統計
			for (const player of client.game!.players!) {
				const isWinner = isTeam1Win ? player.isTeam1 : !player.isTeam1;
				const newRankScore = calculateNewRating(
					player.score,
					player.isTeam1 ? team1ExpectedScore : team2ExpectedScore,
					player.isTeam1 ? team1ActualScore : team2ActualScore,
					player.isTeam1 ? team1K : team2K,
				);
				await tx
					.update(playerTable)
					.set({
						rankScore: newRankScore < 0 ? 0 : newRankScore,
						gameCount: sql`gameCount + 1`,
						killCount: sql`killCount + ${isWinner ? 1 : 0}`,
						deathCount: sql`deathCount + ${isWinner ? 0 : 1}`,
						assistCount: sql`assistCount + ${
							isWinner ? player.assistCount : 0
						}`,
					})
					.where(eq(playerTable.uuid, player.uuid));
			}

			// 更新游戲數據
			await tx
				.update(gameTable)
				.set({
					winTeam: isTeam1Win ? 1 : 2,
					endTime: Date.now(),
					eventData: sql`json_insert(COALESCE(eventData, json_array()), '$[#]', ${JSON.stringify(
						winData,
					)})`,
				})
				.where(eq(gameTable.id, client.game!.id));
		});

		logger.info('Successfully processed win data', {
			gameId: client.game.id,
			isTeam1Win,
			playersUpdated: client.game.players.length,
		});
	} catch (error) {
		logger.error('Error processing win data', {
			gameId: client?.game?.id,
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined,
		});
		throw new WebSocketError('Error processing win data');
	}
};

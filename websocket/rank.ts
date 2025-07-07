import type { GamePlayer } from './types';
import db, { playerTable } from '../src/db';
import { sql } from 'drizzle-orm';

export const calculateAverageRatingFromDB = async (
	uuids: string[],
): Promise<number> => {
	const query = db
		.select({
			score: playerTable.rankScore,
		})
		.from(playerTable)
		.where(sql`${playerTable.uuid} IN (${uuids.join(',')})}`);
	const players = await query.execute();
	if (players.length === 0) throw new Error('No players found');
	if (
		players.some(
			(player) => player.score === null || player.score === undefined,
		)
	) {
		throw new Error('Some players do not have a score');
	}
	const totalScore = players.reduce(
		(sum, player) => sum + (player?.score || 0),
		0,
	);
	return totalScore / players.length;
};

export const calculateAverageRating = (scores: number[]): number => {
	if (scores.length === 0) return 0;
	const totalScore = scores.reduce((sum, score) => sum + score, 0);
	return totalScore / scores.length;
};
/*
export const getK = (score: number): number => {
	switch (true) {
		case score <= 1400:
			return 32;
		case score <= 1800:
			return 24;
		case score <= 2200:
			return 16;
		default:
			return 8;
	}
};*/

export const getK1 = (score: number): number => {
	switch (true) {
		case score <= 1400:
			return 8;
		case score <= 1800:
			return 6;
		case score <= 2200:
			return 4;
		default:
			return 4;
	}
};

export const getK2 = (mode: number): number => {
	switch (mode) {
		case 1: // Solo
			return 2;
		case 2: // Duo
			return 4;
		case 3: // Squad
			return 6;
		case 4: // Party
			return 8;
		default:
			return 4; // Default K factor for unknown modes
	}
};

export const calculateExpectedScore = (rate1: number, rate2: number): number =>
	1 / (1 + Math.pow(10, (rate2 - rate1) / 400));

export const calculateNewRating = (
	currentRating: number,
	expectedScore: number,
	actualScore: number,
	kFactor: number = 32, // Default K factor
): number =>
	Math.floor(currentRating + kFactor * (actualScore - expectedScore));

export const calculateTwoTeamAfterGameRating = (
	team1: GamePlayer[],
	team2: GamePlayer[],
	isTeam1Win: boolean,
): {
	team1: GamePlayer[];
	team2: GamePlayer[];
} => {
	const team1Rating = calculateAverageRating(
		team1.map((player) => player.score),
	);
	const team2Rating = calculateAverageRating(
		team2.map((player) => player.score),
	);

	const team1ExpectedScore = calculateExpectedScore(team1Rating, team2Rating);
	const team2ExpectedScore = calculateExpectedScore(team2Rating, team1Rating);

	const team1ActualScore = isTeam1Win ? 1 : 0;
	const team2ActualScore = isTeam1Win ? 0 : 1;
	const team1K = getK(team1Rating);
	const team2K = getK(team2Rating);
	const newTeam1Rating = team1.map((player) =>
		calculateNewRating(
			player.score,
			team1ExpectedScore,
			team1ActualScore,
			team1K,
		),
	);
	const newTeam2Rating = team2.map((player) =>
		calculateNewRating(
			player.score,
			team2ExpectedScore,
			team2ActualScore,
			team2K,
		),
	);

	return {
		team1: team1.map((player, index) => ({
			...player,
			score: newTeam1Rating[index],
		})),
		team2: team2.map((player, index) => ({
			...player,
			score: newTeam2Rating[index],
		})),
	};
};

export const getRoundByRankScore = (rankScore: number): number => {
	switch (true) {
		case rankScore < 1400:
			return 2;
		case rankScore < 1800:
			return 3;
		case rankScore < 2200:
			return 4;
		default:
			return 1;
	}
};

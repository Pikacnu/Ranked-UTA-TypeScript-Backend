import { type PartyData, type PartyPlayer } from './types';

/**
 * 工具類：計算平均分與分差
 */
class MatchUtils {
	public static avgScore(party: PartyData): number {
		if (party.partyMembers.length === 0) return 0;
		const totalScore = party.partyMembers.reduce(
			(sum, player) => sum + player.score,
			0,
		);
		return totalScore / party.partyMembers.length;
	}

	public static avgScoreForTeam(team: PartyData[]): number {
		const totalPlayers = team.reduce(
			(sum, party) => sum + party.partyMembers.length,
			0,
		);
		const totalScore = team.reduce(
			(sum, party) =>
				sum +
				party.partyMembers.reduce(
					(partySum, player) => partySum + player.score,
					0,
				),
			0,
		);
		return totalPlayers > 0 ? totalScore / totalPlayers : 0;
	}

	public static diff(teamA: PartyData[], teamB: PartyData[]): number {
		return Math.abs(this.avgScoreForTeam(teamA) - this.avgScoreForTeam(teamB));
	}
}

/**
 * 配對結果結構
 */
export class MatchResult {
	public readonly queueSize: number;
	public readonly teamA: PartyData[];
	public readonly teamB: PartyData[];
	public readonly avgDiff: number;

	constructor(
		queueSize: number,
		teamA: PartyData[],
		teamB: PartyData[],
		avgDiff: number,
	) {
		this.queueSize = queueSize;
		this.teamA = teamA;
		this.teamB = teamB;
		this.avgDiff = avgDiff;
	}
}

/**
 * 管理 1~4 人隊列：允許大小 ≤ N 的 PartyData 加入，實際配對時再補齊
 */
export class QueueManager {
	private readonly queues: Map<number, PartyData[]> = new Map();

	constructor() {
		for (let n = 1; n <= 4; n++) {
			this.queues.set(n, []);
		}
	}

	/** 玩家/小隊加入某 N 人隊列 */
	public enqueue(targetSize: number, party: PartyData): void {
		const partySize = party.partyMembers.length;
		if (partySize < 1 || partySize > targetSize) {
			throw new Error(
				`Party size must be between 1 and ${targetSize} for this queue.`,
			);
		}

		const queue = this.queues.get(targetSize);
		if (queue) {
			// 檢查是否已存在，如果存在則更新
			const existingIndex = queue.findIndex((p) => p.partyId === party.partyId);
			if (existingIndex !== -1) {
				queue[existingIndex] = party;
			} else {
				queue.push(party);
			}
		}
	}

	/** 取出目前某 N 人隊列的所有候選小隊 */
	public getCandidates(targetSize: number): PartyData[] {
		return this.queues.get(targetSize) || [];
	}

	/** 將已使用的小隊從隊列移除 */
	public removeParties(targetSize: number, used: PartyData[]): void {
		const queue = this.queues.get(targetSize);
		if (queue) {
			const usedIds = new Set(used.map((p) => p.partyId));
			this.queues.set(
				targetSize,
				queue.filter((p) => !usedIds.has(p.partyId)),
			);
		}
	}

	/** 從指定隊列移除單一小隊 */
	public removeFromQueue(targetSize: number, partyId: number): void {
		const queue = this.queues.get(targetSize);
		if (queue) {
			this.queues.set(
				targetSize,
				queue.filter((p) => p.partyId !== partyId),
			);
		}
	}
}

/**
 * 主匹配器：
 * 1. 補齊至 N 人完整隊伍
 * 2. 按平均分差最小且 ≤ 300 進行兩隊配對
 */
export class PartyMatchmaker {
	private readonly queueManager: QueueManager;
	private static readonly MAX_DIFF = 300;

	constructor(queueManager: QueueManager) {
		this.queueManager = queueManager;
	}

	/**
	 * 對所有 1~4 人隊列各自執行配對，返回所有 MatchResult
	 */
	public matchAllQueues(): MatchResult[] {
		const results: MatchResult[] = [];

		for (let N = 1; N <= 4; N++) {
			const fullTeams = this.buildFullTeams(N);
			fullTeams.sort(
				(a, b) => MatchUtils.avgScoreForTeam(a) - MatchUtils.avgScoreForTeam(b),
			);

			while (fullTeams.length >= 2) {
				let bestDiff = Number.MAX_VALUE;
				let bestI = -1;
				let bestJ = -1;

				// 找到分差最小的兩隊（檢查所有可能的配對組合）
				for (let i = 0; i < fullTeams.length - 1; i++) {
					for (let j = i + 1; j < fullTeams.length; j++) {
						const diff = MatchUtils.diff(fullTeams[i], fullTeams[j]);
						if (diff < bestDiff) {
							bestDiff = diff;
							bestI = i;
							bestJ = j;
						}
					}
				}

				if (bestI < 0 || bestDiff > PartyMatchmaker.MAX_DIFF) break;

				// 移除配對的隊伍（先移除較大的索引）
				const teamA = fullTeams.splice(bestJ, 1)[0];
				const teamB = fullTeams.splice(bestI, 1)[0];

				results.push(new MatchResult(N, teamA, teamB, bestDiff));

				// 從隊列中移除已使用的小隊
				const used: PartyData[] = [...teamA, ...teamB];
				this.queueManager.removeParties(N, used);
			}
		}

		return results;
	}

	/** 將 N 人隊列中玩家／小隊串成完整 N 人隊伍，剩餘不足者保留 */
	private buildFullTeams(N: number): PartyData[][] {
		const teams: PartyData[][] = [];
		const candidates = [...this.queueManager.getCandidates(N)];
		candidates.sort((a, b) => MatchUtils.avgScore(a) - MatchUtils.avgScore(b));

		while (candidates.length > 0) {
			const buffer: PartyData[] = [];
			let currentSize = 0;
			let foundMatch = false;

			for (let i = 0; i < candidates.length; i++) {
				const party = candidates[i];
				const partySize = party.partyMembers.length;

				if (currentSize + partySize <= N) {
					buffer.push(party);
					currentSize += partySize;
					candidates.splice(i, 1);
					i--; // 調整索引，因為數組已縮短
					foundMatch = true;

					if (currentSize === N) {
						teams.push([...buffer]);
						break;
					}
				}
			}

			// 如果沒有找到任何匹配或無法組成完整隊伍，則停止
			if (!foundMatch || currentSize < N) {
				break;
			}
		}

		return teams;
	}
}

export enum GameStatus {
	Pending = 'pending',
	BanCharacter = 'ban-character',
	SelectCharacter = 'select-character',
	RandomTeam = 'random-team',
	Starting = 'starting',
	InProgress = 'in-progress',
	Ending = 'ending',
	Complete = 'complete',
}

export class Game {
	id: string;
	status: GameStatus;
	players: string[];

	constructor(id: string, players: string[]) {
		this.id = id;
		this.status = GameStatus.Pending;
		this.players = players;
	}
}

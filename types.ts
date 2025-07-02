export enum Action {
	handshake = 'handshake',
	heartbeat = 'heartbeat',
	message = 'message',
	disconnect = 'disconnect',
	command = 'command',
	request_data = 'request_data',
	get_player_data = 'get_player_data',
	update_player_data = 'update_player_data',
	party = 'party',
	queue = 'queue',
	queue_leave = 'queue_leave',
	queue_match = 'queue_match',
	whitelist_change = 'whitelist_change',
	game_status = 'game_status',
	map_choose = 'map_choose',
	kill = 'kill',
	damage = 'damage',
	transfer = 'transfer',
	party_disbanded = 'party_disbanded',
	team_join = 'team_join',
	player_online_status = 'player_online_status',
}

export enum GameStatus {
	idle,
	pending,
	start,
	during,
	end,
}

export type GamePlayer = {
	uuid: string;
	minecraftId: string;
	killCount: number;
	deathCount: number;
	assistCount: number;
	score: number;
	isOnline: boolean;
	isTeam1: boolean;
};

export type Game = {
	id: string;
	type: QueueName;
	players: GamePlayer[];
	status?: GameStatus;
};

export type Server = {
	clientId: string;
	lastHeartbeat: number;
	isLobby?: boolean;
	status: ServerStatus;
	game?: Game;
	[key: string]: any;
};

export enum ServerStatus {
	pending = 'pending',
	started = 'started',
}

export enum status {
	success = 1,
	error = 0,
}

export type Message = {
	action: Action;
	sessionId?: string;
	payload?: {
		command?: string;
		message?: string;
		data?: any;
		request_target?: string;
		team_data?: {
			uuids: string[];
			team_score: number;
		}[];
		queue?: {
			queue_name: string;
			uuid?: string;
			parties?: PartyData[][];
		};
		player?: {
			uuid?: string;
			minecraftId?: string;
			deathCount?: number;
			killCount?: number;
			gameCount?: number;
			isInParty?: boolean;
			isOnline?: boolean;
		};
		party?: {
			partyId: number;
			partyLeaderUUID: string;
			partyMembers: PartyPlayer[];
		};
		lobby?: {
			isLobby: boolean;
		};
		whilelist?: {
			players: {
				uuid: string;
				minecraftId: string;
			};
		};
		playerOnlineStatus?: {
			uuids: string[];
			connection: Connection;
		};
		transferData?: {
			targetServer: string;
			targetPort: number;
			uuids: string[];
		};
	};
};

export enum Connection {
	CONNECTED = 'CONNECTED',
	DISCONNECTED = 'DISCONNECTED',
}

export const ConnectionStatusStringToEnum = (status: string): Connection => {
	switch (status) {
		case 'CONNECTED':
			return Connection.CONNECTED;
		case 'DISCONNECTED':
			return Connection.DISCONNECTED;
		default:
			throw new Error(`Unknown connection status: ${status}`);
	}
};

export type PartyPlayer = {
	uuid: string;
	minecraftId: string;
	score: number;
};

export type PartyData = {
	partyId: number;
	partyLeaderUUID: string;
	partyMembers: PartyPlayer[];
	isInQueue?: boolean;
};

export enum killType {
	Player = 'PLAYER',
	SPARE = 'SPARE',
	VOID = 'VOID',
	MELT = 'MELT',
}

export type KillData = {
	target: string;
	attacker: string;
	assists?: string[];
	type: killType;
};

export type DamageData = {
	target: string;
	attacker: string;
	damage: number;
};

enum char {
	Sans = 1,
	Papyrus = 2,
	Undyne = 3,
	Frisk = 4,
	Flowey = 5,
	Mettaton = 6,
	Muffet = 7,
	Chara = 8,
	Toriel = 9,
	Asgore = 10,
	Asriel = 11,
	Alphys = 13,
	Napstablook = 14,
	Mad_Dummy = 15,
}

export type QueueName = 'solo' | 'duo' | 'trio' | 'squad';

export const SizeToQueueName: Record<number, string> = {
	1: 'solo',
	2: 'duo',
	3: 'trio',
	4: 'squad',
};

export const QueueNameToSize: Record<string, number> = {
	solo: 1,
	duo: 2,
	trio: 3,
	squad: 4,
};

export class WebSocketError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'WebSocketError';
	}
}

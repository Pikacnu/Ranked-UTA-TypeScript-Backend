export enum Action {
	handshake = 'handshake',
	heartbeat = 'heartbeat',
	message = 'message',
	disconnect = 'disconnect',
	command = 'command',
	request_data = 'request_data',
	get_player_data = 'get_player_data',
	update_player_data = 'update_player_data',

	player_info = 'player_info',
	output_win = 'output_win',
	game_state = 'game_state',

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
	serverIP: string;
	serverPort: number;
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
			names: string[];
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
		handshake?: {
			isLobby: boolean;
			sessionId?: string;
			serverIP: string;
			serverPort: number;
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

export const NumberToChar: Record<number, string> = {
	1: 'Sans',
	2: 'Papyrus',
	3: 'Undyne',
	4: 'Frisk',
	5: 'Flowey',
	6: 'Mettaton',
	7: 'Muffet',
	8: 'Chara',
	9: 'Toriel',
	10: 'Asgore',
	11: 'Asriel',
	13: 'Alphys',
	14: 'Napstablook',
	15: 'Mad_Dummy',
};

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

export const UUIDFromArray = (arr: number[]): string => {
	if (arr.length !== 4) {
		throw new Error('Array must be of length 4');
	}

	// Convert each 32-bit signed integer to bytes in big-endian format
	const bytes: number[] = [];
	for (const num of arr) {
		// Handle signed integers by using DataView for proper byte conversion
		const buffer = new ArrayBuffer(4);
		const view = new DataView(buffer);
		view.setInt32(0, num, false); // false = big-endian

		bytes.push(view.getUint8(0));
		bytes.push(view.getUint8(1));
		bytes.push(view.getUint8(2));
		bytes.push(view.getUint8(3));
	}

	const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');

	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20, 32),
	].join('-');
};

export const UUIDStringToArray = (uuid: string): number[] =>
	uuid
		.replace(/\[I;/g, '')
		.replace(/]/g, '')
		.split(',')
		.map((v) => parseInt(v, 10));

export const MinecraftNbtProcessToJson = (data: string): any =>
	data
		.replaceAll(/I;/g, '')
		.replaceAll(/[A-Za-z]+/gm, (m) => (['float'].includes(m) ? m : `"${m}"`));

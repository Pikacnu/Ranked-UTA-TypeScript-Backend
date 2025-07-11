import {
	Action,
	WebSocketError,
	UUIDFromArray,
	MinecraftNbtProcessToJsonString,
} from '../types';
import type { Handler } from './types';

export const action = Action.player_info;

export const handler: Handler = async ({ message, logger }) => {
	const { payload } = message;

	if (!payload || !payload.data) {
		throw new WebSocketError('Player info is required');
	}

	try {
		console.log(MinecraftNbtProcessToJsonString(payload.data.data[0]));
		const data = JSON.parse(
			MinecraftNbtProcessToJsonString(payload.data.data[0]),
		);
		const uuid = UUIDFromArray(data.UUID);
		const killCount = data.elim || 0;
		const deathCount = data.death || 0;
		const assistCount = data.assist || 0;
		const damageDealt = (data.damagedealt?.value || 0) * 0.01;
		const damageTaken = (data.damagetaken?.value || 0) * 0.01;
		const playerData = {
			uuid,
			killCount,
			deathCount,
			assistCount,
			damageDealt,
			damageTaken,
		};
		console.log('Player data processed', playerData);
		//[{UUID:[I;0,0,0,0], elim:0, death: 0, assist: 0, damagedealt:{type:"float", value:0}, damagetaken:{type:"float", value:0}}]
	} catch (error) {
		logger.error('Error processing player info', error);
		throw new WebSocketError('Error processing player info');
	}
};

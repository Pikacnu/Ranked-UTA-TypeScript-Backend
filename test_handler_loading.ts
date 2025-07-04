import { getLoadedHandlers } from './main/handlers';

async function testHandlerLoading() {
	console.log('Testing handler loading system...\n');

	// Get all loaded handlers
	const loadedHandlers = getLoadedHandlers();

	console.log('Loaded handlers:');
	console.log('================');
	Object.entries(loadedHandlers).forEach(([action, file]) => {
		console.log(`${action.padEnd(25)} -> ${file}`);
	});

	console.log(`\nTotal handlers loaded: ${Object.keys(loadedHandlers).length}`);

	// Expected handlers
	const expectedActions = [
		'handshake',
		'heartbeat',
		'request_data',
		'get_player_data',
		'update_player_data',
		'party',
		'party_disbanded',
		'queue',
		'queue_leave',
		'game_status',
		'map_choose',
		'kill',
		'damage',
		'player_online_status',
		'player_info',
		'output_win',
	];

	console.log('\nValidation:');
	console.log('===========');

	const missingActions: string[] = [];
	const unexpectedActions: string[] = [];

	expectedActions.forEach((action) => {
		if (!loadedHandlers[action]) {
			missingActions.push(action);
		}
	});

	Object.keys(loadedHandlers).forEach((action) => {
		if (!expectedActions.includes(action)) {
			unexpectedActions.push(action);
		}
	});

	if (missingActions.length === 0 && unexpectedActions.length === 0) {
		console.log('✅ All expected handlers are loaded correctly!');
	} else {
		if (missingActions.length > 0) {
			console.log('❌ Missing handlers:', missingActions);
		}
		if (unexpectedActions.length > 0) {
			console.log('⚠️  Unexpected handlers:', unexpectedActions);
		}
	}
}

testHandlerLoading().catch(console.error);

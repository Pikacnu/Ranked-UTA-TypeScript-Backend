import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { loadCommands } from './commands';
import { WebsocketClient } from './classes/websocket';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildVoiceStates,
	],
});

const websocket = WebsocketClient.initialize('ws://localhost:8080/ws',client);

const commands = await loadCommands();
client.on('interactionCreate', async (interaction) => {
	if (!interaction.isCommand() || !interaction.isChatInputCommand()) return;
	const command = commands.find(
		(cmd) => cmd.commandBuilder.name === interaction.commandName,
	);

	if (!command) {
		await interaction.reply({
			content: 'Unknown command',
			ephemeral: true,
		});
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(`Error executing command ${interaction.commandName}:`, error);
		await interaction.reply({
			content: 'There was an error while executing this command.',
			ephemeral: true,
		});
	}
});
const rest = new REST().setToken(Bun.env.DiscordToken || '');

console.log(
	'Started refreshing ' + commands.length + ' application (/) commands.',
);

await rest.put(Routes.applicationCommands(Bun.env.DiscordClientId || ''), {
	body: commands.map((cmd) => cmd.commandBuilder.toJSON()),
});

client.on('ready', () => {
	console.log(`Logged in as ${client.user?.tag}`);
});

client.login(Bun.env.DiscordToken);

import { Client,GatewayIntentBits } from 'discord.js';

const client = new Client({
  intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ]
});


client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.login(Bun.env.DiscordToken);
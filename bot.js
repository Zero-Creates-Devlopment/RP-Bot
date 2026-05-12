const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
require('dotenv').config();

const { commands } = require('./commands');
const { characters, rpThreadsData, loadCharacters, loadThreads } = require('./persistence');
const { handleInteractionCreate, handleMessageCreate } = require('./handlers');

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.DirectMessages
] });

loadCharacters();
loadThreads();
client.rpThreads = rpThreadsData;

client.once('ready', async () => {
  console.log(`? Bot logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

  try {
    console.log('Refreshing application commands...');
    await rest.put(route, { body: commands });
    console.log('? Commands registered');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async interaction => handleInteractionCreate(interaction, client));
client.on('messageCreate', async message => handleMessageCreate(message, client));

client.login(process.env.DISCORD_TOKEN);

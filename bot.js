const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.DirectMessages
]});

// Load characters from file
const charactersFile = path.join(__dirname, 'characters.json');
let characters = {};

function loadCharacters() {
  if (fs.existsSync(charactersFile)) {
    const data = fs.readFileSync(charactersFile, 'utf-8');
    characters = JSON.parse(data);
  }
}

function saveCharacters() {
  fs.writeFileSync(charactersFile, JSON.stringify(characters, null, 2));
}

// Load threads from file
const threadsFile = path.join(__dirname, 'threads.json');
let rpThreadsData = {};

function loadThreads() {
  if (fs.existsSync(threadsFile)) {
    const data = fs.readFileSync(threadsFile, 'utf-8');
    const loaded = JSON.parse(data);
    // Convert invited arrays back to Sets
    for (const threadId in loaded) {
      if (loaded[threadId].invited) {
        loaded[threadId].invited = new Set(loaded[threadId].invited);
      }
    }
    rpThreadsData = loaded;
  }
}

function saveThreads() {
  const toSave = {};
  for (const threadId in rpThreadsData) {
    toSave[threadId] = {
      ...rpThreadsData[threadId],
      // Convert Sets to arrays for JSON serialization
      invited: Array.from(rpThreadsData[threadId].invited || [])
    };
  }
  fs.writeFileSync(threadsFile, JSON.stringify(toSave, null, 2));
}

// Load characters and threads on startup
loadCharacters();
loadThreads();

// Command data
const commands = [
  {
    name: 'createchar',
    description: 'Create a new character for roleplay',
    options: [
      {
        name: 'name',
        description: 'Character name',
        type: 3,
        required: true
      },
      {
        name: 'description',
        description: 'Character description/background',
        type: 3,
        required: true
      },
      {
        name: 'avatar_url',
        description: 'Character avatar URL',
        type: 3,
        required: false
      }
    ]
  },
  {
    name: 'listchars',
    description: 'List all your characters'
  },
  {
    name: 'deletechar',
    description: 'Delete a character',
    options: [
      {
        name: 'character_name',
        description: 'Name of the character to delete',
        type: 3,
        required: true,
        autocomplete: true
      }
    ]
  },
  {
    name: 'rpthread',
    description: 'Create an RP thread with a character',
    options: [
      {
        name: 'character_name',
        description: 'The character to use',
        type: 3,
        required: true,
        autocomplete: true
      },
      {
        name: 'thread_name',
        description: 'Name for the RP thread',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'charchange',
    description: 'Change the character in the current RP thread',
    options: [
      {
        name: 'character_name',
        description: 'The character to switch to',
        type: 3,
        required: true,
        autocomplete: true
      }
    ]
  }
];

// Register commands with Discord
client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

  try {
    console.log('Refreshing application commands...');
    await rest.put(route, { body: commands });
    console.log('✅ Commands registered');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

// Handle interactions (commands and autocomplete)
client.on('interactionCreate', async interaction => {
  try {
    // Autocomplete handler
    if (interaction.isAutocomplete()) {
      const focusedValue = interaction.options.getFocused();
      const userChars = characters[interaction.user.id] || [];
      const charNames = userChars.map(c => c.name);
      const filtered = charNames.filter(name => name.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
      await interaction.respond(filtered.map(name => ({ name, value: name })));
      return;
    }

    // Button interaction handler
    if (interaction.isButton()) {
      const customId = interaction.customId;

      if (customId.startsWith('invite_accept_')) {
        const parts = customId.split('_');
        const threadId = parts[2];
        const userId = parts[3];
        const threadData = client.rpThreads[threadId];

        if (!threadData) {
          return interaction.reply({ content: '❌ Thread data not found.', ephemeral: true });
        }

        if (interaction.user.id !== userId) {
          return interaction.reply({ content: '❌ Only the invited user can accept this invite.', ephemeral: true });
        }

        if (!threadData.invited) {
          threadData.invited = new Set();
        }
        threadData.invited.add(userId);
        saveThreads();

        const guild = client.guilds.cache.first();
        const thread = await guild?.channels.fetch(threadId).catch(() => null);
        const user = await client.users.fetch(userId).catch(() => null);

        if (thread && user) {
          const acceptEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setDescription(`✅ **${user.username}** Has Joined The World!`);

          await thread.send({ embeds: [acceptEmbed] });
          await interaction.reply({ content: `✅ Invite accepted. Use "/charchange" in the thread to choose your character.`, ephemeral: true });
          return;
        }

        await interaction.reply({ content: '✅ Invite accepted!', ephemeral: true });
        return;
      }

      else if (customId.startsWith('invite_deny_')) {
        const parts = customId.split('_');
        const threadId = parts[2];
        const userId = parts[3];
        const threadData = client.rpThreads[threadId];

        if (!threadData) {
          return interaction.reply({ content: '❌ Thread data not found.', ephemeral: true });
        }

        if (interaction.user.id !== userId) {
          return interaction.reply({ content: '❌ Only the invited user can deny this invite.', ephemeral: true });
        }

        const thread = await client.channels.fetch(threadId).catch(() => null);
        const user = await client.users.fetch(userId).catch(() => null);
        if (thread && user) {
          const denyEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription(`❌ **${user.username}** declined the invite.`);
          await thread.send({ embeds: [denyEmbed] });
        }

        await interaction.reply({ content: '❌ You declined the invite.', ephemeral: true });
        return;
      }
    }

    // Command handler
    if (!interaction.isCommand()) return;

    const { commandName, options, user, channel } = interaction;
    const userId = user.id;

    if (!characters[userId]) {
      characters[userId] = [];
    }

    if (commandName === 'createchar') {
      const name = options.getString('name');
      const description = options.getString('description');
      const avatarUrl = options.getString('avatar_url') || null;

      // Check if character already exists
      if (characters[userId].find(c => c.name.toLowerCase() === name.toLowerCase())) {
        return interaction.reply({ content: '❌ You already have a character with that name!', ephemeral: true });
      }

      characters[userId].push({
        name,
        description,
        avatarUrl,
        createdAt: new Date().toISOString()
      });

      saveCharacters();

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Character Created!')
        .addFields(
          { name: 'Name', value: name },
          { name: 'Description', value: description }
        )
        .setThumbnail(avatarUrl);

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    else if (commandName === 'listchars') {
      const userChars = characters[userId] || [];

      if (userChars.length === 0) {
        return interaction.reply({ content: '📭 You don\'t have any characters yet! Use `/createchar` to create one.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`${user.username}'s Characters`)
        .setDescription(userChars.map(c => `**${c.name}** - ${c.description.substring(0, 50)}...`).join('\n\n'));

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    else if (commandName === 'deletechar') {
      const charName = options.getString('character_name');
      const charIndex = characters[userId].findIndex(c => c.name.toLowerCase() === charName.toLowerCase());

      if (charIndex === -1) {
        return interaction.reply({ content: '❌ Character not found!', ephemeral: true });
      }

      const deleted = characters[userId].splice(charIndex, 1)[0];
      saveCharacters();

      await interaction.reply({ content: `✅ Deleted character **${deleted.name}**!`, ephemeral: true });
    }

    else if (commandName === 'rpthread') {
      const charName = options.getString('character_name');
      const threadName = options.getString('thread_name');

      const character = characters[userId]?.find(c => c.name.toLowerCase() === charName.toLowerCase());

      if (!character) {
        return interaction.reply({ content: '❌ Character not found!', ephemeral: true });
      }

      // Get the RP channel
      let rpChannel;
      try {
        rpChannel = await client.channels.fetch(process.env.DISCORD_RP_CHANNEL_ID);
      } catch (error) {
        return interaction.reply({ content: '❌ RP channel not configured or not found! Ask the server admin to set it up.', ephemeral: true });
      }

      if (!rpChannel) {
        return interaction.reply({ content: '❌ RP channel not found!', ephemeral: true });
      }

      // Create thread in the designated RP channel
      const thread = await rpChannel.threads.create({
        name: threadName,
        reason: `RP thread for character: ${character.name}`
      });

      // Send initial message with character info
      const embed = new EmbedBuilder()
        .setColor('#9900ff')
        .setTitle(`🎭 ${character.name}`)
        .setDescription(character.description)
        .setThumbnail(character.avatarUrl)
        .setFooter({ text: `RP Thread | ${character.name} Played By ${message.author.username}` });

      await thread.send({ embeds: [embed] });

      // Store thread info
      if (!client.rpThreads[thread.id]) {
        client.rpThreads[thread.id] = {
          ownerId: userId,
          users: {},
          invited: new Set([userId])
        };
      }

      client.rpThreads[thread.id].users[userId] = {
        characterName: character.name,
        avatarUrl: character.avatarUrl
      };
      saveThreads();

      await interaction.reply({ content: `✅ RP Thread created: <#${thread.id}>`, ephemeral: true });
    }

    else if (commandName === 'charchange') {
      const charName = options.getString('character_name');

      // Check if in a thread
      if (!interaction.channel.isThread()) {
        return interaction.reply({ content: '❌ This command can only be used in an RP thread!', ephemeral: true });
      }

      const character = characters[userId]?.find(c => c.name.toLowerCase() === charName.toLowerCase());

      if (!character) {
        return interaction.reply({ content: '❌ Character not found!', ephemeral: true });
      }

      // Update thread data for this user
      if (!client.rpThreads[interaction.channelId]) {
        client.rpThreads[interaction.channelId] = {
          ownerId: userId,
          users: {},
          invited: new Set([userId])
        };
      }

      const threadData = client.rpThreads[interaction.channelId];
      threadData.users = threadData.users || {};
      threadData.invited = threadData.invited || new Set();
      threadData.users[userId] = {
        characterName: character.name,
        avatarUrl: character.avatarUrl
      };
      threadData.invited.add(userId);
      saveThreads();

      // Send notification
      const notifEmbed = new EmbedBuilder()
        .setColor('#ffcc00')
        .setDescription(`✨ Character changed to **${character.name}**`);
      // Send initial message with character info
      const embed = new EmbedBuilder()
        .setColor('#9900ff')
        .setTitle(`🎭 ${character.name}`)
        .setDescription(character.description)
        .setThumbnail(character.avatarUrl)
        .setFooter({ text: `RP Thread | ${character.name} Played By ${message.author.username}` });

      await thread.send({ embeds: [embed] });
      await interaction.reply({ embeds: [notifEmbed], ephemeral: true });
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
  }
});

// Track RP threads (initialize from persisted data)
client.rpThreads = rpThreadsData;

// Message handler for RP threads
client.on('messageCreate', async message => {
  try {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check if message is in an RP thread
    if (message.channel.isThread()) {
      // Try to find thread data from stored threads
      let rpThreadData = client.rpThreads[message.channelId];

      // If no stored data exists, infer initial thread owner from the first embed
      if (!rpThreadData) {
        const messages = await message.channel.messages.fetch({ limit: 10 });
        const charMessage = messages.find(m => m.embeds.length > 0 && m.embeds[0].title);

        if (charMessage && charMessage.embeds[0]) {
          const embed = charMessage.embeds[0];
          const characterName = embed.title.replace('🎭 ', '');

          // Find which user owns this character
          for (const [uid, chars] of Object.entries(characters)) {
            const char = chars.find(c => c.name === characterName);
            if (char) {
              rpThreadData = {
                ownerId: uid,
                users: {
                  [uid]: {
                    characterName: characterName,
                    avatarUrl: char.avatarUrl
                  }
                },
                invited: new Set([uid])
              };
              client.rpThreads[message.channelId] = rpThreadData;
              saveThreads();
              break;
            }
          }
        }
      }

      const invitedUsers = rpThreadData?.invited || new Set();
      const isInvited = invitedUsers.has(message.author.id);

      const inviteMatch = message.content.match(/<@!?(\d+)>\s+invite/i);
      const threadOwnerId = rpThreadData?.ownerId;

      if (inviteMatch && message.author.id === threadOwnerId) {
        const mentionedUserId = inviteMatch[1];
        const invitee = await client.users.fetch(mentionedUserId).catch(() => null);
        await message.delete().catch(() => {});
        if (!invitee) {
          await message.reply({ content: '❌ User not found!', ephemeral: true });
          return;
        }

        if (rpThreadData.invited?.has(mentionedUserId)) {
          await message.reply({ content: '❌ That user is already invited.', ephemeral: true });
          return;
        }

        const inviteEmbed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('📨 RP Thread Invitation')
          .setDescription(`${message.author.username} invited you to join the RP thread **${message.channel.name}**.`)
          .setFooter({ text: 'Accept to join and then use /charchange to select your character.' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`invite_accept_${message.channelId}_${mentionedUserId}`)
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`invite_deny_${message.channelId}_${mentionedUserId}`)
            .setLabel('Deny')
            .setStyle(ButtonStyle.Danger)
        );

        try {
          await invitee.send({ embeds: [inviteEmbed], components: [row] });
          await message.reply({ content: `✅ Invitation sent to ${invitee.username}!`, ephemeral: true });
        } catch (error) {
          await message.reply({ content: `❌ Could not send the invite to ${invitee.username}. They may have DMs disabled.`, ephemeral: true });
        }
        return;
      }

      if (!isInvited) {
        await message.delete().catch(() => {});
        await message.reply({ content: '❌ You are not invited to this RP thread. Only the owner can invite new users.', ephemeral: true });
        return;
      }

      // If the user is invited, process the message below
      if (rpThreadData) {
        const userMessage = message.content;
        rpThreadData.users = rpThreadData.users || {};
        let selectedChar = rpThreadData.users[message.author.id];

        if (!selectedChar) {
          await message.delete().catch(() => {});
          await message.reply({ content: '❌ You have been invited but do not have a selected character yet. Use `/charchange` in this thread to choose your character.', ephemeral: true });
          return;
        }

        const isAction = userMessage.startsWith('/action ') || (userMessage.startsWith('*') && userMessage.endsWith('*'));
        const isOOC = userMessage.startsWith('//') || (userMessage.startsWith('(') && userMessage.endsWith(')'));

        await message.delete().catch(() => {});

        if (isOOC) {
          const oocContent = userMessage.startsWith('//')
            ? userMessage.substring(2).trim()
            : userMessage.substring(1, userMessage.length - 1).trim();

          await message.channel.send(`**${selectedChar.characterName} (OOC)**: ${oocContent}`);
        } else if (isAction) {
          const actionContent = userMessage.startsWith('/action ')
            ? userMessage.substring(8).trim()
            : userMessage.substring(1, userMessage.length - 1).trim();

          await message.channel.send(`*${selectedChar.characterName} ${actionContent}*`);
        } else {
          await message.channel.send(`**${selectedChar.characterName}**: ${userMessage}`);
        }
      }
    }
  } catch (error) {
    console.error('Message handler error:', error);
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

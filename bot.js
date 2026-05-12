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

// Load characters on startup
loadCharacters();

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

  try {
    console.log('Refreshing application commands...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
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
        
        // Initialize invites set if needed
        if (!client.rpInvites[threadId]) {
          client.rpInvites[threadId] = new Set();
        }

        // Add user to invites
        client.rpInvites[threadId].add(userId);

        // Get thread and user
        const guild = client.guilds.cache.first();
        const thread = await guild?.channels.fetch(threadId).catch(() => null);
        const user = await client.users.fetch(userId).catch(() => null);

        if (thread && user) {
          // Send notification to thread
          const acceptEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setDescription(`✅ **${user.username}** has been invited to the RP thread!`);

          await thread.send({ embeds: [acceptEmbed] });
        }

        await interaction.reply({ content: '✅ Invite accepted!', ephemeral: true });
        return;
      }

      else if (customId.startsWith('invite_deny_')) {
        const parts = customId.split('_');
        const userId = parts[2];
        const user = await client.users.fetch(userId).catch(() => null);

        await interaction.reply({ content: `❌ Invite denied for **${user?.username || 'Unknown User'}**!`, ephemeral: true });
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
        .setFooter({ text: `RP Thread | Messages sent here will be roleplay'd by ${character.name}` });

      await thread.send({ embeds: [embed] });

      // Store thread info
      if (!thread.client.rpThreads) {
        thread.client.rpThreads = {};
      }
      thread.client.rpThreads[thread.id] = {
        characterId: `${userId}|${character.name}`,
        userId,
        characterName: character.name,
        avatarUrl: character.avatarUrl
      };

      // Initialize invited users for this thread (add creator)
      if (!thread.client.rpInvites) {
        thread.client.rpInvites = {};
      }
      thread.client.rpInvites[thread.id] = new Set([userId]);

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

      // Update thread data
      client.rpThreads[interaction.channelId] = {
        userId,
        characterName: character.name,
        avatarUrl: character.avatarUrl
      };

      // Send notification
      const notifEmbed = new EmbedBuilder()
        .setColor('#ffcc00')
        .setDescription(`✨ Character changed to **${character.name}**`);

      await interaction.reply({ embeds: [notifEmbed], ephemeral: true });
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
  }
});

// Track RP threads and invited users
client.rpThreads = {};
client.rpInvites = {}; // threadId -> Set of user IDs

// Message handler for RP threads
client.on('messageCreate', async message => {
  try {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check if message is in an RP thread
    if (message.channel.isThread()) {
      // Try to find thread data from stored threads or parent message
      let rpThreadData = client.rpThreads[message.channelId];

      // If no stored data, check thread messages for character info
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
                userId: uid,
                characterName: characterName,
                avatarUrl: char.avatarUrl
              };
              break;
            }
          }
        }
      }

      // Check if user is invited to this thread
      const invitedUsers = client.rpInvites[message.channelId] || new Set();
      const isInvited = invitedUsers.has(message.author.id);

      // If not invited, handle invite request
      if (!isInvited) {
        const inviteMatch = message.content.match(/<@!?(\d+)>\s+invite/i);

        if (inviteMatch) {
          const mentionedUserId = inviteMatch[1];
          const mentionedUser = await client.users.fetch(mentionedUserId).catch(() => null);

          if (!mentionedUser) {
            await message.reply('❌ User not found!');
            return;
          }

          // Create invite request embed
          const requestEmbed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('📨 RP Thread Invite Request')
            .setDescription(`${message.author.username} is requesting to join the RP thread:\n**${message.channel.name}**`)
            .setThumbnail(message.author.avatarURL())
            .setTimestamp();

          // Create accept/deny buttons
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`invite_accept_${message.channelId}_${message.author.id}`)
              .setLabel('Accept')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`invite_deny_${message.channelId}_${message.author.id}`)
              .setLabel('Deny')
              .setStyle(ButtonStyle.Danger)
          );

          // Send DM to thread creator
          try {
            await mentionedUser.send({ embeds: [requestEmbed], components: [row] });
            await message.reply(`✅ Invite request sent to ${mentionedUser.username}!`);
          } catch (error) {
            await message.reply(`❌ Could not send invite request to ${mentionedUser.username}. They may have DMs disabled.`);
          }
        } else {
          await message.reply('❌ You are not invited to this RP thread! Use `@username invite` to request an invite.');
        }
        return;
      }

      // If we found character data and user is invited, process the message
      if (rpThreadData) {
        const userMessage = message.content;
        const isAction = userMessage.startsWith('/action ') || (userMessage.startsWith('*') && userMessage.endsWith('*'));
        const isOOC = (userMessage.startsWith('//') || userMessage.startsWith('(') && userMessage.endsWith(')'));

        // Delete original message
        await message.delete().catch(() => {});

        // Handle Out of Character (OOC) messages
        if (isOOC) {
          const oocContent = userMessage.startsWith('//') 
            ? userMessage.substring(2).trim() 
            : userMessage.substring(1, userMessage.length - 1).trim();

          const oocEmbed = new EmbedBuilder()
            .setColor('#808080')
            .setAuthor({
              name: `${rpThreadData.characterName} (OOC)`,
              iconURL: rpThreadData.avatarUrl
            })
            .setDescription(oocContent)
            .setTimestamp();

          await message.channel.send({ embeds: [oocEmbed] });
        }
        // Handle actions
        else if (isAction) {
          const actionContent = userMessage.startsWith('/action ')
            ? userMessage.substring(8).trim()
            : userMessage.substring(1, userMessage.length - 1).trim();

          const actionEmbed = new EmbedBuilder()
            .setColor('#ff9900')
            .setAuthor({
              name: rpThreadData.characterName,
              iconURL: rpThreadData.avatarUrl
            })
            .setDescription(`*${actionContent}*`)
            .setTimestamp();

          await message.channel.send({ embeds: [actionEmbed] });
        }
        // Handle normal dialogue
        else {
          const dialogueEmbed = new EmbedBuilder()
            .setColor('#9900ff')
            .setAuthor({
              name: rpThreadData.characterName,
              iconURL: rpThreadData.avatarUrl
            })
            .setDescription(userMessage)
            .setTimestamp();

          await message.channel.send({ embeds: [dialogueEmbed] });
        }
      }
    }
  } catch (error) {
    console.error('Message handler error:', error);
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

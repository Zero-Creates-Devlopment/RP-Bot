const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { characters, rpThreadsData, saveCharacters, saveThreads } = require('./persistence');
const { getOrCreateThreadWebhook } = require('./webhooks');

async function handleInteractionCreate(interaction, client) {
  try {
    if (interaction.isAutocomplete()) {
      const focusedValue = interaction.options.getFocused();
      const userChars = characters[interaction.user.id] || [];
      const charNames = userChars.map(c => c.name);
      const filtered = charNames.filter(name => name.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
      await interaction.respond(filtered.map(name => ({ name, value: name })));
      return;
    }

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
      } else if (customId.startsWith('invite_deny_')) {
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

    if (!interaction.isCommand()) return;

    const { commandName, options, user } = interaction;
    const userId = user.id;

    if (!characters[userId]) {
      characters[userId] = [];
    }

    if (commandName === 'createchar') {
      const name = options.getString('name');
      const description = options.getString('description');
      const avatarUrl = options.getString('avatar_url') || null;

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
    } else if (commandName === 'listchars') {
      const userChars = characters[userId] || [];

      if (userChars.length === 0) {
        return interaction.reply({ content: '📭 You don\'t have any characters yet! Use `/createchar` to create one.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`${user.username}'s Characters`)
        .setDescription(userChars.map(c => `**${c.name}** - ${c.description.substring(0, 50)}...`).join('\n\n'));

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (commandName === 'deletechar') {
      const charName = options.getString('character_name');
      const charIndex = characters[userId].findIndex(c => c.name.toLowerCase() === charName.toLowerCase());

      if (charIndex === -1) {
        return interaction.reply({ content: '❌ Character not found!', ephemeral: true });
      }

      const deleted = characters[userId].splice(charIndex, 1)[0];
      saveCharacters();

      await interaction.reply({ content: `✅ Deleted character **${deleted.name}**!`, ephemeral: true });
    } else if (commandName === 'rpthread') {
      const charName = options.getString('character_name');
      const threadName = options.getString('thread_name');

      const character = characters[userId]?.find(c => c.name.toLowerCase() === charName.toLowerCase());
      if (!character) {
        return interaction.reply({ content: '❌ Character not found!', ephemeral: true });
      }

      let rpChannel;
      try {
        rpChannel = await client.channels.fetch(process.env.DISCORD_RP_CHANNEL_ID);
      } catch (error) {
        return interaction.reply({ content: '❌ RP channel not configured or not found! Ask the server admin to set it up.', ephemeral: true });
      }

      if (!rpChannel) {
        return interaction.reply({ content: '❌ RP channel not found!', ephemeral: true });
      }

      const thread = await rpChannel.threads.create({
        name: threadName,
        reason: `RP thread for character: ${character.name}`
      });

      const embed = new EmbedBuilder()
        .setColor('#9900ff')
        .setTitle(`🎭 ${character.name}`)
        .setDescription(character.description)
        .setThumbnail(character.avatarUrl)
        .setFooter({ text: `RP Thread | ${character.name} Played By ${user.username}` });

      await thread.send({ embeds: [embed] });

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
    } else if (commandName === 'charchange') {
      const charName = options.getString('character_name');

      if (!interaction.channel.isThread()) {
        return interaction.reply({ content: '❌ This command can only be used in an RP thread!', ephemeral: true });
      }

      const character = characters[userId]?.find(c => c.name.toLowerCase() === charName.toLowerCase());
      if (!character) {
        return interaction.reply({ content: '❌ Character not found!', ephemeral: true });
      }

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

      const notifEmbed = new EmbedBuilder()
        .setColor('#ffcc00')
        .setDescription(`✨ Character changed to **${character.name}**`);

      const embed = new EmbedBuilder()
        .setColor('#9900ff')
        .setTitle(`🎭 ${character.name}`)
        .setDescription(character.description)
        .setThumbnail(character.avatarUrl)
        .setFooter({ text: `RP Thread | ${character.name} Played By ${user.username}` });

      await interaction.channel.send({ embeds: [embed] });
      await interaction.reply({ embeds: [notifEmbed], ephemeral: true });
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
  }
}

async function handleMessageCreate(message, client) {
  try {
    if (message.author.bot) return;
    if (!message.channel.isThread()) return;

    let rpThreadData = client.rpThreads[message.channelId];

    if (!rpThreadData) {
      const messages = await message.channel.messages.fetch({ limit: 10 });
      const charMessage = messages.find(m => m.embeds.length > 0 && m.embeds[0].title);

      if (charMessage && charMessage.embeds[0]) {
        const embed = charMessage.embeds[0];
        const characterName = embed.title.replace('🎭 ', '');

        for (const [uid, chars] of Object.entries(characters)) {
          const char = chars.find(c => c.name === characterName);
          if (char) {
            rpThreadData = {
              ownerId: uid,
              users: {
                [uid]: {
                  characterName,
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
        await message.reply({ content: '❌ User not found!' });
        return;
      }

      if (rpThreadData.invited?.has(mentionedUserId)) {
        await message.reply({ content: '❌ That user is already invited.' });
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
        await message.reply({ content: `✅ Invitation sent to ${invitee.username}!` });
      } catch (error) {
        await message.reply({ content: `❌ Could not send the invite to ${invitee.username}. They may have DMs disabled.` });
      }
      return;
    }

    if (!isInvited) {
      await message.delete().catch(() => {});
      await message.reply({ content: '❌ You are not invited to this RP thread. Only the owner can invite new users.' });
      return;
    }

    if (rpThreadData) {
      const userMessage = message.content;
      rpThreadData.users = rpThreadData.users || {};
      const selectedChar = rpThreadData.users[message.author.id];

      if (!selectedChar) {
        await message.delete().catch(() => {});
        await message.reply({ content: '❌ You have been invited but do not have a selected character yet. Use `/charchange` in this thread to choose your character.' });
        return;
      }

      const isAction = userMessage.startsWith('/action ') || (userMessage.startsWith('*') && userMessage.endsWith('*'));
      const isOOC = userMessage.startsWith('//') || (userMessage.startsWith('(') && userMessage.endsWith(')'));

      await message.delete().catch(() => {});

      const webhook = await getOrCreateThreadWebhook(message.channel);
      if (!webhook) {
        await message.reply({ content: '❌ Failed to create thread webhook. Contact admin.' });
        return;
      }

      if (isOOC) {
        const oocContent = userMessage.startsWith('//')
          ? userMessage.substring(2).trim()
          : userMessage.substring(1, userMessage.length - 1).trim();

        await webhook.send({
          content: `**${selectedChar.characterName} (OOC)**: ${oocContent}`,
          username: selectedChar.characterName,
          avatarURL: selectedChar.avatarUrl
        });
      } else if (isAction) {
        const actionContent = userMessage.startsWith('/action ')
          ? userMessage.substring(8).trim()
          : userMessage.substring(1, userMessage.length - 1).trim();

        await webhook.send({
          content: `*${selectedChar.characterName} ${actionContent}*`,
          username: selectedChar.characterName,
          avatarURL: selectedChar.avatarUrl
        });
      } else {
        await webhook.send({
          content: `**${selectedChar.characterName}**: ${userMessage}`,
          username: selectedChar.characterName,
          avatarURL: selectedChar.avatarUrl
        });
      }
    }
  } catch (error) {
    console.error('Message handler error:', error);
  }
}

module.exports = {
  handleInteractionCreate,
  handleMessageCreate
};
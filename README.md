# RP Bot - Discord Roleplay Bot

A Discord bot that allows you to create characters and roleplay in dedicated threads. When you speak in an RP thread, your message is deleted and the character "speaks" instead.

## Features

- 🎭 **Create Characters** - Build custom characters with names, descriptions, and avatars
- 🧵 **RP Threads** - Create dedicated threads for each roleplay session
- 🔐 **Invite-Only Threads** - Control who can participate in your RP threads
- 💬 **Auto Message Replacement** - User messages are deleted and reposted as the character
- 🔄 **Character Switching** - Change characters mid-RP with `/charchange`
- 🎬 **Action Handling** - Perform actions with `/action` or `*actions*`
- 🤐 **Out of Character** - Speak OOC with `//` or `()` without deletion
- 📋 **Character Management** - List and delete your characters

## Setup

### Prerequisites
- Node.js v18+ 
- A Discord Bot Token (from [Discord Developer Portal](https://discord.com/developers/applications))
- Discord Server with permissions to create threads
- A dedicated text channel for RP threads (can be named something like #rp-threads)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/RP-Bot.git
cd RP-Bot
```

2. Install dependencies:
```bash
npm install
```

4. Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

5. Set up an RP channel in your Discord server (a text channel dedicated to RP threads)

6. Add your Discord credentials to `.env`:
```
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here
DISCORD_RP_CHANNEL_ID=your_rp_channel_id_here
```
- `DISCORD_CLIENT_ID` is your app client ID from the Discord Developer Portal
- `DISCORD_GUILD_ID` is optional but recommended for fast, guild-specific slash command registration
- `DISCORD_RP_CHANNEL_ID` is the channel where RP threads will be created

(To get the channel ID, enable Developer Mode in Discord settings and right-click the channel)

7. Run the bot:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Commands

### `/createchar`
Creates a new character for roleplay.
- **name** - Character name (required)
- **description** - Character background/description (required)
- **avatar_url** - Character avatar URL (optional)

Example: `/createchar name:Luna description:A mysterious elf mage avatar_url:https://example.com/avatar.png`

### `/listchars`
Lists all your created characters.

### `/deletechar`
Deletes one of your characters.
- **character_name** - Name of the character to delete (required, autocomplete available)

### `/rpthread`
Creates an RP thread with one of your characters **in the designated RP channel** (can be run from anywhere).
- **character_name** - The character to use (required, autocomplete available)
- **thread_name** - Name for the RP thread (required)

Example: `/rpthread character_name:Luna thread_name:Forest Encounter`

Note: Even if you run this command in another channel, the thread will be created in the RP channel configured in the `.env` file.

### `/charchange`
Changes which character you're using in the current RP thread.
- **character_name** - The character to switch to (required, autocomplete available)

Example: `/charchange character_name:Luna`

## Message Types in RP Threads

### Dialogue
Type normally - your message is deleted and reposted as your character saying it.

Example: `Hello, how are you?`

### Actions
Start with `/action` or wrap in asterisks `*text*` to perform an action.

Examples:
- `/action walks across the room`
- `*sits down and sighs*`

The message appears in **orange** and is formatted as an action.

### Out of Character (OOC)
Wrap messages in `//` or parentheses `()` to speak out of character.

Examples:
- `// I need to step away for a moment`
- `(Sorry, I need to check something)`

The message appears in **gray** with **(OOC)** label and is not deleted.

## How It Works

1. Create a character using `/createchar`
2. Create an RP thread using `/rpthread` (can be used in **any channel**)
   - Thread is created in the designated RP channel
   - You're automatically invited to the thread
3. Other users trying to post in the thread will see an error telling them to request an invite
4. Users can request an invite by using `@username invite` format
5. You'll receive an invite request as a DM with accept/deny buttons
6. Once invited, users can start speaking in the thread
7. Use `/charchange` to switch characters mid-RP
8. Use actions with `/action` or `*action*`
9. Use `//` or `()` for out-of-character messages

## Invite System

RP Threads are **invite-only** by default:
- Only the thread creator and invited users can post in the thread
- To request an invite, non-members use: `@username invite`
  - Example: `@skyler invite`
- The thread creator receives an invite request as a DM
- They can accept or deny the request using the buttons
- Once accepted, the user can freely post in the thread

## Storage

- Character data is stored in `characters.json` locally
- Each user's characters are stored separately by their Discord ID

## Permissions Required

The bot needs the following permissions:
- Manage Threads
- Read Messages
- Send Messages
- Delete Messages
- Embed Links

## Troubleshooting

**Bot doesn't respond to commands:**
- Verify the bot is in the server
- Check that the bot has permissions in the channel
- Ensure `.env` variables are correct

**Commands don't appear:**
- Wait a few minutes for Discord to sync commands
- Restart the bot
- Check that `DISCORD_CLIENT_ID` is correct

**Character messages aren't being replaced:**
- Ensure the bot has "Delete Messages" permission
- Verify the thread was created with `/rpthread` command

## License

MIT

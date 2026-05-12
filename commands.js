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

module.exports = { commands };
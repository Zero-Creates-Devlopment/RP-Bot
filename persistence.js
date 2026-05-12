const fs = require('fs');
const path = require('path');

const charactersFile = path.join(__dirname, 'characters.json');
const threadsFile = path.join(__dirname, 'threads.json');

const characters = {};
const rpThreadsData = {};

function loadCharacters() {
  if (fs.existsSync(charactersFile)) {
    const data = fs.readFileSync(charactersFile, 'utf-8');
    Object.assign(characters, JSON.parse(data));
  }
}

function saveCharacters() {
  fs.writeFileSync(charactersFile, JSON.stringify(characters, null, 2));
}

function loadThreads() {
  if (fs.existsSync(threadsFile)) {
    const data = fs.readFileSync(threadsFile, 'utf-8');
    const loaded = JSON.parse(data);
    for (const threadId in loaded) {
      if (loaded[threadId].invited) {
        loaded[threadId].invited = new Set(loaded[threadId].invited);
      }
    }
    Object.assign(rpThreadsData, loaded);
  }
}

function saveThreads() {
  const toSave = {};
  for (const threadId in rpThreadsData) {
    toSave[threadId] = {
      ...rpThreadsData[threadId],
      invited: Array.from(rpThreadsData[threadId].invited || [])
    };
  }
  fs.writeFileSync(threadsFile, JSON.stringify(toSave, null, 2));
}

module.exports = {
  characters,
  rpThreadsData,
  loadCharacters,
  saveCharacters,
  loadThreads,
  saveThreads
};
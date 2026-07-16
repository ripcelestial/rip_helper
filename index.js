// index.js
require('dotenv').config();
const { startBot } = require('./src/app.js');
const { startWebServer } = require('./src/server.js');

// 1. Start the bot and get the client instance
const client = startBot();

// 2. Pass the client to the web server so it can interact with the bot
startWebServer(client);
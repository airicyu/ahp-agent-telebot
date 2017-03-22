'use strict';

var ahpbot = require('./src/ahpbot.js');
var secret = require('./config/secret.json');


ahpbot({
    telegramBotToken: secret.telegramBotToken
});
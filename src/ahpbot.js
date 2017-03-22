'use strict';

var store = require('./store.js');
var Intent = require('./intent.js');
var AHP = require('ahp');
var TelegramBot = require('node-telegram-bot-api');

function initChatSession() {
    /* initial */
    let chatSession = {
        initialized: true,
        ahpContext: new AHP(),
        intentType: Intent.INTENT_TYPES.SELECT_INTENT,
        intentContext: {
            chatId: null,
            botEditMsgId: null
        },
        chatChannelContext: {}
    }

    chatSession.reset = function () {
        let self = this;
        let chatId = self.chatChannelContext.chatId;

        self.initialized = true;
        self.ahpContext = new AHP();
        self.intentType = Intent.INTENT_TYPES.SELECT_INTENT;
        self.intentContext = {};
        self.chatChannelContext = {
            chatId: chatId,
            botEditMsgId: null
        };
    }.bind(chatSession);
    return chatSession;
}

function initDebugChatSession() {
    /* initial */
    let chatSession = {
        initialized: true,
        ahpContext: new AHP().import({
            items: ['vendor1', 'vendor2', 'vendor3'],
            criteria: ['price', 'usability', 'support'],
            criteriaItemRank: {
                price: [
                    [1, 1, 0.5],
                    [1, 1, 0.5],
                    [2, 2, 1]
                ],
                usability: [
                    [1, 1, 10],
                    [1, 1, 10],
                    [0.1, 0.1, 1]
                ],
                support: [
                    [1, 0.2, 0.2],
                    [5, 1, 1],
                    [5, 1, 1]
                ]
            },
            criteriaRank: [
                [1, 3, 2],
                [0.333, 1, 0.5],
                [0.5, 2, 1]
            ]
        }).export(),
        intentType: Intent.INTENT_TYPES.SELECT_INTENT,
        intentContext: {
            chatId: null,
            botEditMsgId: null
        },
        chatChannelContext: {}
    }

    chatSession.reset = function () {
        let self = this;
        let chatId = self.chatChannelContext.chatId;

        self.initialized = true;
        self.ahpContext = new AHP().import({
            items: ['vendor1', 'vendor2', 'vendor3'],
            criteria: ['price', 'usability', 'support'],
            criteriaItemRank: {
                price: [
                    [1, 1, 0.5],
                    [1, 1, 0.5],
                    [2, 2, 1]
                ],
                usability: [
                    [1, 1, 10],
                    [1, 1, 10],
                    [0.1, 0.1, 1]
                ],
                support: [
                    [1, 0.2, 0.2],
                    [5, 1, 1],
                    [5, 1, 1]
                ]
            },
            criteriaRank: [
                [1, 3, 2],
                [0.333, 1, 0.5],
                [0.5, 2, 1]
            ]
        }).export();
        self.intentType = Intent.INTENT_TYPES.SELECT_INTENT;
        self.intentContext = {};
        self.chatChannelContext = {
            chatId: chatId,
            botEditMsgId: null
        };
    }.bind(chatSession);
    return chatSession;
}

function initAhpBot(option) {
    var telegramBotToken = option.telegramBotToken;

    // Create a bot that uses 'polling' to fetch new updates
    let bot = this.bot = option.bot || new TelegramBot(telegramBotToken, {polling: true});
    bot.on('message', function (msg) {
        let chatId = msg.chat.id
        //console.log(msg);
        let chatSession = store.getChatSession(chatId);

        if (!chatSession.initialized) {
            chatSession = initChatSession();
            chatSession.chatChannelContext.chatId = chatId;
            chatSession.chatChannelContext.botEditMsgId = null;
            store.updateChatSession(chatId, chatSession);

            bot.sendMessage(chatId, `Hello ${msg.from.first_name || ''}! Welcome to use the AHP bot.`);
            return Intent.openIntent(Intent.INTENT_TYPES.SELECT_INTENT, msg, chatSession, {}, bot);
        }

        return Intent.forwardIntent(chatSession.intentType, msg, chatSession, chatSession.intentContext, bot);
    });

    bot.on('callback_query', function (msg) {
        let chatId = msg.message.chat.id;
        let chatSession = store.getChatSession(chatId);

        if (!chatSession.initialized) {
            chatSession = initChatSession();
            chatSession.chatChannelContext.chatId = chatId;
            chatSession.chatChannelContext.botEditMsgId = null;
            store.updateChatSession(chatId, chatSession);

            bot.sendMessage(chatId, `Hello ${msg.from.first_name || ''}! Welcome to use the AHP bot.`);
            return Intent.openIntent(Intent.INTENT_TYPES.SELECT_INTENT, msg, chatSession, {}, bot);
        }

        //check switching intent
        let handleIntentType = msg.data.split('::', 2)[0];
        if (handleIntentType !== chatSession.intentType) {
            chatSession.intentType = handleIntentType;
            store.updateChatSession(chatId, chatSession);
            return Intent.openIntent(handleIntentType, null, chatSession, {}, bot);
        }

        return Intent.forwardIntent(chatSession.intentType, msg, chatSession, chatSession.intentContext, bot);
    });

    bot.on('polling_error', (error) => {
        console.log(error.code); // => 'EFATAL'
    });

    return bot;
};

module.exports = initAhpBot.bind(initAhpBot);
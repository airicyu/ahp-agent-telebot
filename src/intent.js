'use strict';

var store = require('./store.js');
var AHP = require('ahp');
var ansUtil = require('./ansUtil.js');

const INTENT_TYPES = {
    "AUTO_FLOW_INTENT": "AUTO_FLOW_INTENT",
    "SELECT_INTENT": "SELECT_INTENT",
    "INPUT_ITEMS": "INPUT_ITEMS",
    "INPUT_CRITERIA": "INPUT_CRITERIA",
    "RANK_CRITERIA_ITEM": "RANK_CRITERIA_ITEM",
    "RANK_CRITERIA": "RANK_CRITERIA",
    "RUN": "RUN",
    "RESET": "RESET"
};

function debugLog() {
    console.log.apply(console, arguments);
}

class Intent {
    constructor() {}

    initResponse(msg, chatSession, bot) {}

    handleMsg(msg, chatSession, bot) {
        let self = this;
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        let formatAnswers = self.formatAnswers(chatSession);
        let flatternAnswers = self.flatternAnswers(chatSession);

        debugLog(`Intent handlingMsg, MsgId:${msgId}`);

        if (msg.data) {
            debugLog(`Intent handlingMsg, ChatId:${chatId}, MsgId:${msgId}, forward msg data to handleIntentData.`);
            return self.handleIntentData(msg.data, chatSession, bot, msg);
        } else if (msg.text && flatternAnswers && flatternAnswers.length > 0) {
            let answers = ansUtil.ansDistMap(flatternAnswers.map(ans => ans.text), msg.text);
            if (answers.length === 1) {
                let ansData = self.answerDataMap(chatSession)[answers[0].text];
                debugLog(`Intent handlingMsg, ChatId:${chatId}, MsgId:${msgId}, forward msg answer data to handleIntentData.`);
                return self.handleIntentData(ansData, chatSession, bot, msg);
            } else if (answers.length > 1) {
                let suggestAnswers = formatAnswers.filter((ansRow) => {
                    for (let ans of ansRow) {
                        if (answers.map(ans => ans.text).indexOf(ans.text) >= 0) {
                            return true;
                        }
                    }
                    return false;
                });
                debugLog(`Intent handlingMsg, ChatId:${chatId}, MsgId:${msgId}, answer is ambiguous and ask user for clarafication.`);
                return botSendMessage(bot, chatSession, "Do you mean these?", {
                    reply_markup: JSON.stringify({
                        keyboard: suggestAnswers,
                        one_time_keyboard: true
                    })
                });
            }
        } else if (msg.text && !flatternAnswers || flatternAnswers.length === 0) {
            debugLog(`Intent handlingMsg, ChatId:${chatId}, MsgId:${msgId}, forward msg text to handleIntentText.`);
            return self.handleIntentText(msg.text, chatSession, bot, msg);
        } else if (typeof msg === 'string') {
            return self.handleIntentText(msg, chatSession, bot, msg);
        }

        debugLog(`Intent handlingMsg, ChatId:${chatId}, MsgId:${msgId}, fallback handling with Auto Flow Intent.`);
        return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, null, chatSession, {}, bot);
    }

    handleIntentData(data, chatSession, bot, msg) {
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        let [handleIntentType, intentType] = data.split('::', 2);
        let intentClass = Intent.getIntentByType(intentType);
        if (intentClass) {
            chatSession.intentType = intentType;
            store.updateChatSession(chatId, chatSession);
            debugLog(`Intent handleIntentData, ChatId:${chatId}, MsgId:${msgId}, openning intent type:'${intentType}'`);
            return Intent.openIntent(intentType, msg, chatSession, {}, bot);
        } else {
            debugLog(`Intent handleIntentData, ChatId:${chatId}, MsgId:${msgId}, fallback handling with Auto Flow Intent.`);
            return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, msg, chatSession, {}, bot);
        }
    }

    handleIntentText(text, chatSession, bot, msg) {
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        debugLog(`Intent handleIntentText, ChatId:${chatId}, MsgId:${msgId}, fallback handling with Auto Flow Intent.`);
        return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, msg, chatSession, {}, bot);
    }

    static get INTENT_TYPES() {
        return INTENT_TYPES;
    }

    static getIntentByType(text) {
        switch (text) {
            case "AUTO_FLOW_INTENT":
                return IntentAutoFlow;
            case 'SELECT_INTENT':
                return IntentSelectIntent;
            case 'INPUT_ITEMS':
                return IntentInputItems;
            case 'INPUT_CRITERIA':
                return IntentInputCriteria;
            case 'RANK_CRITERIA_ITEM':
                return IntentRankCriteriaItem;
            case 'RANK_CRITERIA':
                return IntentRankCriteria;
            case 'RUN':
                return IntentRun;
            case 'RESET':
                return IntentReset;
            default:
                return null;
        }
    }

    static openIntent(intentType, msg, chatSession, intentContext, bot) {
        chatSession.intentType = intentType;
        chatSession.intentContext = intentContext || chatSession.intentContext || {};
        let chatId = chatSession.chatChannelContext.chatId;
        store.updateChatSession(chatId, chatSession);
        let intentClass = Intent.getIntentByType(intentType);
        let intentInstance = new intentClass(chatSession.intentContext);

        intentInstance.initResponse(msg, chatSession, bot);
    }

    static forwardIntent(intentType, msg, chatSession, intentContext, bot) {
        chatSession.intentType = intentType || chatSession.intentType;
        chatSession.intentContext = intentContext || chatSession.intentContext || {};
        let chatId = chatSession.chatChannelContext.chatId;
        store.updateChatSession(chatId, chatSession);
        let intentClass = Intent.getIntentByType(intentType);
        let intentInstance = new intentClass(chatSession.intentContext);
        intentInstance.handleMsg(msg, chatSession, bot);
    }

    static forwardDataToIntent(intentType, data, msg, chatSession, intentContext, bot) {
        chatSession.intentType = intentType || chatSession.intentType;
        chatSession.intentContext = intentContext || chatSession.intentContext || {};
        let chatId = chatSession.chatChannelContext.chatId;
        store.updateChatSession(chatId, chatSession);
        let intentClass = Intent.getIntentByType(intentType);
        let intentInstance = new intentClass(chatSession.intentContext);
        intentInstance.handleIntentData(data, chatSession, bot, msg);
    }

    formatAnswers(chatSession) {
        return chatSession.intentContext.currentQuestionAnswers || [];
    }

    flatternAnswers(chatSession) {
        return this.formatAnswers(chatSession).reduce((a, b) => {
            a.push.apply(a, b);
            return a;
        }, []);
    }

    answerDataMap(chatSession) {
        let map = {};
        this.flatternAnswers(chatSession).forEach(function (item) {
            map[item.text] = item.callback_data;
        });
        return map;
    }
}

class IntentAutoFlow extends Intent {
    constructor() {
        super();
        this.type = INTENT_TYPES.AUTO_FLOW_INTENT;
    }

    initResponse(msg, chatSession, bot) {
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        let ahpContext = chatSession.ahpContext;

        if (chatSession.ahpContext.items.length === 0) {
            chatSession.intentType = Intent.INTENT_TYPES.INPUT_ITEMS;
            store.updateChatSession(chatId, chatSession);
            debugLog(`Intent IntentAutoFlow initResponse, ChatId:${chatId}, MsgId:${msgId}, open intent type '${Intent.INTENT_TYPES.INPUT_ITEMS}'`);
            return Intent.openIntent(Intent.INTENT_TYPES.INPUT_ITEMS, null, chatSession, {}, bot);
        } else if (chatSession.ahpContext.criteria.length === 0) {
            chatSession.intentType = Intent.INTENT_TYPES.INPUT_CRITERIA;
            store.updateChatSession(chatId, chatSession);
            debugLog(`Intent IntentAutoFlow initResponse, ChatId:${chatId}, MsgId:${msgId}, open intent type '${Intent.INTENT_TYPES.INPUT_CRITERIA}'`);
            return Intent.openIntent(Intent.INTENT_TYPES.INPUT_CRITERIA, null, chatSession, {}, bot);
        } else {
            let {
                error
            } = new AHP().import(ahpContext).run();
            if (error) {
                debugLog(`Intent IntentAutoFlow initResponse, ChatId:${chatId}, MsgId:${msgId}, checked context error type:'${error.type}'`);
                if (error.type === 'NO_ITEM') {
                    return botSendMessage(bot, chatSession, 'We find that there are <b>no Options defined</b>. It would be nice if you would let me ask you some questions to fill the analysis context.', {
                            parse_mode: 'HTML'
                        })
                        .then(function (sentMsg) {
                            return Intent.openIntent(Intent.INTENT_TYPES.INPUT_ITEMS, null, chatSession, {}, bot);
                        });
                } else if (error.type === 'NO_CRITERIA') {
                    return botSendMessage(bot, chatSession, 'We find that there are <b>no Criteria defined</b>. It would be nice if you would let me ask you some questions to fill the analysis context.', {
                            parse_mode: 'HTML'
                        })
                        .then(function (sentMsg) {
                            return Intent.openIntent(Intent.INTENT_TYPES.INPUT_CRITERIA, null, chatSession, {}, bot);
                        });
                } else if (error.type === 'MISSING_CRITERIA_ITEM_RANK') {
                    let intentContext = {
                        criterion: error.context.criterion,
                        items: [error.context.itemA, error.context.itemB]
                    };
                    return botSendMessage(bot, chatSession, 'We find the <b>Criteria based Option Ranking matrix is not filled</b> yet. It would be nice if you would let me ask you some questions to fill the analysis context.', {
                            parse_mode: 'HTML'
                        })
                        .then(function (sentMsg) {
                            return Intent.openIntent(Intent.INTENT_TYPES.RANK_CRITERIA_ITEM, null, chatSession, intentContext, bot);
                        });
                } else if (error.type === 'MISSING_CRITERIA_RANK') {
                    let intentContext = {
                        criteria: [error.context.criterionA, error.context.criterionB]
                    };
                    return botSendMessage(bot, chatSession, 'We find the <b>Criteria Ranking matrix is not filled</b> yet. It would be nice if you would let me ask you some questions to fill the analysis context.', {
                            parse_mode: 'HTML'
                        })
                        .then(function (sentMsg) {
                            return Intent.openIntent(Intent.INTENT_TYPES.RANK_CRITERIA, null, chatSession, intentContext, bot);
                        });
                } else if (error.type === 'CRITERIA_ITEM_RANK_INSUFFICIENT_CONSISTENCY_RATIO') {
                    return botSendMessage(bot, chatSession, 'Sorry but we find that <b>Criteria Item Ranking matrix Consistency Ratio > 0.1</b>. It looks like you have made inconsistent preferences. Please review the preferences again.', {
                            parse_mode: 'HTML'
                        })
                        .then(function (sentMsg) {
                            ahpContext = chatSession.ahpContext = new AHP().import(ahpContext).resetCriteriaItemRank([error.context.criterion]).export();
                            store.updateChatSession(chatId, chatSession);

                            let intentContext = {
                                criterion: error.context.criterion,
                                items: [ahpContext.items[0], ahpContext.items[1]]
                            };
                            return Intent.openIntent(Intent.INTENT_TYPES.RANK_CRITERIA_ITEM, null, chatSession, intentContext, bot);
                        });
                } else if (error.type === 'CRITERIA_RANK_INSUFFICIENT_CONSISTENCY_RATIO') {
                    return botSendMessage(bot, chatSession, 'Sorry but we find that <b>Criteria Ranking matrix Consistency Ratio > 0.1</b>. It looks like you have made inconsistent preferences. Please review the preferences again.', {
                            parse_mode: 'HTML'
                        })
                        .then(function (sentMsg) {
                            ahpContext = chatSession.ahpContext = new AHP().import(ahpContext).resetCriteriaRank().export();
                            store.updateChatSession(chatId, chatSession);

                            let intentContext = {
                                criteria: [ahpContext.criteria[0], ahpContext.criteria[1]]
                            };
                            return Intent.openIntent(Intent.INTENT_TYPES.RANK_CRITERIA, null, chatSession, intentContext, bot);
                        });
                }
            }
        }
        chatSession.intentType = Intent.INTENT_TYPES.SELECT_INTENT;
        store.updateChatSession(chatId, chatSession);
        debugLog(`Intent IntentAutoFlow initResponse, ChatId:${chatId}, MsgId:${msgId}, everything is ok, let user choose actions.`);
        return Intent.openIntent(Intent.INTENT_TYPES.SELECT_INTENT, null, chatSession, {}, bot);
    }
}


class IntentReset extends Intent {
    constructor() {
        super();
        this.type = INTENT_TYPES.RESET;
    }

    formatAnswers() {
        return [
            [{
                text: 'Yes',
                callback_data: `${INTENT_TYPES.RESET}::yes`
            }],
            [{
                text: 'No',
                callback_data: `${INTENT_TYPES.RESET}::no`
            }],
        ];
    }

    initResponse(msg, chatSession, bot) {
        let self = this;
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        var options = {
            reply_markup: JSON.stringify({
                keyboard: self.formatAnswers(),
                one_time_keyboard: true
            })
        };
        debugLog(`Intent IntentReset initResponse, ChatId:${chatId}, MsgId:${msgId}, Ask user confirm restart.`);
        return botSendMessage(bot, chatSession, "Would you want to restart the session?", options);
    }

    handleIntentData(msgData, chatSession, bot, msg) {
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        let [handleIntentType, data] = msgData.split('::', 2);
        if (data === 'yes') {
            debugLog(`Intent IntentReset handleIntentData, ChatId:${chatId}, MsgId:${msgId}, User confirmed restart session.`);
            chatSession.reset();
        }
        chatSession.intentType = INTENT_TYPES.SELECT_INTENT;
        store.updateChatSession(chatId, chatSession);
        debugLog(`Intent IntentReset handleIntentData, ChatId:${chatId}, MsgId:${msgId}, User cancelled restart session.`);
        return Intent.openIntent(Intent.INTENT_TYPES.SELECT_INTENT, null, chatSession, {}, bot);
    }
}

class IntentSelectIntent extends Intent {
    constructor() {
        super();
        this.type = INTENT_TYPES.SELECT_INTENT;
    }

    formatAnswers() {
        return [
            [{
                text: 'Add Options',
                callback_data: `${INTENT_TYPES.SELECT_INTENT}::${INTENT_TYPES.INPUT_ITEMS}`
            }],
            [{
                text: 'Add Criteria',
                callback_data: `${INTENT_TYPES.SELECT_INTENT}::${INTENT_TYPES.INPUT_CRITERIA}`
            }],
            [{
                text: 'Rank Options per Criterion',
                callback_data: `${INTENT_TYPES.SELECT_INTENT}::${INTENT_TYPES.RANK_CRITERIA_ITEM}`
            }],
            [{
                text: 'Rank Criteria',
                callback_data: `${INTENT_TYPES.SELECT_INTENT}::${INTENT_TYPES.RANK_CRITERIA}`
            }],
            [{
                text: 'Run Result',
                callback_data: `${INTENT_TYPES.SELECT_INTENT}::${INTENT_TYPES.RUN}`
            }],
            [{
                text: 'Restart session',
                callback_data: `${INTENT_TYPES.SELECT_INTENT}::${INTENT_TYPES.RESET}`
            }]
        ];
    }

    initResponse(msg, chatSession, bot) {
        let self = this;
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        let options = {
            reply_markup: JSON.stringify({
                keyboard: self.formatAnswers(),
                one_time_keyboard: true
            })
        };
        debugLog(`Intent IntentSelectIntent initResponse, ChatId:${chatId}, MsgId:${msgId}, Ask user intent.`);
        return botSendMessage(bot, chatSession, "Can I help you?", options);
    }

    handleIntentData(data, chatSession, bot, msg) {
        let self = this;
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        let [handleIntentType, intentType] = data.split('::', 2);
        let intentClass = Intent.getIntentByType(intentType);
        if (intentClass) {
            chatSession.intentType = intentType;
            store.updateChatSession(chatId, chatSession);
            debugLog(`Intent IntentSelectIntent handleIntentData, ChatId:${chatId}, MsgId:${msgId}, open intent type '${intentType}.'`);
            return Intent.openIntent(intentType, null, chatSession, {}, bot);
        } else {
            debugLog(`Intent IntentSelectIntent handleIntentData, ChatId:${chatId}, MsgId:${msgId}, cannot understand user input, ask again.`);
            return Intent.openIntent(Intent.INTENT_TYPES.SELECT_INTENT, null, chatSession, {}, bot);
        }
    }
}

class IntentInputItems extends Intent {
    constructor() {
        super();
        this.type = INTENT_TYPES.INPUT_ITEMS;
    }

    initResponse(msg, chatSession, bot) {
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        debugLog(`Intent IntentInputItems initResponse, ChatId:${chatId}, MsgId:${msgId}, ask user for input items.`);
        return botSendMessage(bot, chatSession, "May you please input the <b>Options</b>?\n(e.g: choice1,choice2,choice3) (type <i>return</i> to go back)", {
                parse_mode: 'HTML'
            })
            .then(function (sentMsg) {});
    }

    handleIntentText(text, chatSession, bot, msg) {
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        if (text.trim() === 'return') {
            debugLog(`Intent IntentInputItems handleIntentText, ChatId:${chatId}, MsgId:${msgId}, user cancel operation and return to select intent.`);
            return Intent.openIntent(Intent.INTENT_TYPES.SELECT_INTENT, null, chatSession, {}, bot);
        }
        let items = text.split(',').map(a => a.trim()).filter(a => a.length > 0);
        let ahpContext = new AHP().import(chatSession.ahpContext);
        ahpContext.addItems(items);
        chatSession.ahpContext = ahpContext.export();
        store.updateChatSession(chatId, chatSession);
        debugLog(`Intent IntentInputItems handleIntentText, ChatId:${chatId}, MsgId:${msgId}, adding options from user input.`);
        return botSendMessage(bot, chatSession, "OK! The Options are " + chatSession.ahpContext.items.map((item, i) => `(${i + 1}) ${item}`).join(', ') + ".", {})
            .then(function (sentMsg) {
                return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, null, chatSession, {}, bot);
            });
    }
}

class IntentInputCriteria extends Intent {
    constructor() {
        super();
        this.type = INTENT_TYPES.INPUT_CRITERIA;
    }

    initResponse(msg, chatSession, bot) {
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        debugLog(`Intent IntentInputCriteria initResponse, ChatId:${chatId}, MsgId:${msgId}, ask user for input criteria.`);
        return botSendMessage(bot, chatSession, 'May you please input the <b>Criteria</b>?\n(e.g: criteriaA,criteriaB,criteriaC) (type <i>return</i> to go back)', {
                parse_mode: 'HTML'
            })
            .then(function (sentMsg) {});
    }

    handleIntentText(text, chatSession, bot, msg) {
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        if (text.trim() === 'return') {
            debugLog(`Intent IntentInputCriteria handleIntentText, ChatId:${chatId}, MsgId:${msgId}, user cancel operation and return to select intent.`);
            return Intent.openIntent(Intent.INTENT_TYPES.SELECT_INTENT, null, chatSession, {}, bot);
        }

        let criteria = text.split(',').map(a => a.trim()).filter(a => a.length > 0);
        let ahpContext = new AHP().import(chatSession.ahpContext);
        ahpContext.addCriteria(criteria);
        chatSession.ahpContext = ahpContext.export();
        store.updateChatSession(chatId, chatSession);
        debugLog(`Intent IntentInputCriteria handleIntentText, ChatId:${chatId}, MsgId:${msgId}, adding criteria from user input.`);
        return botSendMessage(bot, chatSession, 'OK! The Criteria are ' + chatSession.ahpContext.criteria.map((criterion, i) => `(${i + 1}) ${criterion}`).join(', ') + ".", {})
            .then(function (sentMsg) {
                return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, null, chatSession, {}, bot);
            });
    }
}

class IntentRankCriteriaItem extends Intent {
    constructor(context) {
        super(context);
        context.criterion = context.criterion || null;
        context.items = context.items || [];
        context.preferredItem = context.preferredItem || null;
        context.rank = context.rank || null;

        this.type = INTENT_TYPES.RANK_CRITERIA_ITEM;
    }

    /* for look up reference */
    context() {
        return {
            criterion: null,
            items: [],
            preferredItem: null,
            rank: null
        }
    }

    initResponse(msg, chatSession, bot) {
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        let ahpContext = chatSession.ahpContext;
        let intentContext = chatSession.intentContext;

        if (chatSession.ahpContext.criteria.length && chatSession.ahpContext.items.length > 0) {

            if (!intentContext.criterion) {
                intentContext.currentQuestionAnswers = appendDefaultInlineOptions(ahpContext.criteria.map(criterion => {
                    return [{
                        text: criterion,
                        callback_data: `${INTENT_TYPES.RANK_CRITERIA_ITEM}::SELECT_CRITERION::${criterion}`
                    }];
                }));
                store.updateChatSession(chatId, chatSession);
                let options = {
                    reply_markup: JSON.stringify({
                        keyboard: intentContext.questionAnswers,
                        one_time_keyboard: true
                    }),
                    parse_mode: 'HTML'
                };
                debugLog(`Intent IntentRankCriteriaItem initResponse, ChatId:${chatId}, MsgId:${msgId}, ask user for criteria for ranking items.`);
                return botSendMessage(bot, chatSession, "Which <b>criteria</b> do you want to use for ranking Options? ", options);
            } else if (intentContext.items.length === 0) {
                intentContext.currentQuestionAnswers = appendDefaultInlineOptions(ahpContext.items.map(item => {
                    return [{
                        text: item,
                        callback_data: `${INTENT_TYPES.RANK_CRITERIA_ITEM}::SELECT_ITEM::${item}`
                    }];
                }));
                store.updateChatSession(chatId, chatSession);
                let options = {
                    reply_markup: JSON.stringify({
                        keyboard: intentContext.currentQuestionAnswers,
                        one_time_keyboard: true
                    }),
                    parse_mode: 'HTML'
                };
                debugLog(`Intent IntentRankCriteriaItem initResponse, ChatId:${chatId}, MsgId:${msgId}, ask user for selecting ranking item.`);
                return botSendMessage(bot, chatSession, "Please let me know a <b>Option</b> you want to rank?", options);
            } else if (intentContext.items.length === 1) {
                intentContext.currentQuestionAnswers = appendDefaultInlineOptions(ahpContext.items.filter(item => item !== intentContext.items[0]).map(item => {
                    return [{
                        text: item,
                        callback_data: `${INTENT_TYPES.RANK_CRITERIA_ITEM}::SELECT_ITEM::${item}`
                    }];
                }));
                store.updateChatSession(chatId, chatSession);
                let options = {
                    reply_markup: JSON.stringify({
                        keyboard: intentContext.currentQuestionAnswers,
                        one_time_keyboard: true
                    }),
                    parse_mode: 'HTML'
                };
                debugLog(`Intent IntentRankCriteriaItem initResponse, ChatId:${chatId}, MsgId:${msgId}, ask user for selecting another ranking item.`);
                return botSendMessage(bot, chatSession, "Please let me know another <b>Option</b> you want to rank?", options);
            } else if (!intentContext.preferredItem) {
                let inlineOptions = intentContext.items.map(item => {
                    return [{
                        text: item,
                        callback_data: `${INTENT_TYPES.RANK_CRITERIA_ITEM}::SELECT_PREFERRED_ITEM::${item}`
                    }];
                });
                inlineOptions.push([{
                    text: 'Equally preferred.',
                    callback_data: `${INTENT_TYPES.RANK_CRITERIA_ITEM}::SELECT_PREFERRED_ITEM::EQUAL`
                }]);

                intentContext.currentQuestionAnswers = appendDefaultInlineOptions(inlineOptions);
                store.updateChatSession(chatId, chatSession);

                let options = {
                    reply_markup: JSON.stringify({
                        keyboard: intentContext.currentQuestionAnswers,
                        one_time_keyboard: true
                    }),
                    parse_mode: 'HTML'
                };
                debugLog(`Intent IntentRankCriteriaItem initResponse, ChatId:${chatId}, MsgId:${msgId}, ask user for selecting preferred item.`);
                return botSendMessage(bot, chatSession, `Base on Criterion <b>'${intentContext.criterion}'</b>, among Option <b>'${intentContext.items[0]}'</b> & <b>'${intentContext.items[1]}'</b>, which one do you prefer more?`, options);
            } else if (!intentContext.rank) {
                intentContext.currentQuestionAnswers = appendDefaultInlineOptions(getScaleInlineKeyboardOptions(INTENT_TYPES.RANK_CRITERIA_ITEM));
                let options = {
                    reply_markup: JSON.stringify({
                        keyboard: intentContext.currentQuestionAnswers,
                        one_time_keyboard: true
                    }),
                    parse_mode: 'HTML'
                };
                store.updateChatSession(chatId, chatSession);
                let scaleDescription = getScaleDescriptions();
                debugLog(`Intent IntentRankCriteriaItem initResponse, ChatId:${chatId}, MsgId:${msgId}, ask user for item preference scale.`);
                return botSendMessage(bot, chatSession, `Base on Criterion <b>'${intentContext.criterion}'</b>, what scale do you rank Option <b>'${intentContext.items[0]}'</b> over <b>'${intentContext.items[1]}'</b>?\n\n${scaleDescription}`, options);
            } else {
                let compareItem = intentContext.preferredItem === intentContext.items[0] ? intentContext.items[1] : intentContext.items[0];
                chatSession.ahpContext = new AHP().import(ahpContext).rankCriteriaItem(intentContext.criterion, [
                    [intentContext.preferredItem, compareItem, intentContext.rank]
                ]).export()
                store.updateChatSession(chatId, chatSession);
                debugLog(`Intent IntentRankCriteriaItem initResponse, ChatId:${chatId}, MsgId:${msgId}, updated criteria item rank.`);
                let replyMsg = '';
                if (intentContext.rank !== 1){
                    replyMsg = `* Updated Criterion(${intentContext.criterion}) Option Rank: You prefer Option <b>'${intentContext.preferredItem}'</b> over <b>'${compareItem}'</b> with rank scale ${intentContext.rank}.`;
                } else {
                    replyMsg = `* Updated Criterion(${intentContext.criterion}) Option Rank: Option <b>'${intentContext.preferredItem}'</b> and <b>'${compareItem}'</b> has equally importance. (rank scale 1)`;
                }
                return botSendMessage(bot, chatSession, replyMsg, {
                        parse_mode: 'HTML'
                    })
                    .then(function (sentMsg) {
                        return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, null, chatSession, {}, bot);
                    });
            }
        }

        return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, null, chatSession, {}, bot);
    }

    handleIntentData(msgData, chatSession, bot, msg) {
        let self = this;
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        let ahpContext = chatSession.ahpContext;
        let intentContext = chatSession.intentContext;

        let [handleIntentType, intentAction, data] = msgData.split('::');

        if (handleIntentType !== self.type){
            return Intent.forwardDataToIntent(handleIntentType, msgData, msg, chatSession, {}, bot);
        }

        if (intentAction === 'SELECT_CRITERION') {
            intentContext.criterion = data;
        } else if (intentAction === 'SELECT_ITEM') {
            if (intentContext.items.length < 2) {
                intentContext.items.push(data);
            }
        } else if (intentAction === 'SELECT_PREFERRED_ITEM') {
            if (data === 'EQUAL') {
                intentContext.preferredItem = intentContext.items[0];
                intentContext.rank = 1;
            } else {
                intentContext.preferredItem = data;
            }
        } else if (intentAction === 'SELECT_RANK') {
            intentContext.rank = data;
        }
        store.updateChatSession(chatId, chatSession);

        if (intentContext.criterion && intentContext.items.length >= 2 && intentContext.preferredItem && intentContext.rank) {
            let compareItem = (intentContext.preferredItem === intentContext.items[0] ? intentContext.items[1] : intentContext.items[0]);
            chatSession.ahpContext = new AHP().import(ahpContext).rankCriteriaItem(intentContext.criterion, [
                [intentContext.preferredItem, compareItem, intentContext.rank]
            ]).export()
            store.updateChatSession(chatId, chatSession);
            debugLog(`Intent IntentRankCriteriaItem handleIntentData, ChatId:${chatId}, MsgId:${msgId}, updated criteria item rank.`);
            let replyMsg = '';
            if (intentContext.rank !== 1){
                replyMsg = `* Updated Criterion(${intentContext.criterion}) Option Rank: You prefer Option <b>'${intentContext.preferredItem}'</b> over <b>'${compareItem}'</b> with rank scale ${intentContext.rank}.`;
            } else {
                replyMsg = `* Updated Criterion(${intentContext.criterion}) Option Rank: Option <b>'${intentContext.preferredItem}'</b> and <b>'${compareItem}'</b> has equally importance. (rank scale 1)`;
            }
            return botSendMessage(bot, chatSession, replyMsg, {
                    parse_mode: 'HTML'
                })
                .then(function (sentMsg) {
                    return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, null, chatSession, {}, bot);
                });
        } else {
            debugLog(`Intent IntentRankCriteriaItem handleIntentData, ChatId:${chatId}, MsgId:${msgId}, intent context not completed yet, ask question to user to proceed.`);
            return Intent.openIntent(Intent.INTENT_TYPES.RANK_CRITERIA_ITEM, null, chatSession, chatSession.intentContext, bot);
        }
    }
}

class IntentRankCriteria extends Intent {
    constructor(context) {
        super(context);
        context.criteria = context.criteria || [];
        context.preferredCriterion = context.preferredCriterion || null;
        context.rank = context.rank || null;

        this.type = INTENT_TYPES.RANK_CRITERIA;
    }

    /* for look up reference */
    context() {
        return {
            criteria: [],
            preferredCriterion: null,
            rank: null
        }
    }

    initResponse(msg, chatSession, bot) {
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        let ahpContext = chatSession.ahpContext;
        let intentContext = chatSession.intentContext;
        if (chatSession.ahpContext.criteria.length > 0) {

            if (intentContext.criteria.length === 0) {
                intentContext.currentQuestionAnswers = appendDefaultInlineOptions(ahpContext.criteria.map(criterion => {
                    return [{
                        text: criterion,
                        callback_data: `${INTENT_TYPES.RANK_CRITERIA}::SELECT_CRITERION::${criterion}`
                    }];
                }));
                store.updateChatSession(chatId, chatSession);
                let options = {
                    reply_markup: JSON.stringify({
                        keyboard: intentContext.currentQuestionAnswers,
                        one_time_keyboard: true
                    }),
                    parse_mode: 'HTML'
                };
                debugLog(`Intent IntentRankCriteria initResponse, ChatId:${chatId}, MsgId:${msgId}, ask user for selecting ranking criteria.`);
                return botSendMessage(bot, chatSession, "Please let me know a <b>Criterion</b> you want to rank? ", options);
            } else if (intentContext.criteria.length === 1) {
                intentContext.currentQuestionAnswers = appendDefaultInlineOptions(ahpContext.criteria.filter(criterion => criterion !== intentContext.criteria[0]).map(criterion => {
                    return [{
                        text: criterion,
                        callback_data: `${INTENT_TYPES.RANK_CRITERIA}::SELECT_CRITERION::${criterion}`
                    }];
                }));
                store.updateChatSession(chatId, chatSession);
                let options = {
                    reply_markup: JSON.stringify({
                        keyboard: intentContext.currentQuestionAnswers,
                        one_time_keyboard: true
                    }),
                    parse_mode: 'HTML'
                };
                debugLog(`Intent IntentRankCriteria initResponse, ChatId:${chatId}, MsgId:${msgId}, ask user for selecting ranking another criteria.`);
                return botSendMessage(bot, chatSession, "Please let me know another <b>Criterion</b> you want to rank? ", options);
            } else if (!intentContext.preferredCriterion) {
                let inlineOptions = intentContext.criteria.map(criterion => {
                    return [{
                        text: criterion,
                        callback_data: `${INTENT_TYPES.RANK_CRITERIA}::SELECT_PREFERRED_CRITERION::${criterion}`
                    }];
                });
                inlineOptions.push([{
                    text: 'Equally preferred.',
                    callback_data: `${INTENT_TYPES.RANK_CRITERIA}::SELECT_PREFERRED_CRITERION::EQUAL`
                }]);
                intentContext.currentQuestionAnswers = appendDefaultInlineOptions(inlineOptions);
                store.updateChatSession(chatId, chatSession);
                let options = {
                    reply_markup: JSON.stringify({
                        keyboard: intentContext.currentQuestionAnswers,
                        one_time_keyboard: true
                    }),
                    parse_mode: 'HTML'
                };
                debugLog(`Intent IntentRankCriteria initResponse, ChatId:${chatId}, MsgId:${msgId}, ask user for selecting preferred criteria.`);
                return botSendMessage(bot, chatSession, `Among Criterion <b>'${intentContext.criteria[0]}'</b> & <b>'${intentContext.criteria[1]}'</b>, which one do you prefer more?`, options);
            } else if (!intentContext.rank) {
                intentContext.currentQuestionAnswers = appendDefaultInlineOptions(getScaleInlineKeyboardOptions(INTENT_TYPES.RANK_CRITERIA));
                store.updateChatSession(chatId, chatSession);
                let options = {
                    reply_markup: JSON.stringify({
                        keyboard: intentContext.currentQuestionAnswers,
                        one_time_keyboard: true
                    }),
                    parse_mode: 'HTML'
                };
                let scaleDescription = getScaleDescriptions();
                debugLog(`Intent IntentRankCriteria initResponse, ChatId:${chatId}, MsgId:${msgId}, ask user for criteria preference scale.`);
                return botSendMessage(bot, chatSession, `What scale do you rank Criterion <b>'${intentContext.criteria[0]}'</b> over <b>'${intentContext.criteria[1]}'</b>?\n\n${scaleDescription}`, options);
            } else {
                let compareCriterion = intentContext.preferredCriterion === intentContext.criteria[0] ? intentContext.criteria[1] : intentContext.criteria[0];
                chatSession.ahpContext = new AHP().import(ahpContext).rankCriteria([
                    [intentContext.preferredCriterion, compareCriterion, intentContext.rank]
                ]).export()
                store.updateChatSession(chatId, chatSession);
                debugLog(`Intent IntentRankCriteria initResponse, ChatId:${chatId}, MsgId:${msgId}, updated criteria rank.`);
                let replyMsg = '';
                if (intentContext.rank !== 1){
                    replyMsg = `* Updated Criteria Rank for Criterion <b>'${intentContext.preferredCriterion}'</b> over <b>'${compareCriterion}'</b> with rank scale ${intentContext.rank}.`;
                } else {
                    replyMsg = `* Updated Criteria Rank for Criterion <b>'${intentContext.preferredCriterion}'</b> and <b>'${compareCriterion}'</b> with equally importance. (rank scale 1)`;
                }
                return botSendMessage(bot, chatSession, replyMsg, {
                        parse_mode: 'HTML'
                    })
                    .then(function (sentMsg) {
                        return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, null, chatSession, {}, bot);
                    });
            }
        }

        return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, null, chatSession, {}, bot);
    }

    handleIntentData(msgData, chatSession, bot, msg) {
        let self = this;
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        let ahpContext = chatSession.ahpContext;
        let intentContext = chatSession.intentContext;

        let [handleIntentType, intentAction, data] = msgData.split('::');
        if (handleIntentType !== self.type){
            return Intent.forwardDataToIntent(handleIntentType, msgData, msg, chatSession, {}, bot);
        }

        if (intentAction === 'SELECT_CRITERION') {
            if (intentContext.criteria.length < 2) {
                intentContext.criteria.push(data);
            }
        } else if (intentAction === 'SELECT_PREFERRED_CRITERION') {
            if (data === 'EQUAL') {
                intentContext.preferredCriterion = intentContext.criteria[0];
                intentContext.rank = 1;
            } else {
                intentContext.preferredCriterion = data;
            }
        } else if (intentAction === 'SELECT_RANK') {
            intentContext.rank = data;
        }
        store.updateChatSession(chatId, chatSession);

        if (intentContext.criteria.length >= 2 && intentContext.preferredCriterion && intentContext.rank) {
            let compareCriterion = intentContext.preferredCriterion === intentContext.criteria[0] ? intentContext.criteria[1] : intentContext.criteria[0];
            chatSession.ahpContext = new AHP().import(ahpContext).rankCriteria([
                [intentContext.preferredCriterion, compareCriterion, intentContext.rank]
            ]).export()
            store.updateChatSession(chatId, chatSession);
            debugLog(`Intent IntentRankCriteria initResponse, ChatId:${chatId}, MsgId:${msgId}, updated criteria rank.`);
            let replyMsg = '';
            if (intentContext.rank !== 1){
                replyMsg = `* Updated Criteria Rank for Criterion <b>'${intentContext.preferredCriterion}'</b> over <b>'${compareCriterion}'</b> with rank scale ${intentContext.rank}.`;
            } else {
                replyMsg = `* Updated Criteria Rank for Criterion <b>'${intentContext.preferredCriterion}'</b> and <b>'${compareCriterion}'</b> with equally importance. (rank scale 1)`;
            }
            return botSendMessage(bot, chatSession, replyMsg, {
                    parse_mode: 'HTML'
                })
                .then(function (sentMsg) {
                    return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, null, chatSession, {}, bot);
                });
        } else {
            debugLog(`Intent IntentRankCriteria handleIntentData, ChatId:${chatId}, MsgId:${msgId}, intent context not completed yet, ask question to user to proceed.`);
            return Intent.openIntent(Intent.INTENT_TYPES.RANK_CRITERIA, null, chatSession, chatSession.intentContext, bot);
        }
    }
}

class IntentRun extends Intent {
    constructor(context) {
        super(context);
        this.type = INTENT_TYPES.RUN;
    }

    outputAHPResult(ahpContext, rankingMatrix, itemRankMetaMap, criteriaRankMetaMap, rankedScoreMap) {
        let self = this;

        let itemCriteriaScoreMatrixPrint = AHP.print2DMatrixAsStr(rankingMatrix, ahpContext.criteria, ahpContext.items, 5);
        let rankedScores = ahpContext.items.map(item => rankedScoreMap[item]);
        let criteriaWeightMatrixPrint = AHP.print2DMatrixAsStr(numeric.transpose([criteriaRankMetaMap.weightedVector]), ['Weight'], ahpContext.criteria, 5);
        let itemOverallScoreMatrixPrint = AHP.print2DMatrixAsStr(numeric.transpose([rankedScores]), ['Score'], ahpContext.items, 5);
        let output = '```text';
        output += 'Item-Criteria Score Matrix:\n';
        output += `${itemCriteriaScoreMatrixPrint}\n\n`;
        output += 'Criteria Weight:\n';
        output += `${criteriaWeightMatrixPrint}\n\n`;
        output += 'Item Overall Score Matrix:\n';
        output += `${itemOverallScoreMatrixPrint}\n`;
        output += '```'
        return output;
    }

    initResponse(msg, chatSession, bot) {
        let self = this;
        let msgId = msg && msg.message_id || null;
        let chatId = chatSession.chatChannelContext.chatId;
        let ahpContext = chatSession.ahpContext;
        let {
            error,
            rankingMatrix,
            itemRankMetaMap,
            criteriaRankMetaMap,
            rankedScoreMap
        } = new AHP().import(ahpContext).run();

        if (!error) {
            let replyMsg = self.outputAHPResult(ahpContext, rankingMatrix, itemRankMetaMap, criteriaRankMetaMap, rankedScoreMap);
            debugLog(`Intent IntentRun initResponse, ChatId:${chatId}, MsgId:${msgId}, tested without errors, run the AHP analysis.`);
            return botSendMessage(bot, chatSession, replyMsg, {
                parse_mode: 'Markdown'
            }).then(function (sentMsg) {
                return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, null, chatSession, {}, bot);
            });
        } else {
            debugLog(`Intent IntentRun initResponse, ChatId:${chatId}, MsgId:${msgId}, checked context error type:'${error.type}'`);
            if (error.type === 'NO_ITEM') {
                return botSendMessage(bot, chatSession, 'Sorry but there are missing information in the analysis context. We cannot proceed if there are <b>no Options defined</b>.', {
                        parse_mode: 'HTML'
                    })
                    .then(function (sentMsg) {
                        return Intent.openIntent(Intent.INTENT_TYPES.INPUT_ITEMS, null, chatSession, {}, bot);
                    });
            } else if (error.type === 'NO_CRITERIA') {
                return botSendMessage(bot, chatSession, 'Sorry but there are missing information in the analysis context. We cannot proceed if there are <b>no Criteria defined</b>.', {
                        parse_mode: 'HTML'
                    })
                    .then(function (sentMsg) {
                        return Intent.openIntent(Intent.INTENT_TYPES.INPUT_CRITERIA, null, chatSession, {}, bot);
                    });
            } else if (error.type === 'MISSING_CRITERIA_ITEM_RANK') {
                return botSendMessage(bot, chatSession, 'Sorry but there are missing information in the analysis context. We cannot proceed if the <b>Criteria based Option Ranking matrix is not filled</b> yet.', {
                        parse_mode: 'HTML'
                    })
                    .then(function (sentMsg) {
                        let intentContext = {
                            criterion: error.context.criterion,
                            items: [error.context.itemA, error.context.itemB]
                        };
                        return Intent.openIntent(Intent.INTENT_TYPES.RANK_CRITERIA_ITEM, null, chatSession, intentContext, bot);
                    });
            } else if (error.type === 'MISSING_CRITERIA_RANK') {
                return botSendMessage(bot, chatSession, 'Sorry but there are missing information in the analysis context. We cannot proceed if the <b>Criteria Ranking matrix is not filled</b> yet.', {
                        parse_mode: 'HTML'
                    })
                    .then(function (sentMsg) {
                        let intentContext = {
                            criteria: [error.context.criterionA, error.context.criterionB]
                        };
                        return Intent.openIntent(Intent.INTENT_TYPES.RANK_CRITERIA, null, chatSession, intentContext, bot);
                    });
            } else if (error.type === 'CRITERIA_ITEM_RANK_INSUFFICIENT_CONSISTENCY_RATIO') {
                return botSendMessage(bot, chatSession, 'Sorry but we cannot proceed if the <b>Criteria Item Ranking matrix Consistency Ratio > 0.1</b>. It looks like you have made inconsistent preferences. Please review the preferences again.', {
                        parse_mode: 'HTML'
                    })
                    .then(function (sentMsg) {
                        ahpContext = chatSession.ahpContext = new AHP().import(ahpContext).resetCriteriaItemRank(error.context.criterion).export();
                        store.updateChatSession(chatId, chatSession);

                        let intentContext = {
                            criterion: error.context.criterion,
                            items: [ahpContext.items[0], ahpContext.items[1]]
                        };
                        return Intent.openIntent(Intent.INTENT_TYPES.RANK_CRITERIA_ITEM, null, chatSession, intentContext, bot);
                    });
            } else if (error.type === 'CRITERIA_RANK_INSUFFICIENT_CONSISTENCY_RATIO') {
                return botSendMessage(bot, chatSession, 'Sorry but we cannot proceed if the <b>Criteria Ranking matrix Consistency Ratio > 0.1</b>. It looks like you have made inconsistent preferences. Please review the preferences again.', {
                        parse_mode: 'HTML'
                    })
                    .then(function (sentMsg) {
                        ahpContext = chatSession.ahpContext = new AHP().import(ahpContext).resetCriteriaRank().export();
                        store.updateChatSession(chatId, chatSession);

                        let intentContext = {
                            criteria: [ahpContext.criteria[0], ahpContext.criteria[1]]
                        };
                        return Intent.openIntent(Intent.INTENT_TYPES.RANK_CRITERIA, null, chatSession, intentContext, bot);
                    });
            }
        }

        debugLog(`Intent IntentRun, ChatId:${chatId}, MsgId:${msgId}, fallback handling with Auto Flow Intent.`);
        return Intent.openIntent(Intent.INTENT_TYPES.AUTO_FLOW_INTENT, null, chatSession, {}, bot);
    }
}

function emuLineSeparator() {
    return '\n==========\n';
}

function getScaleInlineKeyboardOptions(intentType) {
    return [...Array(9).keys()].map(x => x + 1)
        .map(i => {
            if (i % 2 === 1) {
                let scaleItem = AHP.AHP_RANK_SCALE_TABLE[(i - 1) / 2];
                return [{
                    text: `(${scaleItem.scale}) ${scaleItem.definition}`,
                    callback_data: `${INTENT_TYPES[intentType]}::SELECT_RANK::${scaleItem.scale}`
                }];
            } else {
                return [{
                    text: `(${i}) Between (${i-1}) and (${i+1}).`,
                    callback_data: `${INTENT_TYPES[intentType]}::SELECT_RANK::${i}`
                }];
            }
        });
}

function getScaleDescriptions() {
    let scaleDescription = AHP.AHP_RANK_SCALE_TABLE.map(scaleItem => {
        return `(${scaleItem.scale}) ${scaleItem.definition}: ${scaleItem.explaination}`;
    }).join('\n') + '\n(2,4,6,8) intermediate values';
    return scaleDescription;
}

function appendDefaultInlineOptions(inlineOptions) {
    inlineOptions.push([{
        text: '* Do something else',
        callback_data: `${INTENT_TYPES.SELECT_INTENT}::${INTENT_TYPES.SELECT_INTENT}`
    }]);
    inlineOptions.push([{
        text: '* Restart session.',
        callback_data: `${INTENT_TYPES.SELECT_INTENT}::${INTENT_TYPES.RESET}`
    }]);
    return inlineOptions;
}

function botSendMessage(bot, chatSession, text, options = {}) {
    let chatId = chatSession.chatChannelContext.chatId;
    return bot.sendMessage(chatId, text, options);
}

function botEditOrSendMessage(bot, chatSession, text, options = {}) {
    let chatId = chatSession.chatChannelContext.chatId;
    if (chatSession.chatChannelContext.botEditMsgId) {
        options['chat_id'] = chatId;
        options['message_id'] = chatSession.chatChannelContext.botEditMsgId;
        return bot.editMessageText(text, options);
    } else {
        return bot.sendMessage(chatId, text, options).then(function (sentMsg) {
            chatSession.chatChannelContext.botEditMsgId = sentMsg.message_id;
            store.updateChatSession(chatId, chatSession);
        });
    }
}

function resetBotEditMsgId(chatSession) {
    chatSession.chatChannelContext.botEditMsgId = null;
    store.updateChatSession(chatSession.chatChannelContext.chatId, chatSession);
    return chatSession;
}

module.exports = Intent;
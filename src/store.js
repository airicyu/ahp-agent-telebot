'use strict';

var cache = require('memory-cache');

var store = {};

store.getChatSession = function(chat_id){
    let chatSession = cache.get(chat_id);
    if (chatSession){
        return chatSession;
    } else {
        return cache.put(chat_id, {}, 1000 * 60 * 60);
    }
}

store.updateChatSession = function(chat_id, session){
    cache.put(chat_id, session, 1000 * 60 * 60);
}

module.exports = store;
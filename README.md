# ahp-agent-telebot

This is a Telegram bot agent who can help you to do Analytic Hierarchy Process(AHP) analysis.

You can find the telegram bot by id `@ahp_agent_bot`.
You may just hi it and it will ask you some question to go through the analysis process.


## Project page

- [Project Home](http://blog.airic-yu.com/1989/ahp-agent-bot-telegram-bot-agent-ahp)
- [Github](https://github.com/airicyu/ahp-agent-telebot)

------------------------

## Screenshots

Screenshot 1: The openning…

![Screenshot 1: The openning…](http://blog.airic-yu.com/wp-content/uploads/2017/03/ahpscreenshot1.png)

------------

Screenshot 2: During the conversations, the agent would ask you some questions. Sometimes it would also suggest some quick answers for you to choose instead of manual input.

![Screenshot 2: During the conversations, the agent would ask you some questions. Sometimes it would also suggest some quick answers for you to choose instead of manual input.](http://blog.airic-yu.com/wp-content/uploads/2017/03/ahpscreenshot2.png)

------------

Screenshot 3: After the conversations, and all analysis context information is input, you may ask the agent to run the result. It would print the result matrix like below.

![Screenshot 3: After the conversations, and all analysis context information is input, you may ask the agent to run the result. It would print the result matrix like below.](http://blog.airic-yu.com/wp-content/uploads/2017/03/ahpscreenshot3.png)

------------------------

## Setup

1. Git clone the source code.

2. Run npm install to install depending modules.
```bash
$ npm install
```

3. Setup the config json file which contain the telegram bot token you get from Telegram.

    e.g: \<project root dir\>/config/secret.json:
```json
{
    "telegramBotToken" : "abcdef123456"
}
```

4. Run it!
```bash
$ node app.js
```

------------------------
## Contact

- Eric Yu: airic.yu@gmail.com

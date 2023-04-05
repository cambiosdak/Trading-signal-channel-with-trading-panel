# Trading-signal-channel-with-trading-panel
# Description
This application is a multipurpose bot that will handle incoming messages from a webhook sent from TradingView. This application creates a local server using ``Express`` framework and tunnel the connection using [ngrok](https://ngrok.com/) free tier with ```/webhook``` at the end of the provided link. <br />
The bot can handle 3 different channels in order to difference between signals of Cryptocurrency, Forex, or Stocks and send it to the proper channel. Message will also have an added button to redirect the user directly to the bot itself<br />
This project also has a trading panel integrated where you can send ``Market``, ``Limit``, ``Stop Loss``, ``Take Profit`` or ``Cancel all orders in a specific symbol``. User can also check their balance and check open positions <br />
Another feature is that the user can resend a signal from the channel and bot will automatically ask the user what exchange would like to use and how much would like to spend on the operation. <br /> <br />

> This telegram bot supports BITGET and BINANCE Exchanges

# Usage
- Download [ngrok](https://ngrok.com/) and install
- Create a tunnel using ```ngrok http 3000``` <br /> <br />
Install packages via npm:
```
npm install telegraf bitget-api telegraf-session-local crypto-js axios express body-parser
```
- Set your TOKEN API provided by @BotFather in ``main.js`` file
- Set your Channel IDs
- Run your app and send the command ``/listen`` in your bot
- ``/help`` will give you a list of commands to use the bot.

# References
- [Axios](https://www.npmjs.com/package/axios)
- [Crypto-js](https://www.npmjs.com/package/crypto-js)
- [ws(WebSocket)](https://www.npmjs.com/package/ws)
- [Telegraf](https://www.npmjs.com/package/telegraf)
- [ngrok](https://ngrok.com/)
- [Express](https://www.npmjs.com/package/express)
- [Telegraf Session](https://www.npmjs.com/package/telegraf-session-local)
- [Bitget API](https://www.npmjs.com/package/bitget-api)

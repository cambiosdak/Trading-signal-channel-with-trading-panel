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

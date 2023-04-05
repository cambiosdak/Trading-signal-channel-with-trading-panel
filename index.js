const {Telegraf, Scenes:{WizardScene, Stage}, Markup} = require('telegraf') 

const {FuturesClient} = require('bitget-api')
const LocalSession = require('telegraf-session-local')
const CryptoJS = require('crypto-js')
const axios = require('axios')
const symbols = require('./symbols.json')
const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const port = 3000; // You can change the port if you are already using it, make sure it matches with the ngrok port you are using
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.text());
let url = 'https://fapi.binance.com'
// Initialize session middleware
const localSession = new LocalSession({
    database: 'local.db.json',
    storage: LocalSession.storageFileAsync,
    format: {
      serialize: (obj) => JSON.stringify(obj, null, 2),
      deserialize: (str) => JSON.parse(str),
    },
  })  
const bot = new Telegraf('YOUR TOKEN GOES HERE'); // SET YOUR BOT TOKEN
// 
// Register session middleware
bot.use(localSession.middleware())


bot.command('binance', (ctx) => {
    if (ctx.session.apiKey !== undefined && ctx.session.apiSecret !== undefined) {
        ctx.reply('Que te gustaria hacer?', 
        Markup.inlineKeyboard([
            [Markup.button.callback('Balance 💰', 'wallet'),
            Markup.button.callback('Tipo de margin🔸', 'marginType')],
            [Markup.button.callback('Orden Limit💎', 'newLimit'),
            Markup.button.callback('Orden Market💎', 'newOrder')],
            [Markup.button.callback('Stop Loss🔴', 'stopLoss'),
            Markup.button.callback('Take Profit🟢', 'takeProfit')],
            [Markup.button.callback('Posiciones📊', 'update')],
            [Markup.button.callback('Solicitar posicion🔎', 'oneUpdate')]
        ]).resize().oneTime()
        )
    } else{
        ctx.replyWithHTML('Debe registrar sus <b>BINANCE API KEYs</b>, para hacerlo ejecute el comando /binance_api_key')
    }
})

bot.command('bitget', (ctx) =>{
    if (ctx.session.apiKeyBitget !== undefined && ctx.session.apiSecretBitget !== undefined) {
        ctx.reply('Que te gustaria hacer?', 
    	Markup.inlineKeyboard([
    		[Markup.button.callback('Balance💰', 'walletBitget')],
    		[Markup.button.callback('Orden Limit💎', 'newLimitBitget'),
            Markup.button.callback('Orden Market💎', 'newOrderBitget')],
            [Markup.button.callback('Stop Loss🔴', 'stopLossBitget'),
            Markup.button.callback('Take Profit🟢', 'takeProfitBitget')],
            [Markup.button.callback('Posiciones📊', 'updateBitget')],
            [Markup.button.callback('Solicitar posicion🔎', 'oneUpdateBitget')],
            [Markup.button.callback('Cancelar Posicion', 'cancelBitget')]
    	]).resize().oneTime()
    	)
    } else {
        ctx.replyWithHTML('Debe registrar sus <b>BITGET API KEYs</b>, para hacerlo ejecute el comando /bitget_api_key')
    }
})
let text
bot.on('forward_date', async (ctx) => { 
    const allowedChannel = -1001774094104 // replace with your desired channel name or ID
    const forwardedFrom = ctx.message.forward_from_chat
    if (forwardedFrom && forwardedFrom.type === 'channel' && forwardedFrom.id === allowedChannel) {
        // do something with the forwarded message
        text = ctx.message.text
        ctx.reply('En que plataforma te gustaria enviar la orden?',
        Markup.inlineKeyboard([
        [Markup.button.callback('Binance', 'binanceOrder'), Markup.button.callback('Bitget', 'bitgetOrder')]
        ]))
    } else {
        console.log('Forwarded message not from allowed channel')
    }
})



// MARKET ORDER
const SYMBOL = Telegraf.hears(/^[A-Z0-9]+$/, (ctx) => {
	const pair = ctx.message.text;
	for (i = 0; i < symbols.length; i++) {
	  if (pair == symbols[i]) {
		ctx.wizard.state.symbol = pair;
		ctx.replyWithHTML(
		  "Please indicate the side <b>SHORT</b> or <b>LONG</b>",
		  Markup.inlineKeyboard([
			Markup.button.callback("SHORT", "short"),
			Markup.button.callback("LONG", "long")])
		)
	  }
	}
	return ctx.wizard.next();
});
const ORDER_SIDE = Telegraf.on("callback_query", (ctx) => {
    ctx.answerCbQuery()
    if (ctx.update.callback_query.data == "long") {
		ctx.wizard.state.compra = "BUY";
		ctx.reply("Please indicate your leverage, ex: 10, 20, 30");
	} else if (ctx.update.callback_query.data == "short") {
		ctx.wizard.state.venta = "SELL";
		ctx.reply("Please indicate your leverage, ex: 10, 20, 30");
	}
	return ctx.wizard.next();
});
const LEVERAGE = Telegraf.hears(/^[0-9]+$/, (ctx) => {
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
	let params = `symbol=${ctx.wizard.state.symbol}&leverage=${ctx.message.text}&recvWindow=60000&timestamp=${Date.now()}`
          let signatureLeverage = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex)
          let lev = {
              headers: {
                  'X-MBX-APIKEY': `${apiKey}` // APIKEY OF ACCOUNT B
              },
              method: 'POST',
              url: `https://fapi.binance.com/fapi/v1/leverage?${params}&signature=${signatureLeverage}`
          }
         axios.request(lev).then(async (response) => {
              await response.data
              ctx.wizard.state.leverage = response.data.leverage
              ctx.reply('Indique el tamaño de su orden en USDT')
			return ctx.wizard.next()
          }).catch(error => ctx.reply(`ERROR: ${error.response.data.msg}`))
})
const AMOUNT = Telegraf.hears(/^\d+(\.\d+)?$/, (ctx) => {
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
	ctx.wizard.state.amount = Number(ctx.message.text);
	  let side;
	  if (ctx.wizard.state.venta != undefined) {
		side = "SELL";
	  } else if (ctx.wizard.state.compra != undefined) {
		side = "BUY";
	  }
	  let parameter = `symbol=${ctx.wizard.state.symbol}&recvWindow=5000&timestamp=${Date.now()}`
	  let signatured = CryptoJS.HmacSHA256(parameter,apiSecret).toString(CryptoJS.enc.Hex);
	  let price = {
		headers: {
		  "X-MBX-APIKEY": `${apiKey}`, // APIKEY OF ACCOUNT B
		},
		method: "GET",
		url: `https://fapi.binance.com/fapi/v1/ticker/price?${parameter}&signature=${signatured}`,
	  };
	  axios.request(price).then(async (response) => {
		  ctx.wizard.state.price = response.data.price
		}).then((resp) => {
			let parameter = `symbol=${ctx.wizard.state.symbol}&recvWindow=60000&timestamp=${Date.now()}`
			let signatureSymbol = CryptoJS.HmacSHA256(parameter, apiSecret).toString(CryptoJS.enc.Hex)
			var options = {
			  headers: {
				'X-MBX-APIKEY': `${apiKey}` // APIKEY OF ACCOUNT B
			},
			method: 'GET',
			url: `${url}/fapi/v1/exchangeInfo?${parameter}&signature=${signatureSymbol}`
	
			}
			axios.request(options).then(async response =>{
				await response.data
				info = response.data.symbols
				for (const k of Object.values(info)){
				if (k.symbol === ctx.wizard.state.symbol){
					ctx.wizard.state.precision = k.quantityPrecision
				}
			}
			
  		}).then(response =>{
			let qty = (ctx.wizard.state.leverage*(ctx.wizard.state.amount / ctx.wizard.state.price))
			  let params = `symbol=${ctx.wizard.state.symbol}&side=${side}&type=MARKET&quantity=${qty.toFixed(ctx.wizard.state.precision)}&recvWindow=5000&timestamp=${Date.now()}`;
			  let signature = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex);
			  var options = {
				headers: {
				  "X-MBX-APIKEY": `${apiKey}`, // APIKEY OF ACCOUNT B
				},
				method: "POST",
				url: `${url}/fapi/v1/order?${params}&signature=${signature}`,
			  };
			  axios.request(options).then(async (response) => {
				  await response.data;
				  ctx.reply("Orden Market enviada!");
                  return ctx.scene.leave();

					}).catch((error) => ctx.reply(`ERROR: ${error.response.data.msg}`))
				}).catch((error) => ctx.reply(`ERROR: ${error.response.data.msg}`));
		}).catch(error => ctx.reply(`ERROR: ${error.response.data.msg}`))
})

// LIMIT ORDER
const SYMBOL_LIMIT = Telegraf.hears(/^[A-Z0-9]+$/, (ctx) => {
	const pair = ctx.message.text;
	for (i = 0; i < symbols.length; i++) {
	  if (pair == symbols[i]) {
		ctx.wizard.state.symbol = pair;
        ctx.reply('Por favor indique el precio al que desea enviar la orden')
	  }
	}
	return ctx.wizard.next();
});
const PRICE_LIMIT = Telegraf.hears(/^\d+(\.\d+)?$/, (ctx) => {
    ctx.wizard.state.price = Number(ctx.message.text)
    ctx.replyWithHTML(
        "Por favor indique si es <b>SHORT</b> o <b>LONG</b>",
        Markup.inlineKeyboard([
          Markup.button.callback("SHORT", "short"),
          Markup.button.callback("LONG", "long")])
      )
      return ctx.wizard.next();
})
const ORDER_SIDE_LIMIT = Telegraf.on("callback_query", (ctx) => {
    ctx.answerCbQuery()
    if (ctx.update.callback_query.data == "long") {
		ctx.wizard.state.compra = "BUY";
		ctx.reply("Por favor indique el apalancamiento, ex: 10, 20, 30");
	} else if (ctx.update.callback_query.data == "short") {
		ctx.wizard.state.venta = "SELL";
		ctx.reply("Por favor indique el apalancamiento, ex: 10, 20, 30");
	}
	return ctx.wizard.next();
});
const LEVERAGE_LIMIT = Telegraf.hears(/^[0-9]+$/, (ctx) => {
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
	let params = `symbol=${ctx.wizard.state.symbol}&leverage=${ctx.message.text}&recvWindow=60000&timestamp=${Date.now()}`
          let signatureLeverage = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex)
          let lev = {
              headers: {
                  'X-MBX-APIKEY': `${apiKey}` // APIKEY OF ACCOUNT B
              },
              method: 'POST',
              url: `https://fapi.binance.com/fapi/v1/leverage?${params}&signature=${signatureLeverage}`
          }
         axios.request(lev).then(async (response) => {
              await response.data
              ctx.wizard.state.leverage = response.data.leverage
              ctx.reply('Indique el tamaño de su orden en USDT')
			return ctx.wizard.next()
          }).catch(error => ctx.reply(`ERROR: ${error.response.data.msg}`))
});
const AMOUNT_LIMIT = Telegraf.hears(/^\d+(\.\d+)?$/, (ctx) => {
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
	ctx.wizard.state.amount = Number(ctx.message.text);
	  let side;
	  if (ctx.wizard.state.venta != undefined) {
		side = "SELL";
	  } else if (ctx.wizard.state.compra != undefined) {
		side = "BUY";
	  }
        let parameter = `symbol=${ctx.wizard.state.symbol}&recvWindow=60000&timestamp=${Date.now()}`
        let signatureSymbol = CryptoJS.HmacSHA256(parameter, apiSecret).toString(CryptoJS.enc.Hex)
        var options = {
            headers: {
            'X-MBX-APIKEY': `${apiKey}` // APIKEY OF ACCOUNT B
        },
        method: 'GET',
        url: `${url}/fapi/v1/exchangeInfo?${parameter}&signature=${signatureSymbol}`

        }
        axios.request(options).then(async response =>{
            await response.data
            info = response.data.symbols
            for (const k of Object.values(info)){
            if (k.symbol === ctx.wizard.state.symbol){
                ctx.wizard.state.precision = k.quantityPrecision
            }
        }
    }).then(response =>{
        let qty = (ctx.wizard.state.leverage*(ctx.wizard.state.amount / ctx.wizard.state.price))
        let params = `symbol=${ctx.wizard.state.symbol}&side=${side}&type=LIMIT&price=${ctx.wizard.state.price}&quantity=${qty.toFixed(ctx.wizard.state.precision)}&timeInForce=GTC&recvWindow=5000&timestamp=${Date.now()}`;
        let signature = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex);
        var options = {
        headers: {
            "X-MBX-APIKEY": `${apiKey}`, // APIKEY OF ACCOUNT B
        },
        method: "POST",
        url: `${url}/fapi/v1/order?${params}&signature=${signature}`,
        };
        axios.request(options).then(async (response) => {
            await response.data;
            ctx.reply("Orden Limit enviada!");
            return ctx.scene.leave();

        }).catch((error) => ctx.reply(`ERROR: ${error.response.data.msg}`))
    }).catch((error) => ctx.reply(`ERROR: ${error.response.data.msg}`));
});

// MARGIN TYPE
const SYMBOL_MARGIN = Telegraf.hears(/^[A-Z0-9]+$/, (ctx) => {
    const pair = ctx.message.text;
	for (i = 0; i < symbols.length; i++) {
	  if (pair == symbols[i]) {
		ctx.wizard.state.symbol = pair;
        ctx.replyWithHTML(
            "Por favor indique si es <b>AISLADO</b> o <b>CRUZADO</b>",
            Markup.inlineKeyboard([
              Markup.button.callback("AISLADO", "iso"),
              Markup.button.callback("CRUZADO", "cross")])
          )
	  }
	}
	return ctx.wizard.next();
})

const MARGIN_TYPE = Telegraf.on('callback_query', (ctx)=>{
    ctx.answerCbQuery()
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
    if (ctx.update.callback_query.data == "iso") {
		ctx.wizard.state.type = "ISOLATED";
	} else if (ctx.update.callback_query.data == "cross") {
		ctx.wizard.state.type = "CROSSED";
	}
    console.log(ctx.wizard.state.type)
    let params = `symbol=${ctx.wizard.state.symbol}&marginType=${ctx.wizard.state.type}&recvWindow=60000&timestamp=${Date.now()}`
    let signatureLeverage = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex)
    let opt = {
        headers: {
            'X-MBX-APIKEY': `${apiKey}`
        },
        method: 'POST',
        url: `https://fapi.binance.com/fapi/v1/marginType?${params}&signature=${signatureLeverage}`
    }
   axios.request(opt).then(async (response) => {
        console.log(response.data)
        ctx.reply(`${ctx.wizard.state.symbol} Exitosamente cambiado to: ${ctx.wizard.state.type}`)
    }).catch(error => {ctx.reply(`ERROR: ${error.response.data.msg}`)})
    return ctx.scene.leave();
})

// STOP LOSS
const SYMBOL_STOP = Telegraf.hears(/^[A-Z0-9]+$/, (ctx) => {
	const pair = ctx.message.text;
	for (i = 0; i < symbols.length; i++) {
	  if (pair == symbols[i]) {
		ctx.wizard.state.symbol = pair;
        ctx.reply('Por favor indique el precio al que desea enviar la orden')
	  }
	}
	return ctx.wizard.next();
});

const PRICE_STOP = Telegraf.hears(/^[0-9]+$/, (ctx) =>{
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
    let price = Number(ctx.message.text)
    let params = `symbol=${ctx.wizard.state.symbol}&recvWindow=60000&timestamp=${Date.now()}`
    let signatureLeverage = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex)
    let opt = {
        headers: {
            'X-MBX-APIKEY': `${apiKey}`
        },
        method: 'GET',
        url: `https://fapi.binance.com/fapi/v2/positionRisk?${params}&signature=${signatureLeverage}`
    }
    axios.request(opt).then(async (response) => {
        await response.data
        let side
        let resp = response.data[0]
        if (resp.positionAmt > 0){
            side = 'SELL'
        } else if (resp.positionAmt < 0){
            side = 'BUY'
        }
        let params = `symbol=${ctx.wizard.state.symbol}&side=${side}&type=STOP_MARKET&stopPrice=${price}&quantity=${resp.positionAmt}&recvWindow=60000&timestamp=${Date.now()}`
        let signatureLeverage = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex)
        let opt = {
            headers: {
                'X-MBX-APIKEY': `${apiKey}`
            },
            method: 'POST',
            url: `https://fapi.binance.com/fapi/v1/order?${params}&signature=${signatureLeverage}`
        }
        axios.request(opt).then(async (response) => {
            await response.data
            ctx.reply(`Stop loss enviado exitosamente a: ${ctx.wizard.state.symbol}`)
        }).catch(error => ctx.reply(`ERROR: ${error.response.data.msg}`))
    }).catch(error => ctx.reply(`ERROR: ${error.response.data.msg}`))
    return ctx.scene.leave()
})

// TAKE PROFIT 
const SYMBOL_TAKE = Telegraf.hears(/^[A-Z0-9]+$/, (ctx) => {
	const pair = ctx.message.text;
	for (i = 0; i < symbols.length; i++) {
	  if (pair == symbols[i]) {
		ctx.wizard.state.symbol = pair;
        ctx.reply('Por favor indique el precio al que desea enviar la orden')
	  }
	}
	return ctx.wizard.next();
});

const PRICE_TAKE = Telegraf.hears(/^[0-9]+$/, (ctx) =>{
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
    let price = Number(ctx.message.text)
    let params = `symbol=${ctx.wizard.state.symbol}&recvWindow=60000&timestamp=${Date.now()}`
    let signatureLeverage = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex)
    let opt = {
        headers: {
            'X-MBX-APIKEY': `${apiKey}`
        },
        method: 'GET',
        url: `https://fapi.binance.com/fapi/v2/positionRisk?${params}&signature=${signatureLeverage}`
    }
    axios.request(opt).then(async (response) => {
        await response.data
        let side
        let resp = response.data[0]
        if (resp.positionAmt > 0){
            side = 'SELL'
        } else if (resp.positionAmt < 0){
            side = 'BUY'
        }
        let params = `symbol=${ctx.wizard.state.symbol}&side=${side}&type=TAKE_PROFIT_MARKET&stopPrice=${price}&quantity=${resp.positionAmt}&recvWindow=60000&timestamp=${Date.now()}`
        let signatureLeverage = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex)
        let opt = {
            headers: {
                'X-MBX-APIKEY': `${apiKey}`
            },
            method: 'POST',
            url: `https://fapi.binance.com/fapi/v1/order?${params}&signature=${signatureLeverage}`
        }
        axios.request(opt).then(async (response) => {
            await response.data
            ctx.reply(`Take Profit enviado exitosamente a: ${ctx.wizard.state.symbol}`)
        }).catch(error => ctx.reply(`ERROR: ${error.response.data.msg}`))
    }).catch(error => ctx.reply(`ERROR: ${error.response.data.msg}`))
    return ctx.scene.leave()
})

const SYMBOL_POS = Telegraf.hears(/^[A-Z0-9]+$/, (ctx) => {
	const pair = ctx.message.text;
	for (i = 0; i < symbols.length; i++) {
	  if (pair == symbols[i]) {
		ctx.wizard.state.symbol = pair;
	  }
	}
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
	let parameter = `symbol=${ctx.wizard.state.symbol}&recvWindow=60000&timestamp=${Date.now()}`
    let signatureSymbol = CryptoJS.HmacSHA256(parameter, apiSecret).toString(CryptoJS.enc.Hex)
    var options = {
        headers: {
            'X-MBX-APIKEY': `${apiKey}` // APIKEY OF ACCOUNT B
        },
		method: 'GET',
		url: `${url}/fapi/v2/positionRisk?${parameter}&signature=${signatureSymbol}`
	
		}
    axios.request(options).then(async response =>{
        await response.data
        console.log(response.data)
        // ctx.replyWithHTML(`Symbol: <b>${current[i].symbol}</b>\nSide: LONG\n\nEntry price: <b>${current[i].entryPrice}</b>\nLeverage: <b>${current[i].leverage}</b>\nuPnL: <b>${current[i].unRealizedProfit}</b>\nPosition Amount: <b>${Math.abs(current[i].positionAmt)}</b>\nNotional: <b>${current[i].notional}</b>\nIsolated Wallet: <b>${current[i].isolatedWallet}</b>\nMark Price: <b>${current[i].markPrice}</b>\nLiquidation Price: <b>${current[i].liquidationPrice}</b>`)
    }).catch(error => ctx.reply(`ERROR: ${error.response.data.msg}`))
    return ctx.scene.leave()
});

bot.action('wallet', (ctx) =>{
	ctx.answerCbQuery()
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
	let parameter = `recvWindow=60000&timestamp=${Date.now()}`
	let signatureSymbol = CryptoJS.HmacSHA256(parameter, apiSecret).toString(CryptoJS.enc.Hex)
	var options = {
	  headers: {
		'X-MBX-APIKEY': `${apiKey}` // APIKEY OF ACCOUNT B
	},
	method: 'GET',
	url: `${url}/fapi/v2/account?${parameter}&signature=${signatureSymbol}`

	}
	axios.request(options).then(async response =>{
		await response.data
		rep = response.data
		ctx.replyWithHTML(`Wallet balance: <b>${rep.totalWalletBalance}</b>\nTotal Cross UnPnl: ${rep.totalCrossUnPnl}\nAvailable Balance <b>${rep.availableBalance}</b>`)
		response = response.data.assets
        response.forEach(element => {
            if (element.walletBalance  > 0){
                ctx.replyWithHTML(`Asset: <b>${element.asset}</b>\nWallet balance is: <b>${element.walletBalance}</b>`)
            }
        });
	}).catch(error => ctx.reply(`ERROR: ${error.response.data.msg}`))
})

const API_KEY = Telegraf.hears(/.*/, (ctx) => {
        // Store the API key in the session
        console.log(ctx.message.text)
        ctx.session.apiKey = ctx.message.text;
        ctx.reply('Por favor coloque su API SECRET, no incluya espacios ni caracteres extra.');
        ctx.wizard.next();
    }
)

const API_SECRET = Telegraf.hears(/.*/, (ctx) =>{
        // Store the API secret in the session
        console.log(ctx.message.text)
        ctx.session.apiSecret = ctx.message.text;
        ctx.replyWithHTML('Gracias!, su API KEY ha sido guardada exitosamente, escriba /binance para empezar\n\n📌📌<b>IMPORTANTE:</b>\nPara operar debe dar permisos de FUTUROS en su cuenta de Binance y agregar dar permisos a la <b>IP: 93.189.91.25 </b> para poder realizar operaciones');
        return ctx.scene.leave();
})

const BITGET_API_KEY = Telegraf.hears(/.*/, (ctx) => {
    // Store the API key in the session
    console.log(ctx.message.text)
    ctx.session.apiKeyBitget = ctx.message.text;
    ctx.reply('Por favor coloque su API SECRET, no incluya espacios ni caracteres extra.');
    ctx.wizard.next();
}
)

const BITGET_API_SECRET = Telegraf.hears(/.*/, (ctx) =>{
    // Store the API secret in the session
    console.log(ctx.message.text)
    ctx.session.apiSecretBitget = ctx.message.text;
    ctx.reply('Por favor indique la clave que coloco al crear su API KEY');
    ctx.wizard.next()
})

const BITGET_PHRASE = Telegraf.hears(/.*/, (ctx) =>{
    console.log(ctx.message.text)
    ctx.session.apiBitgetPhrase = ctx.message.text
    ctx.reply('Gracias! Su API KEY ha sido registrada satisfactoriamente, escriba /bitget para empezar')
    return ctx.scene.leave();

})

bot.action('update', (ctx) =>{
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
	ctx.answerCbQuery()
	function positions() {
		ctx.reply('Checking for positions...')
		let parameter = `recvWindow=60000&timestamp=${Date.now()}`
		let signatureSymbol = CryptoJS.HmacSHA256(parameter, apiSecret).toString(CryptoJS.enc.Hex)
		var options = {
		headers: {
			'X-MBX-APIKEY': `${apiKey}` // APIKEY OF ACCOUNT B
		},
		method: 'GET',
		url: `${url}/fapi/v2/positionRisk?${parameter}&signature=${signatureSymbol}`
	
		}
		axios.request(options).then(async response =>{
			await response.data
			current = response.data
		if (current != undefined){
			for (let i = 0; i < current.length; i++) {
				setTimeout(() => {
					if (current[i].positionAmt > 0.00001){
						symbolTest = current[i].symbol
						entry = current[i].entryPrice
						ctx.replyWithHTML(`Symbol: <b>${current[i].symbol}</b>\nSide: LONG\n\nEntry price: <b>${current[i].entryPrice}</b>\nLeverage: <b>${current[i].leverage}</b>\nuPnL: <b>${current[i].unRealizedProfit}</b>\nPosition Amount: <b>${Math.abs(current[i].positionAmt)}</b>\nNotional: <b>${current[i].notional}</b>\nIsolated Wallet: <b>${current[i].isolatedWallet}</b>\nMark Price: <b>${current[i].markPrice}</b>\nLiquidation Price: <b>${current[i].liquidationPrice}</b>`)
					} else if(current[i].positionAmt < -0.000001){
						symbolTest = current[i].symbol
						entry = current[i].entryPrice
						ctx.replyWithHTML(`Symbol: <b>${current[i].symbol}</b>\n\nSide: SHORT\n\nLeverage: <b>${current[i].leverage}</b>\nEntry price: <b>${current[i].entryPrice}</b>\nuPnL: <b>${current[i].unRealizedProfit}</b>\nPosition Amount: <b>${Math.abs(current[i].positionAmt)}</b>\nNotional: <b>${Math.abs(current[i].notional)}</b>\nIsolated Wallet: <b>${current[i].isolatedWallet}</b>\nMark Price: <b>${current[i].markPrice}</b>\nLiquidation Price: <b>${current[i].liquidationPrice}</b>`)
					} else if (i == current.length -1){
						ctx.reply('Updates will come in 5 minutes')
						i = 0
						setTimeout(() => {
                            positions()
                        }, 300000)
					}
				}, 50*i)
			}
		}
		}).catch(error => ctx.reply(`ERROR: ${error.response.data.msg}`))
	}
	positions()
})


/***
 * 
 * 
 * BITGET
 *  
 */

bot.action('walletBitget', (ctx) =>{
    ctx.answerCbQuery()
    const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })
    client.getAccount('BTCUSDT_UMCBL', 'USDT')
        .then( response =>{
            ctx.replyWithHTML(`Su balance es: <b>${response.data.available} ${response.data.marginCoin}</b>`)
        }).catch(error => console.error(error))

})
// Limit
const SYMBOL_LIMIT_BITGET = Telegraf.hears(/^[A-Z0-9]+$/, (ctx)=>{
    ctx.wizard.state.symbol = ctx.message.text + '_UMCBL'
    ctx.reply('Por favor indique el precio al que desea enviar la orden')
    return ctx.wizard.next()
})

const PRICE_LIMIT_BITGET = Telegraf.hears(/^\d+(\.\d+)?$/, (ctx) =>{
    ctx.wizard.state.price = Number(ctx.message.text)
    ctx.replyWithHTML(
        "Por favor indique si es <b>SHORT</b> o <b>LONG</b>",
        Markup.inlineKeyboard([
          Markup.button.callback("SHORT", "shortBitget"),
          Markup.button.callback("LONG", "longBitget")])
      )
      return ctx.wizard.next();
})

const ORDER_SIDE_LIMIT_BITGET = Telegraf.on("callback_query", (ctx) => {
    ctx.answerCbQuery()
    if (ctx.update.callback_query.data == "longBitget") {
		ctx.wizard.state.side = "open_long";
		ctx.reply("Por favor indique el apalancamiento, ex: 10, 20, 30");
	} else if (ctx.update.callback_query.data == "shortBitget") {
		ctx.wizard.state.side = "open_short";
		ctx.reply("Por favor indique el apalancamiento, ex: 10, 20, 30");
	}
	return ctx.wizard.next();
});

const LEVERAGE_LIMIT_BITGET = Telegraf.hears(/^[0-9]+$/, (ctx) => {
    // Cambiar apalancamiento
    const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })
    client.setLeverage(ctx.wizard.state.symbol, 'USDT', ctx.message.text)
        .then( response =>{
            ctx.wizard.state.leverage = response.data.crossMarginLeverage
            ctx.reply('Indique el tamaño de su orden en USDT')
        }).catch(error => console.error(error.data))
    return ctx.wizard.next()
});

const AMOUNT_LIMIT_BITGET = Telegraf.hears(/.*/, (ctx) => {
    const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })
    let amount = (ctx.message.text * ctx.wizard.state.leverage)/(ctx.wizard.state.price)
    client.submitOrder({
        symbol: `${ctx.wizard.state.symbol}`,
        marginCoin: 'USDT',
        side: `${ctx.wizard.state.side}`,
        size: amount,
        orderType: 'limit',
        price: ctx.wizard.state.price
    })
      .then(response =>{
        if (response.msg === 'success'){
            ctx.reply(`Su orden ha sido enviada satisfactoriamente a ${ctx.wizard.state.symbol} @ ${ctx.wizard.state.price}`)
        }
      }).catch(error => console.error(error.body.msg))
// enviar orden
    return ctx.scene.leave()
});
// Market orders
const SYMBOL_BITGET = Telegraf.hears(/^[A-Z0-9]+$/, (ctx)=>{
    ctx.wizard.state.symbol = ctx.message.text + '_UMCBL'
    ctx.replyWithHTML(
        "Por favor indique si es <b>SHORT</b> o <b>LONG</b>",
        Markup.inlineKeyboard([
          Markup.button.callback("SHORT", "shortBitget"),
          Markup.button.callback("LONG", "longBitget")])
      )
    return ctx.wizard.next()
})

const ORDER_SIDE_BITGET = Telegraf.on("callback_query", (ctx) => {
    ctx.answerCbQuery()
    if (ctx.update.callback_query.data == "longBitget") {
		ctx.wizard.state.side = "open_long";
		ctx.reply("Por favor indique el apalancamiento, ex: 10, 20, 30");
	} else if (ctx.update.callback_query.data == "shortBitget") {
		ctx.wizard.state.side = "open_short";
		ctx.reply("Por favor indique el apalancamiento, ex: 10, 20, 30");
	}
	return ctx.wizard.next();
});

const LEVERAGE_BITGET = Telegraf.hears(/^[0-9]+$/, (ctx) => {
    const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })
    client.setLeverage(ctx.wizard.state.symbol, 'USDT', ctx.message.text)
        .then( response =>{
            ctx.wizard.state.leverage = response.data.crossMarginLeverage
            ctx.reply('Indique el tamaño de su orden en USDT')
        }).catch(error => console.error(error.data))
    return ctx.wizard.next()
});

const AMOUNT_BITGET = Telegraf.hears(/.*/, (ctx) => {
    const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })
    client.getTicker(ctx.wizard.state.symbol)
        .then(response =>{
            let amount = (ctx.message.text * ctx.wizard.state.leverage)/ Number(response.data.last)
            client.submitOrder({
                symbol: `${ctx.wizard.state.symbol}`,
                marginCoin: 'USDT',
                side: `${ctx.wizard.state.side}`,
                size: amount,
                orderType: 'market'
            })
            .then(response =>{
                if (response.msg === 'success'){
                    ctx.reply(`Su orden ha sido enviada satisfactoriamente a ${ctx.wizard.state.symbol} @ MARKET PRICE`)
                }
            }).catch(error => console.error(error))
        }).catch(error => console.error(error))
    
// enviar orden
    return ctx.scene.leave()
});

const SYMBOL_STOP_BITGET = Telegraf.hears(/^[A-Z0-9a-z]+$/, (ctx)=>{
    ctx.wizard.state.symbol = ctx.message.text + '_UMCBL'
    ctx.reply('Por favor indique el precio al que desea enviar el stop loss')
    return ctx.wizard.next()
})

const PRICE_STOP_BITGET = Telegraf.hears(/.*/, (ctx) =>{
    const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })
    client.getPosition(ctx.wizard.state.symbol, 'USDT')
    .then( response =>{
        let data = response.data[0]
        client.submitPositionTPSL({
            symbol: ctx.wizard.state.symbol,
            marginCoin: 'USDT',
            planType: 'loss_plan',
            triggerPrice: ctx.message.text,
            triggerType: 'fill_price',
            holdSide: data.holdSide
        }).then( response =>{
            ctx.reply(`Stop loss enviado satisfactoriamente a ${ctx.wizard.state.symbol} @ ${ctx.message.text}`)
        }).catch(error => console.error(error))
    }).catch(error => console.error(error))
    return ctx.scene.leave()
})

const SYMBOL_TAKE_BITGET = Telegraf.hears(/^[A-Z0-9a-z]+$/, (ctx)=>{
    ctx.wizard.state.symbol = ctx.message.text + '_UMCBL'
    ctx.reply('Por favor indique el precio al que desea enviar el Take Profit')
    return ctx.wizard.next()
})

const PRICE_TAKE_BITGET = Telegraf.hears(/.*/, (ctx) =>{
    const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })
    client.getPosition(ctx.wizard.state.symbol, 'USDT')
    .then( response =>{
        let data = response.data[0]
        client.submitPositionTPSL({
            symbol: ctx.wizard.state.symbol,
            marginCoin: 'USDT',
            planType: 'profit_plan',
            triggerPrice: ctx.message.text,
            triggerType: 'fill_price',
            holdSide: data.holdSide
        }).then( response =>{
            ctx.reply(`Take Profit enviado satisfactoriamente a ${ctx.wizard.state.symbol} @ ${ctx.message.text}`)
        }).catch(error => console.error(error))
    }).catch(error => console.error(error))
    
    return ctx.scene.leave()
})

const SYMBOL_POS_BITGET = Telegraf.hears(/[A-Z]?$/, (ctx) =>{
    ctx.wizard.state.symbol = ctx.message.text + '_UMCBL'
    const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })
    client.getPosition(ctx.wizard.state.symbol, 'USDT')
        .then( response =>{
            let data = response.data[0]
            ctx.replyWithHTML(`<b>Symbol:</b> ${data.symbol}\n<b>Side:</b> ${data.holdSide}\n<b>Size:</b> ${data.margin}\n<b>Leverage:</b> ${data.leverage}\n<b>UnrealizedPnL:</b> ${data.unrealizedPL}\n<b>Current Price:</b> ${data.marketPrice}`)
        }).catch(error => console.error(error))
    return ctx.scene.leave()
})


const SYMBOL_CANCEL = Telegraf.hears(/^(si|no)$/i,(ctx) =>{
    const answer = ctx.match[0].toLowerCase();
    if (answer == "si") {
	const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })
    client.cancelAllOrders('umcbl','USDT')
        .then( response =>{
            console.log(response)
            ctx.reply('Ordenes canceladas!')
            return ctx.scene.leave()
        }).catch(error => console.error(error))	
	} else if (answer == "no") {
        ctx.reply('No se cancelo ninguna orden')
		return ctx.scene.leave()
	}
})

// BINANCE
const LEVERAGE_AUTO = Telegraf.hears(/^[0-9]+$/, (ctx) => {
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
    let data = extractTradeInfo(text)
	let params = `symbol=${data.symbol}&leverage=${ctx.message.text}&recvWindow=60000&timestamp=${Date.now()}`
    let signatureLeverage = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex)
    let lev = {
        headers: {
            'X-MBX-APIKEY': `${apiKey}` // APIKEY OF ACCOUNT B
        },
        method: 'POST',
        url: `https://fapi.binance.com/fapi/v1/leverage?${params}&signature=${signatureLeverage}`
    }
    axios.request(lev).then(async (response) => {
        await response.data
        ctx.wizard.state.leverage = response.data.leverage
        ctx.reply('Indique el tamaño de su orden en USDT')
    return ctx.wizard.next()
    }).catch(error => ctx.reply(`ERROR: ${error.response.data.msg}`))
});

const DESIRE_AMOUNT = Telegraf.hears(/^\d+(\.\d+)?$/, (ctx) =>{
    let apiKey = ctx.session.apiKey
    let apiSecret = ctx.session.apiSecret
    ctx.wizard.state.amount = Number(ctx.message.text);
    let data = extractTradeInfo(text)

	  let side;
	  if (data.side === 'VENTA') {
		side = "SELL";
	  } else if (data.side === 'COMPRA') {
		side = "BUY";
	  }
        let parameter = `symbol=${data.symbol}&recvWindow=60000&timestamp=${Date.now()}`
        let signatureSymbol = CryptoJS.HmacSHA256(parameter, apiSecret).toString(CryptoJS.enc.Hex)
        var options = {
            headers: {
            'X-MBX-APIKEY': `${apiKey}` // APIKEY OF ACCOUNT B
        },
        method: 'GET',
        url: `${url}/fapi/v1/exchangeInfo?${parameter}&signature=${signatureSymbol}`
        }

        axios.request(options).then(async response =>{
            await response.data
            info = response.data.symbols
            for (const k of Object.values(info)){
            if (k.symbol === data.symbol){
                ctx.wizard.state.precision = k.quantityPrecision
            }
        }
    }).then(response =>{
        let qty = (ctx.wizard.state.leverage * ctx.wizard.state.amount / data.price)
        let params = `symbol=${data.symbol}&side=${side}&type=LIMIT&price=${data.price}&quantity=${qty.toFixed(ctx.wizard.state.precision)}&timeInForce=GTC&recvWindow=5000&timestamp=${Date.now()}`;
        let signature = CryptoJS.HmacSHA256(params, apiSecret).toString(CryptoJS.enc.Hex);
        var options = {
        headers: {
            "X-MBX-APIKEY": `${apiKey}`, // APIKEY OF ACCOUNT B
        },
        method: "POST",
        url: `${url}/fapi/v1/order?${params}&signature=${signature}`,
        };
        axios.request(options).then(async (response) => {
            await response.data;
            ctx.reply("Orden Limit enviada!");
            return ctx.scene.leave();

        }).catch((error) => ctx.reply(`ERROR: ${error.response.data.msg}`))
    }).catch((error) => ctx.reply(`ERROR: ${error.response.data.msg}`));
})



// BITGET
const LEVERAGE_AUTO_BITGET = Telegraf.hears(/^[0-9]+$/, (ctx) => {
    const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })
    let data = extractTradeInfo(text)
    let symbol = data.symbol + '_UMCBL'
    client.setLeverage(symbol, 'USDT', ctx.message.text)
        .then( response =>{
            ctx.wizard.state.leverage = response.data.crossMarginLeverage
            ctx.reply('Por favor indique el tamaño de su orden en USDT')
        }).catch(error => console.error(error))
    return ctx.wizard.next()
});

const DESIRE_AMOUNT_BITGET = Telegraf.hears(/.*/, (ctx) => {
    const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })

    let data = extractTradeInfo(text)

    let side;
    if (data.side === 'Venta') {
      side = "open_short";
    } else if (data.side === 'Compra') {
      side = "open_long";
    }

    let symbol = data.symbol + '_UMCBL'
    let amount = (ctx.message.text * ctx.wizard.state.leverage)/ Number(data.price)
    client.submitOrder({
        symbol: `${symbol}`,
        marginCoin: 'USDT',
        side: `${side}`,
        size: amount,
        orderType: 'limit',
        price: data.price
    })
    .then(response =>{
        if (response.msg === 'success'){
            ctx.reply(`Su orden ha sido enviada satisfactoriamente a ${symbol} @ MARKET PRICE`)
        }
    }).catch(error => console.error(error))
    return ctx.scene.leave()
});


/***
 * 
 * Scenes
 * 
 */

const StopLossBitget = new WizardScene('stopOrderBitget', SYMBOL_STOP_BITGET, PRICE_STOP_BITGET )
StopLossBitget.enter(ctx => ctx.reply('Indique el simbolo en el que quiere enviar el stop loss'))

const takeProfitBitget = new WizardScene('takeOrderBitget', SYMBOL_TAKE_BITGET, PRICE_TAKE_BITGET )
takeProfitBitget.enter(ctx => ctx.reply('Indique el simbolo en el que quiere enviar el Take Profit'))

const NEW_LIMIT_Bitget = new WizardScene('limitBitget', SYMBOL_LIMIT_BITGET, PRICE_LIMIT_BITGET, ORDER_SIDE_LIMIT_BITGET, LEVERAGE_LIMIT_BITGET, AMOUNT_LIMIT_BITGET)
NEW_LIMIT_Bitget.enter(ctx => ctx.reply('En que simbolo le gustaria enviar la orden? Ex: BTCUSDT, ETHUSDT, etc..'))

const NEW_ORDER_BITGET = new WizardScene('newOrderBitget', SYMBOL_BITGET, ORDER_SIDE_BITGET, LEVERAGE_BITGET, AMOUNT_BITGET)
NEW_ORDER_BITGET.enter((ctx) =>ctx.reply('En que simbolo le gustaria enviar la orden? Ex: BTCUSDT, ETHUSDT, etc..'))

const bitgetApiKey = new WizardScene('bitgetApi', BITGET_API_KEY, BITGET_API_SECRET, BITGET_PHRASE)
bitgetApiKey.enter((ctx) =>{
    ctx.replyWithHTML('Por favor coloque su <b>BITGET API KEY</b>, no incluya espacios ni caracteres extra.');
})

const apiKeyScene = new WizardScene('apiKeyScene', API_KEY, API_SECRET);
apiKeyScene.enter((ctx) => {
    ctx.replyWithHTML('Por favor coloque su <b>BINANCE API KEY</b>, no incluya espacios ni caracteres extra.');
});
const NEW_ORDER = new WizardScene('newOrder', SYMBOL, ORDER_SIDE, LEVERAGE, AMOUNT)
NEW_ORDER.enter((ctx) =>ctx.reply('En que simbolo le gustaria enviar la orden? Ex: BTCUSDT, ETHUSDT, etc..'))

const NEW_LIMIT = new WizardScene('limitOrder', SYMBOL_LIMIT, PRICE_LIMIT, ORDER_SIDE_LIMIT, LEVERAGE_LIMIT, AMOUNT_LIMIT)
NEW_LIMIT.enter(ctx => ctx.reply('En que simbolo le gustaria enviar la orden? Ex: BTCUSDT, ETHUSDT, etc..'))

const MarginType = new WizardScene('marginType', SYMBOL_MARGIN, MARGIN_TYPE)
MarginType.enter(ctx => ctx.reply('Indique el simbolo en el que quiere cambiar el tipo de margin'))

const StopLoss = new WizardScene('stopOrder', SYMBOL_STOP, PRICE_STOP )
StopLoss.enter(ctx => ctx.reply('Indique el simbolo en el que quiere enviar el stop loss'))

const TakeProfit = new WizardScene('takeOrder', SYMBOL_TAKE, PRICE_TAKE )
TakeProfit.enter(ctx => ctx.reply('Indique el simbolo en el que quiere enviar el take profit'))

const GetPosition = new WizardScene('getPos', SYMBOL_POS)
GetPosition.enter(ctx => ctx.reply('Por favor el simbolo de la posicion que desea obtener..'))

const GetPositionBITGET = new WizardScene('getPosBitget', SYMBOL_POS_BITGET)
GetPositionBITGET.enter(ctx => ctx.reply('Por favor el simbolo de la posicion que desea obtener..'))

const DesiredAmount = new WizardScene('desiredAmount', LEVERAGE_AUTO, DESIRE_AMOUNT )
DesiredAmount.enter(ctx => ctx.replyWithHTML('Por favor indique el <b>APALANCAMIENTO</b> que desea utilizar en la orden'))

const DesiredAmount_BITGET = new WizardScene('BitgetAutoOrder', LEVERAGE_AUTO_BITGET, DESIRE_AMOUNT_BITGET )
DesiredAmount_BITGET.enter(ctx => ctx.replyWithHTML('Por favor indique el <b>APALANCAMIENTO</b> que desea utilizar en la orden'))

const CancelOrderBitget = new WizardScene('cancelBitgetOrder', SYMBOL_CANCEL)
CancelOrderBitget.enter(ctx => ctx.replyWithHTML('¿Seguro que desea cancelar todas las ordenes? Esto incluye los <b>STOP LOSS</b> y <b>TAKE PROFIT</b> que tenga en posiciones abiertas (No se cerraran posiciones, solo se cancelaran ordenes pendientes)\n\nEscriba <b>SI</b> o <b>NO</b>'))

const stage = new Stage([apiKeyScene, NEW_ORDER, NEW_LIMIT, MarginType, StopLoss, TakeProfit, GetPosition, bitgetApiKey, NEW_LIMIT_Bitget, NEW_ORDER_BITGET, StopLossBitget, takeProfitBitget, DesiredAmount, DesiredAmount_BITGET, GetPositionBITGET, CancelOrderBitget]);
// Register the stage middleware
bot.use(stage.middleware());

// Command handler to enter the apiKeyScene
bot.command('binance_api_key', ctx => {
    ctx.scene.enter('apiKeyScene')
})
bot.command('bitget_api_key', ctx => {
    ctx.scene.enter('bitgetApi')
})
bot.action('newOrder', (ctx) => {
	ctx.answerCbQuery()
	ctx.scene.enter('newOrder')
})
bot.action('newLimit', (ctx) =>{
    ctx.answerCbQuery()
    ctx.scene.enter('limitOrder')
})
bot.action('marginType', (ctx) =>{
    ctx.answerCbQuery()
    ctx.scene.enter('marginType')
})
bot.action('stopLoss', (ctx) =>{
    ctx.answerCbQuery()
    ctx.scene.enter('stopOrder')
})
bot.action('takeProfit', (ctx) =>{
    ctx.answerCbQuery()
    ctx.scene.enter('takeOrder')
})

bot.action('oneUpdate', (ctx) =>{
    ctx.answerCbQuery()
    ctx.scene.enter('getPos')
})
bot.command('cancelar', ctx => {
    ctx.reply('Operacion cancelada')
    ctx.scene.leave()
})
bot.action('newLimitBitget', (ctx) =>{
    ctx.answerCbQuery()
    ctx.scene.enter('limitBitget')
})
bot.action('newOrderBitget', (ctx) =>{
    ctx.answerCbQuery()
    ctx.scene.enter('newOrderBitget')
})

bot.action('stopLossBitget', (ctx) =>{
    ctx.answerCbQuery()
    ctx.scene.enter('stopOrderBitget')
})

bot.action('takeProfitBitget', (ctx) =>{
    ctx.answerCbQuery()
    ctx.scene.enter('takeOrderBitget')
})
bot.action('oneUpdateBitget', (ctx) =>{
    ctx.answerCbQuery()
    ctx.scene.enter('getPosBitget')
})
bot.action('updateBitget', (ctx) =>{
    ctx.answerCbQuery()
    const client = new FuturesClient({
        apiKey: `${ctx.session.apiKeyBitget}`,
        apiSecret: `${ctx.session.apiSecretBitget}`,
        apiPass: `${ctx.session.apiBitgetPhrase}`
    })
    client.getPositions('umcbl', 'USDT')
        .then(response =>{
            let data = response.data
            for (const k of Object.values(data)){
                if (k.margin > 0){
                    console.log(k)
                    ctx.replyWithHTML(`<b>Symbol:</b> ${k.symbol}\n<b>Side:</b> ${k.holdSide}\n<b>Size:</b> ${k.margin}\n<b>Leverage:</b> ${k.leverage}\n<b>UnrealizedPnL:</b> ${k.unrealizedPL}\n<b>Current Price:</b> ${k.marketPrice}`)
                }
            }
        }).catch(error => console.error(error))
    return ctx.scene.leave()
})

bot.action('cancelBitget', (ctx) =>{
    ctx.answerCbQuery()
    ctx.scene.enter('cancelBitgetOrder')
})

bot.command('help', (ctx) =>{
    ctx.replyWithHTML(`Lista de comandos:
/start - Siga los pasos de este comando para registrar sus API Keys

/binance_api_key - Registre su API KEY de <b>BINANCE</b>

/bitget_api_key - Registre su API KEY de <b>BITGET</b>

/binance - Despliega el menu de opciones para realizar operaciones en su cuenta de <b>BINANCE</b>, debe haber registrado previamente sus API Keys

/bitget - Despliega el menu de opciones para realizar operaciones en su cuenta de <b>BITGET</b>, debe haber registrado previamente sus API Keys

/cancelar - Escriba este comando en cualquier momento para salir de la operacion.`)
})

bot.action('bitgetOrder', (ctx) =>{
    ctx.answerCbQuery()
    if (ctx.session.apiKeyBitget !== undefined && ctx.session.apiSecretBitget !== undefined && ctx.session.apiBitgetPhrase){
        ctx.scene.enter('BitgetAutoOrder')
    } else {
        ctx.replyWithHTML('Su API KEY Para <b>BITGET</b> no esta registrada, escriba /bitget_api_key para configurar sus keys e intente de nuevo')
    }
})

bot.action('binanceOrder', (ctx) =>{
    ctx.answerCbQuery()
    if (ctx.session.apiKey !== undefined && ctx.session.apiSecret !== undefined){
        ctx.scene.enter('desiredAmount')
    } else {
        ctx.replyWithHTML('Debe registrar sus <b>BINANCE API KEYs</b>, para hacerlo ejecute el comando /binance_api_key')
    }
})

bot.start((ctx) => ctx.replyWithHTML('🌟🌟<strong>Bienvenido a TheSignalsCompany Bot</strong>🌟🌟\n\n📌Para configurar sus API KEYS de <b>BINANCE</b> utiliza el comando /binance_api_key\n\n📌Para configurar tus API Keys de <b>BITGET</b> utiliza el comando /bitget_api_key\n\nUna vez hayas configurado tus API KEYs puedes utilizar /binance o /bitget para empezar a ejecutar operaciones\n\nPuede utilizar el boton de Menu para revisar la lista de comandos o /help para recibir ayuda'));

bot.command('listen',(ctx) =>{
app.post('/webhook', (req, res) => {
    // Handle webhook logic here
    let data = req.body
    if (data.includes('Crypto')){
        ctx.telegram.sendMessage(-1001774094104, req.body, {
            reply_markup: {
                inline_keyboard:[
                    [
                        {
                            text: 'Operar ahora',
                            url: 'https://t.me/TheSignalsCompany_bot'
                        }
                    ]
                ]
            }
        })
        res.sendStatus(200)        
    } else if (data.includes('Forex')){
        ctx.telegram.sendMessage(-1001663209308, req.body, {
            reply_markup: {
                inline_keyboard:[
                    [
                        {
                            text: 'Operar ahora',
                            url: 'https://t.me/TheSignalsCompany_bot'
                        }
                    ]
                ]
            }
        })
        res.sendStatus(200)        
    } else if (data.includes('Acciones')){
        ctx.telegram.sendMessage(-1001670482133 , req.body, {
            reply_markup: {
                inline_keyboard:[
                    [
                        {
                            text: 'Operar ahora',
                            url: 'https://t.me/TheSignalsCompany_bot'
                        }
                    ]
                ]
            }
        })
        res.sendStatus(200)   
    }

    })
    
    app.listen(port, async () => {
    console.log(`Listening at http://localhost:${port}`);
    });
})

bot.launch();

function roundDownToNearestThousand(num) {
  return Math.floor(num / 1000) * 1000;
}

function extractTradeInfo(tradeInfo) {
    const symbol = tradeInfo.match(/Symbol: #(\w+)/)[1];
    const side = tradeInfo.match(/Side: (.+)/)[1];
    const price = parseFloat(tradeInfo.match(/Precio: (.+)/)[1]);
    
    const targetsMatch = tradeInfo.match(/Targets([\s\S]+?)Stop Loss/);
    const targetsStr = targetsMatch ? targetsMatch[1] : '';
    const targetPrices = targetsStr.match(/([\d.]+) - T\d+/g).map(target => parseFloat(target.split(' - ')[0]));
    const hasT4 = targetsStr.includes('T4');
  
    const stopLossMatch = tradeInfo.match(/Stop Loss: (.+)/);
    const stopLoss = stopLossMatch ? parseFloat(stopLossMatch[1].split(' - ')[0]) : null;
  
    return { symbol, side, price, targetPrices, hasT4, stopLoss };
  }



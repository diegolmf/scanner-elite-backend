const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let bot = null;

function init() {
  if (!TOKEN) { console.log('⚠ Telegram token no configurado'); return; }
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log('✅ Telegram bot inicializado');
}

function fp(p) {
  if (!p) return '-';
  if (p >= 1000) return p.toFixed(1);
  if (p >= 1) return p.toFixed(3);
  return p.toFixed(6);
}

async function sendSignal(sig, capital) {
  if (!bot) return;
  const RISK_PCT = 0.015, RR = 2;
  const base = sig.symbol.replace('USDT', '');
  const emoji = sig.signalType === 'LONG' ? '🟢' : sig.signalType === 'SHORT' ? '🔴' : '🟡';
  const riskAmt = (capital * RISK_PCT).toFixed(0);
  const posSize = sig.slPrice ? ((capital * RISK_PCT) / Math.abs(sig.price - sig.slPrice)).toFixed(4) : '-';

  const msg = `${emoji} *${sig.signalType} — ${base}/USDT*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💰 *Entry:* \`$${fp(sig.price)}\`\n` +
    `🛑 *Stop Loss:* \`$${fp(sig.slPrice)}\`\n` +
    `🎯 *Take Profit:* \`$${fp(sig.tpPrice)}\`\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `📊 Score: *${sig.score}pts* | Conf: *${sig.confidence}%*\n` +
    `📈 RSI: ${sig.rsi} | VolR: ${sig.volRatio}x\n` +
    `💵 Pos: ${posSize} ${base} | Riesgo: $${riskAmt}\n` +
    `🔍 ${sig.signals.slice(0, 3).join(' · ')}\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `⏰ ${new Date().toLocaleTimeString('es-CL')}`;

  try {
    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

async function sendAutoClose(trade, result) {
  if (!bot) return;
  const base = trade.symbol.replace('USDT', '');
  const isWin = result === 'win';
  const emoji = isWin ? '✅' : '❌';
  const pnlStr = isWin ? `+$${Math.abs(trade.pnl).toFixed(0)}` : `-$${Math.abs(trade.pnl).toFixed(0)}`;

  const msg = `${emoji} *${isWin ? 'TAKE PROFIT' : 'STOP LOSS'} ALCANZADO*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💎 *${base}/USDT* — ${trade.type}\n` +
    `📍 Entry: \`$${fp(trade.entry_price)}\`\n` +
    `📍 Cierre: \`$${fp(trade.close_price)}\`\n` +
    `${isWin ? '🎯' : '🛑'} ${isWin ? 'TP' : 'SL'}: \`$${fp(isWin ? trade.tp_price : trade.sl_price)}\`\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💵 P&L: *${pnlStr} USD*\n` +
    `⏰ ${new Date().toLocaleTimeString('es-CL')} 🤖 AUTO`;

  try {
    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

async function sendStatus(stats) {
  if (!bot) return;
  const wr = stats.total_trades > 0 ? Math.round(stats.wins / stats.total_trades * 100) : 0;
  const msg = `📊 *REPORTE DIARIO — SCANNER ELITE*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `🏆 Win Rate: *${wr}%*\n` +
    `💵 P&L Total: *$${stats.total_pnl.toFixed(0)} USD*\n` +
    `📈 Operaciones: ${stats.total_trades}\n` +
    `✅ Ganadoras: ${stats.wins}\n` +
    `❌ Perdedoras: ${stats.losses}\n` +
    `💰 Capital: $${stats.capital}\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `⏰ ${new Date().toLocaleString('es-CL')}`;
  try {
    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

module.exports = { init, sendSignal, sendAutoClose, sendStatus };

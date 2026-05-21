const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const MIN_SCORE = 12;
const MIN_CONFIDENCE = 65;

let bot = null;

function fp(p) {
  if (!p) return '-';
  if (p >= 1000) return p.toFixed(1);
  if (p >= 1) return p.toFixed(3);
  return p.toFixed(6);
}

function init(db) {
  if (!TOKEN) { console.log('⚠ Telegram token no configurado'); return; }
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log('✅ Telegram bot inicializado con comandos');

  // /status
  bot.onText(/\/status/, async (msg) => {
    const stats = db.getStats();
    const history = db.getHistory(1000);
    const closed = history.filter(t => t.result !== 'pending');
    const wins = closed.filter(t => t.result === 'win');
    const losses = closed.filter(t => t.result === 'loss');
    const pending = history.filter(t => t.result === 'pending');
    const wr = closed.length > 0 ? Math.round(wins.length / closed.length * 100) : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s,t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s,t) => s + t.pnl, 0) / losses.length) : 0;
    const ratio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '-';
    const text = `📊 *ESTADO ACTUAL — SCANNER ELITE*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `🏆 Win Rate: *${wr}%*\n` +
      `💵 P&L Total: *$${stats.total_pnl.toFixed(0)} USD*\n` +
      `📈 Operaciones: ${closed.length}\n` +
      `✅ Ganadoras: ${wins.length}\n` +
      `❌ Perdedoras: ${losses.length}\n` +
      `⏳ Pendientes: ${pending.length}\n` +
      `📐 Ratio G/P: ${ratio}\n` +
      `💰 Capital: $${stats.capital}\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `🔧 Filtros: Score≥${MIN_SCORE}pts | Conf≥${MIN_CONFIDENCE}%\n` +
      `⏰ ${new Date().toLocaleString('es-CL')}`;
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  });

  // /pendientes
  bot.onText(/\/pendientes/, async (msg) => {
    const pending = db.getHistory(100).filter(t => t.result === 'pending');
    if (!pending.length) {
      await bot.sendMessage(msg.chat.id, '📭 No hay operaciones pendientes.');
      return;
    }
    let text = `⏳ *OPERACIONES PENDIENTES (${pending.length})*\n━━━━━━━━━━━━━━━━━\n`;
    pending.forEach(t => {
      const base = t.symbol.replace('USDT', '');
      const em = t.type === 'LONG' ? '🟢' : '🔴';
      text += `${em} *${base}* ${t.type}\n`;
      text += `  Entry: $${fp(t.entry_price)} | SL: $${fp(t.sl_price)} | TP: $${fp(t.tp_price)}\n`;
      text += `  Score: ${t.score}pts | ${t.created_at}\n\n`;
    });
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  });

  // /filtros
  bot.onText(/\/filtros/, async (msg) => {
    const text = `🔧 *FILTROS ACTIVOS*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `📊 Score mínimo: *${MIN_SCORE} pts*\n` +
      `🎯 Confianza mínima: *${MIN_CONFIDENCE}%*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `💰 Riesgo por op: *1.5% del capital*\n` +
      `📐 Ratio SL/TP: *1:2*\n` +
      `⏱ Temporalidad: *15 minutos*`;
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  });

  // /test
  bot.onText(/\/test/, async (msg) => {
    const stats = db.getStats();
    const history = db.getHistory(1000);
    const pending = history.filter(t => t.result === 'pending');
    const closed = history.filter(t => t.result !== 'pending');
    const wins = closed.filter(t => t.result === 'win');
    const text = `🧪 *TEST DE CONEXION — TODO OK*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `✅ Telegram: *Funcionando*\n` +
      `✅ Base de datos: *Conectada*\n` +
      `✅ Scanner: *Activo 24/7*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `🔧 *Filtros activos:*\n` +
      `   Score mínimo: *${MIN_SCORE} pts*\n` +
      `   Confianza mínima: *${MIN_CONFIDENCE}%*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `📊 *Estadísticas:*\n` +
      `   Capital: $${stats.capital}\n` +
      `   Operaciones cerradas: ${closed.length}\n` +
      `   Ganadoras: ${wins.length}\n` +
      `   Pendientes: ${pending.length}\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `⏰ ${new Date().toLocaleString('es-CL')}`;
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  });

  // /ayuda
  bot.onText(/\/ayuda|\/help|\/start/, async (msg) => {
    const text = `🤖 *SCANNER ELITE — COMANDOS*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `📊 /status — Reporte completo de rendimiento\n` +
      `⏳ /pendientes — Ver operaciones abiertas\n` +
      `🔧 /filtros — Ver filtros activos\n` +
      `🧪 /test — Verificar que todo funciona\n` +
      `❓ /ayuda — Esta lista de comandos\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `_El bot envía señales automáticamente 24/7_`;
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  });
}

async function sendSignal(sig, capital) {
  if (!bot) return;
  const base = sig.symbol.replace('USDT', '');
  const emoji = sig.signalType === 'LONG' ? '🟢' : '🔴';
  const riskAmt = (capital * 0.015).toFixed(0);
  const posSize = sig.slPrice ? ((capital * 0.015) / Math.abs(sig.price - sig.slPrice)).toFixed(4) : '-';
  const score = sig.longScore + sig.shortScore;
  const msg = `${emoji} *${sig.signalType} — ${base}/USDT*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💰 *Entry:* \`$${fp(sig.price)}\`\n` +
    `🛑 *Stop Loss:* \`$${fp(sig.slPrice)}\`\n` +
    `🎯 *Take Profit:* \`$${fp(sig.tpPrice)}\`\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `📊 Score: *${score}pts* | Conf: *${sig.confidence}%*\n` +
    `📈 RSI: ${sig.rsi} | VolR: ${sig.volRatio}x\n` +
    `💵 Pos: ${posSize} ${base} | Riesgo: $${riskAmt}\n` +
    `🔍 ${sig.signals.slice(0, 3).join(' · ')}\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `⏰ ${new Date().toLocaleTimeString('es-CL')}`;
  try {
    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
  } catch(e) {
    console.error('Telegram error:', e.message);
  }
}

async function sendAutoClose(trade, result) {
  if (!bot) return;
  const base = trade.symbol.replace('USDT', '');
  const isWin = result === 'win';
  const pnlStr = isWin ? `+$${Math.abs(trade.pnl).toFixed(0)}` : `-$${Math.abs(trade.pnl).toFixed(0)}`;
  const msg = `${isWin ? '✅' : '❌'} *${isWin ? 'TAKE PROFIT' : 'STOP LOSS'} ALCANZADO*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💎 *${base}/USDT* — ${trade.type}\n` +
    `📍 Entry: \`$${fp(trade.entry_price)}\`\n` +
    `📍 Cierre: \`$${fp(trade.close_price)}\`\n` +
    `${isWin ? '🎯 TP' : '🛑 SL'}: \`$${fp(isWin ? trade.tp_price : trade.sl_price)}\`\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💵 P&L: *${pnlStr} USD*\n` +
    `⏰ ${new Date().toLocaleTimeString('es-CL')} 🤖 AUTO`;
  try {
    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
  } catch(e) {
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
  } catch(e) {
    console.error('Telegram error:', e.message);
  }
}

async function sendStartup() {
  if (!bot) return;
  const msg = `🟢 *SCANNER ELITE ONLINE*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `✅ Servidor iniciado correctamente\n` +
    `📊 Filtros: Score≥${MIN_SCORE}pts | Conf≥${MIN_CONFIDENCE}%\n` +
    `🔄 Escaneando 20 pares cada 15s\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `⏰ ${new Date().toLocaleString('es-CL')}\n` +
    `_Escribe /ayuda para ver los comandos_`;
  try {
    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
  } catch(e) {
    console.error('Telegram startup error:', e.message);
  }
}

module.exports = { init, sendSignal, sendAutoClose, sendStatus, sendStartup };

const fetch = require('node-fetch');
const { analyze } = require('./indicators');
const db = require('./database');
const telegram = require('./telegram');

const SYMBOLS = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT',
  'ADAUSDT','DOGEUSDT','AVAXUSDT','DOTUSDT','MATICUSDT',
  'LINKUSDT','LTCUSDT','ATOMUSDT','UNIUSDT','XLMUSDT',
  'NEARUSDT','FTMUSDT','ALGOUSDT','VETUSDT','TRXUSDT'
];

// ============================================================
// FILTROS DE CALIDAD
// ============================================================
const MIN_SCORE = 12;        // Score minimo — mas indicadores alineados
const MIN_CONFIDENCE = 65;   // Confianza minima en %
// ============================================================

const HOSTS = [
  'https://api.binance.com','https://api1.binance.com',
  'https://api2.binance.com','https://api3.binance.com',
  'https://data-api.binance.vision',
];
let hostIdx = 0;
let prevSignals = {};
let isRunning = false;

async function apiFetch(path) {
  for (let i = 0; i < HOSTS.length; i++) {
    const host = HOSTS[(hostIdx + i) % HOSTS.length];
    try {
      const res = await fetch(host + path, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScannerBot/1.0)', 'Accept': 'application/json' },
        timeout: 10000,
      });
      if (res.ok) { hostIdx = (hostIdx + i) % HOSTS.length; return res.json(); }
    } catch(e) { console.log(`Host ${host} falló: ${e.message}`); }
  }
  throw new Error('Todos los hosts de Binance fallaron');
}

async function fetchKlines(sym, interval, limit) {
  return apiFetch(`/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`);
}
async function fetch24hr() {
  return apiFetch(`/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(SYMBOLS))}`);
}

// Evalua si una señal pasa los filtros de calidad
function passesQualityFilter(sig) {
  const score = sig.longScore + sig.shortScore;

  // Score minimo
  if (score < MIN_SCORE) return { ok: false, reason: `Score ${score} < ${MIN_SCORE}` };

  // Confianza minima
  if (sig.confidence < MIN_CONFIDENCE) return { ok: false, reason: `Conf ${sig.confidence}% < ${MIN_CONFIDENCE}%` };

  return { ok: true };
}

async function checkAutoClose(prices) {
  const pending = db.getPending();
  if (!pending.length) return;
  const stats = db.getStats();
  const RISK_PCT = 0.015, RR = 2;

  for (const trade of pending) {
    const price = prices[trade.symbol];
    if (!price) continue;
    let result = null;
    if (trade.type === 'LONG') {
      if (price >= trade.tp_price) result = 'win';
      else if (price <= trade.sl_price) result = 'loss';
    } else if (trade.type === 'SHORT') {
      if (price <= trade.tp_price) result = 'win';
      else if (price >= trade.sl_price) result = 'loss';
    }
    if (result) {
      const risk = stats.capital * RISK_PCT;
      const pnl = result === 'win' ? risk * RR : -risk;
      trade.pnl = pnl; trade.close_price = price;
      db.closeSignal(trade.id, result, price, pnl);
      db.updateStats(result === 'win' ? 1 : 0, result === 'loss' ? 1 : 0, pnl);
      console.log(`🤖 AUTO-CLOSE: ${trade.symbol} ${result.toUpperCase()} P&L: $${pnl.toFixed(0)}`);
      await telegram.sendAutoClose(trade, result);
    }
  }
}

async function scan() {
  if (isRunning) return;
  isRunning = true;
  try {
    const ticker24 = await fetch24hr();
    const tmap = {}, prices = {};
    ticker24.forEach(t => { tmap[t.symbol] = t; prices[t.symbol] = parseFloat(t.lastPrice); });

    await checkAutoClose(prices);

    const stats = db.getStats();
    for (const sym of SYMBOLS) {
      try {
        const [k1m, k5m, k15m, k1h] = await Promise.all([
          fetchKlines(sym, '1m', 30), fetchKlines(sym, '5m', 40),
          fetchKlines(sym, '15m', 50), fetchKlines(sym, '1h', 50),
        ]);
        const sig = analyze(sym, k1m, k5m, k15m, k1h, tmap[sym], prevSignals[sym]);
        const isNew = prevSignals[sym] !== sig.signalType;

        if (isNew && sig.state === 'ACTIVO' && !sig.signalType.startsWith('CLOSE')) {
          // Aplicar filtros de calidad
          const quality = passesQualityFilter(sig);

          if (!quality.ok) {
            console.log(`⏭ Señal descartada ${sym} ${sig.signalType}: ${quality.reason}`);
          } else if (!db.signalExists(sym, sig.signalType)) {
            const RISK_PCT = 0.015;
            const riskAmt = stats.capital * RISK_PCT;
            const posSz = sig.slPrice ? riskAmt / Math.abs(sig.price - sig.slPrice) : null;

            db.addSignal({
              symbol: sym, type: sig.signalType, state: sig.state,
              entry_price: sig.price, sl_price: sig.slPrice, tp_price: sig.tpPrice,
              pos_size: posSz, score: sig.score, confidence: sig.confidence,
              rsi: sig.rsi, vol_ratio: sig.volRatio
            });
            sig.posSize = posSz;
            await telegram.sendSignal(sig, stats.capital);
            console.log(`🔔 SEÑAL ELITE: ${sym} ${sig.signalType} Score:${sig.score} Conf:${sig.confidence}% VolR:${sig.volRatio}x`);
          }
        }
        prevSignals[sym] = sig.signalType;
      } catch(e) {
        console.error(`Error ${sym}: ${e.message}`);
      }
    }
    console.log(`✅ Scan: ${new Date().toLocaleTimeString('es-CL')}`);
  } catch(e) {
    console.error('Error en scan:', e.message);
  } finally {
    isRunning = false;
  }
}

function scheduleDailyReport() {
  const now = new Date();
  const next8am = new Date();
  next8am.setHours(8, 0, 0, 0);
  if (now >= next8am) next8am.setDate(next8am.getDate() + 1);
  setTimeout(() => {
    const stats = db.getStats();
    telegram.sendStatus(stats);
    setInterval(() => { const s = db.getStats(); telegram.sendStatus(s); }, 24 * 60 * 60 * 1000);
  }, next8am - now);
}

function start() {
  console.log(`🚀 Scanner Elite iniciado`);
  console.log(`📊 Filtros: Score>=${MIN_SCORE} | Conf>=${MIN_CONFIDENCE}%`);
  scan();
  setInterval(scan, 15000);
  scheduleDailyReport();
}

module.exports = { start, scan, prevSignals };

// Technical indicators engine

function ema(closes, period) {
  const k = 2 / (period + 1);
  let e = closes[0];
  for (let i = 1; i < closes.length; i++) e = closes[i] * k + e * (1 - k);
  return e;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const ag = gains / period, al = losses / period;
  if (al === 0) return 100;
  return 100 - (100 / (1 + ag / al));
}

function macd(closes) { return ema(closes, 12) - ema(closes, 26); }

function bollingerBands(closes, period = 20, mult = 2) {
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const sd = Math.sqrt(slice.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / period);
  return { upper: mean + mult * sd, lower: mean - mult * sd };
}

function volumeRatio(volumes) {
  return (volumes.slice(-5).reduce((a, b) => a + b, 0) / 5) /
    (volumes.slice(-20).reduce((a, b) => a + b, 0) / 20);
}

function atr(highs, lows, closes, period = 14) {
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function analyze(symbol, k1m, k5m, k15m, k1h, ticker, prevSignal) {
  const parse = k => ({ o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]) });
  const p1 = k1m.map(parse), p5 = k5m.map(parse), p15 = k15m.map(parse), p1h = k1h.map(parse);
  const c1 = p1.map(k => k.c), c5 = p5.map(k => k.c), c15 = p15.map(k => k.c), c1h = p1h.map(k => k.c);
  const hi15 = p15.map(k => k.h), lo15 = p15.map(k => k.l), v15 = p15.map(k => k.v);

  const price = c1[c1.length - 1];
  const pchg = parseFloat(ticker.priceChangePercent);
  const vol24 = parseFloat(ticker.quoteVolume);

  const r5 = rsi(c5), r15 = rsi(c15), r1h = rsi(c1h);
  const m5 = macd(c5), m15 = macd(c15);
  const e9 = ema(c15, 9), e21 = ema(c15, 21), e50h = ema(c1h, 50), e200h = ema(c1h, 200);
  const bb = bollingerBands(c15);
  const volR = volumeRatio(v15);
  const atrVal = atr(hi15, lo15, c15);

  const last = p15[p15.length - 1], prev = p15[p15.length - 2];
  const body = Math.abs(last.c - last.o), range = last.h - last.l;
  const bullEngulf = last.c > last.o && prev.c < prev.o && last.c > prev.o && last.o < prev.c;
  const bearEngulf = last.c < last.o && prev.c > prev.o && last.c < prev.o && last.o > prev.c;
  const pinBar = range > 0 && body / range < 0.3;

  let ls = 0, ss = 0, sigs = [];
  if (r5 < 30 && r15 < 35) { ls += 3; sigs.push('RSI SBO'); }
  else if (r5 > 70 && r15 > 65) { ss += 3; sigs.push('RSI SBS'); }
  else if (r15 < 45) ls += 1; else if (r15 > 55) ss += 1;
  if (m15 > 0 && m5 > 0) { ls += 2; sigs.push('MACD↑'); }
  else if (m15 < 0 && m5 < 0) { ss += 2; sigs.push('MACD↓'); }
  if (e9 > e21) { ls += 2; sigs.push('EMA9>21'); } else { ss += 2; sigs.push('EMA9<21'); }
  if (e50h > e200h) { ls += 2; sigs.push('EMA50>200'); } else { ss += 1; sigs.push('EMA50<200'); }
  if (price < bb.lower) { ls += 3; sigs.push('BB LOWER'); }
  else if (price > bb.upper) { ss += 3; sigs.push('BB UPPER'); }
  if (volR > 2) {
    if (ls > ss) { ls += 3; sigs.push('VOL INST'); } else { ss += 3; sigs.push('VOL INST'); }
  } else if (volR > 1.5) sigs.push('VOL ALT');
  if (bullEngulf) { ls += 2; sigs.push('ENGULF↑'); }
  if (bearEngulf) { ss += 2; sigs.push('ENGULF↓'); }
  if (pinBar && ls > ss) { ls += 1; sigs.push('PIN BAR'); }
  else if (pinBar && ss > ls) { ss += 1; sigs.push('PIN BAR'); }
  if (pchg > 3) ls += 1; else if (pchg < -3) ss += 1;

  const total = ls + ss, diff = ls - ss;
  const conf = total > 0 ? Math.abs(diff) / total : 0;

  let signalType, state;
  if (ls >= 8 && diff >= 4) { signalType = 'LONG'; state = conf > 0.5 ? 'ACTIVO' : 'NEUTRAL'; }
  else if (ss >= 8 && diff <= -4) { signalType = 'SHORT'; state = conf > 0.5 ? 'ACTIVO' : 'NEUTRAL'; }
  else if (prevSignal === 'LONG' && (ss > ls || r5 > 65)) { signalType = 'CLOSE_LONG'; state = 'ACTIVO'; }
  else if (prevSignal === 'SHORT' && (ls > ss || r5 < 35)) { signalType = 'CLOSE_SHORT'; state = 'ACTIVO'; }
  else { signalType = ls > ss ? 'LONG' : 'SHORT'; state = 'NEUTRAL'; }

  let slPrice = null, tpPrice = null, posSize = null;
  const RISK_PCT = 0.015, ATR_SL = 1.5, RR = 2;

  if (state === 'ACTIVO' && !signalType.startsWith('CLOSE')) {
    if (signalType === 'LONG') {
      slPrice = price - atrVal * ATR_SL;
      tpPrice = price + (price - slPrice) * RR;
    } else {
      slPrice = price + atrVal * ATR_SL;
      tpPrice = price - (slPrice - price) * RR;
    }
  }

  let volDisplay;
  if (vol24 >= 1e9) volDisplay = `$${(vol24 / 1e9).toFixed(1)}B`;
  else if (vol24 >= 1e6) volDisplay = `$${(vol24 / 1e6).toFixed(0)}M`;
  else volDisplay = `$${(vol24 / 1e3).toFixed(0)}K`;

  return {
    symbol, signalType, state, price, priceChange24h: pchg,
    longScore: ls, shortScore: ss, score: ls + ss,
    confidence: Math.round(conf * 100),
    rsi: Math.round(r15), rsi1h: Math.round(r1h),
    volRatio: volR.toFixed(2), volDisplay,
    signals: sigs.slice(0, 5), slPrice, tpPrice, posSize, atrVal
  };
}

module.exports = { analyze };

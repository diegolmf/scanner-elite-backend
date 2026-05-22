require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database');
const scanner = require('./scanner');
const telegram = require('./telegram');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(db.getHistory(limit));
});

app.get('/api/stats', (req, res) => {
  const stats = db.getStats();
  const history = db.getHistory(1000);
  const closed = history.filter(t => t.result !== 'pending');
  const wins = closed.filter(t => t.result === 'win');
  const losses = closed.filter(t => t.result === 'loss');
  const pending = history.filter(t => t.result === 'pending');
  const avgWin = wins.length > 0 ? wins.reduce((s,t) => s+t.pnl, 0)/wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s,t) => s+t.pnl, 0)/losses.length) : 0;
  res.json({
    ...stats,
    win_rate: closed.length > 0 ? Math.round(wins.length/closed.length*100) : null,
    pending_count: pending.length,
    avg_win: avgWin.toFixed(2),
    avg_loss: avgLoss.toFixed(2),
    ratio: avgLoss > 0 ? (avgWin/avgLoss).toFixed(2) : '-'
  });
});

app.post('/api/capital', (req, res) => {
  const { capital } = req.body;
  if (!capital || capital < 10) return res.status(400).json({ error: 'Capital invalido' });
  db.updateCapital(capital);
  res.json({ ok: true, capital });
});

app.post('/api/close/:id', (req, res) => {
  const { result } = req.body;
  const { id } = req.params;
  if (!['win','loss'].includes(result)) return res.status(400).json({ error: 'Resultado invalido' });
  const stats = db.getStats();
  const pnl = result === 'win' ? stats.capital*0.015*2 : -(stats.capital*0.015);
  db.closeSignal(parseInt(id), result, null, pnl);
  db.updateStats(result==='win'?1:0, result==='loss'?1:0, pnl);
  res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'running', uptime: process.uptime(), time: new Date().toLocaleString('es-CL') });
});

app.listen(PORT, async () => {
  console.log(`🌐 Server corriendo en puerto ${PORT}`);
  telegram.init(db);
  setTimeout(async () => { await telegram.sendStartup(); }, 3000);
  scanner.start();
});

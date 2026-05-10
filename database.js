const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'scanner.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL,
    state TEXT NOT NULL,
    entry_price REAL NOT NULL,
    sl_price REAL,
    tp_price REAL,
    pos_size REAL,
    score INTEGER,
    confidence INTEGER,
    rsi INTEGER,
    vol_ratio TEXT,
    result TEXT DEFAULT 'pending',
    pnl REAL DEFAULT 0,
    auto_close INTEGER DEFAULT 0,
    close_price REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    capital REAL DEFAULT 1000,
    total_trades INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_pnl REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO stats (id, capital) VALUES (1, 1000);
`);

module.exports = {
  // Signals
  addSignal: (sig) => {
    const stmt = db.prepare(`
      INSERT INTO signals (symbol, type, state, entry_price, sl_price, tp_price, pos_size, score, confidence, rsi, vol_ratio)
      VALUES (@symbol, @type, @state, @entry_price, @sl_price, @tp_price, @pos_size, @score, @confidence, @rsi, @vol_ratio)
    `);
    return stmt.run(sig);
  },

  closeSignal: (id, result, close_price, pnl) => {
    const stmt = db.prepare(`
      UPDATE signals SET result=?, pnl=?, auto_close=1, close_price=?, closed_at=CURRENT_TIMESTAMP WHERE id=?
    `);
    return stmt.run(result, pnl, close_price, id);
  },

  getPending: () => {
    return db.prepare(`SELECT * FROM signals WHERE result='pending' AND sl_price IS NOT NULL`).all();
  },

  getHistory: (limit = 100) => {
    return db.prepare(`SELECT * FROM signals ORDER BY created_at DESC LIMIT ?`).all(limit);
  },

  getStats: () => {
    return db.prepare(`SELECT * FROM stats WHERE id=1`).get();
  },

  updateStats: (wins, losses, pnl) => {
    db.prepare(`
      UPDATE stats SET
        total_trades = total_trades + ?,
        wins = wins + ?,
        losses = losses + ?,
        total_pnl = total_pnl + ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(wins + losses, wins, losses, pnl);
  },

  updateCapital: (capital) => {
    db.prepare(`UPDATE stats SET capital=? WHERE id=1`).run(capital);
  },

  signalExists: (symbol, type) => {
    const recent = db.prepare(`
      SELECT id FROM signals WHERE symbol=? AND type=? AND result='pending'
      AND created_at > datetime('now', '-4 hours')
    `).get(symbol, type);
    return !!recent;
  },

  db
};

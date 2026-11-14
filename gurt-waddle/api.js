// Gurt's Waddle API: scores and progress for the platformer, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'waddle.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bird TEXT NOT NULL,
    score INTEGER NOT NULL,
    coins INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    seconds INTEGER NOT NULL DEFAULT 0,
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS runs_score ON runs(score DESC);
  CREATE TABLE IF NOT EXISTS daily (
    date TEXT NOT NULL,
    bird TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    at TEXT NOT NULL,
    PRIMARY KEY (date, bird)
  );
  CREATE INDEX IF NOT EXISTS daily_score ON daily(date, score DESC);
  CREATE TABLE IF NOT EXISTS progress (
    bird TEXT PRIMARY KEY,
    level INTEGER NOT NULL DEFAULT 1,
    score INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 0,
    updated TEXT NOT NULL
  );
`);

const stmt = {
  top: db.prepare('SELECT bird, score, coins, level, seconds, at FROM runs ORDER BY score DESC, seconds ASC LIMIT 20'),
  best: db.prepare('SELECT MAX(score) AS score FROM runs WHERE bird = ?'),
  insertRun: db.prepare('INSERT INTO runs (bird,score,coins,level,seconds,at) VALUES (@bird,@score,@coins,@level,@seconds,@at)'),
  getProgress: db.prepare('SELECT * FROM progress WHERE bird = ?'),
  dailyTop: db.prepare('SELECT bird, score, level, at FROM daily WHERE date = ? ORDER BY score DESC, at ASC LIMIT 20'),
  dailyBest: db.prepare('SELECT MAX(score) AS score FROM daily WHERE date = ? AND bird = ?'),
  upsertDaily: db.prepare(`INSERT INTO daily (date,bird,score,level,at) VALUES (@date,@bird,@score,@level,@at)
    ON CONFLICT(date,bird) DO UPDATE SET score=MAX(score,excluded.score), level=excluded.level, at=excluded.at`),
  stats: db.prepare(`SELECT COUNT(*) AS runs, COUNT(DISTINCT bird) AS birds, COALESCE(MAX(score),0) AS best, COALESCE(MAX(level),0) AS deepest, COALESCE(SUM(coins),0) AS coins FROM runs`),
  upsertProgress: db.prepare(`INSERT INTO progress (bird,level,score,coins,updated) VALUES (@bird,@level,@score,@coins,@updated)
    ON CONFLICT(bird) DO UPDATE SET level=MAX(level,excluded.level), score=MAX(score,excluded.score), coins=MAX(coins,excluded.coins), updated=excluded.updated`)
};

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 20000) req.destroy(); });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
    cb(body);
  });
}
function birdName(v) { return String(v || '').trim().slice(0, 18) || 'anonymous bird'; }
function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }

module.exports = function handler(req, res, seg) {
  const route = seg[0];

  if (req.method === 'GET' && route === 'scores') {
    return json(res, 200, { scores: stmt.top.all() });
  }

  if (req.method === 'GET' && route === 'stats') {
    const st = stmt.stats.get();
    const birds = db.prepare('SELECT bird, MAX(score) AS score, MAX(level) AS level FROM runs GROUP BY bird ORDER BY score DESC LIMIT 10').all();
    return json(res, 200, { stats: st, birds });
  }

  if (req.method === 'GET' && route === 'progress') {
    const bird = birdName(req.url.split('bird=')[1]);
    const p = stmt.getProgress.get(bird);
    return json(res, 200, { progress: p || { bird, level: 1, score: 0, coins: 0 } });
  }

  if (req.method === 'GET' && route === 'daily') {
    const date = String(req.url.split('date=')[1] || '').slice(0, 10) || today();
    return json(res, 200, { date, scores: stmt.dailyTop.all(date) });
  }

  if (req.method === 'POST' && route === 'daily') {
    return readBody(req, body => {
      const date = String(body.date || '').slice(0, 10) || today();
      const bird = birdName(body.bird);
      const score = Math.max(0, Math.min(1000000, Math.floor(Number(body.score) || 0)));
      const level = Math.max(1, Math.min(100, Math.floor(Number(body.level) || 1)));
      stmt.upsertDaily.run({ date, bird, score, level, at: now() });
      const best = stmt.dailyBest.get(date, bird);
      return json(res, 200, { ok: true, saved: true, best: best ? best.score : score, scores: stmt.dailyTop.all(date) });
    });
  }

  if (req.method === 'POST' && route === 'run') {
    return readBody(req, body => {
      const bird = birdName(body.bird);
      const score = Math.max(0, Math.min(1000000, Math.floor(Number(body.score) || 0)));
      const coins = Math.max(0, Math.min(100000, Math.floor(Number(body.coins) || 0)));
      const level = Math.max(1, Math.min(100, Math.floor(Number(body.level) || 1)));
      const seconds = Math.max(0, Math.min(1000000, Math.floor(Number(body.seconds) || 0)));
      stmt.insertRun.run({ bird, score, coins, level, seconds, at: now() });
      const best = stmt.best.get(bird);
      stmt.upsertProgress.run({ bird, level, score, coins, updated: now() });
      const rank = stmt.top.all().findIndex(r => r.bird === bird && r.score === score) + 1;
      return json(res, 200, { ok: true, saved: true, best: best ? best.score : score, rank: rank || null });
    });
  }

  if (req.method === 'POST' && route === 'progress') {
    return readBody(req, body => {
      const bird = birdName(body.bird);
      const level = Math.max(1, Math.min(100, Math.floor(Number(body.level) || 1)));
      const score = Math.max(0, Math.min(1000000, Math.floor(Number(body.score) || 0)));
      const coins = Math.max(0, Math.min(100000, Math.floor(Number(body.coins) || 0)));
      stmt.upsertProgress.run({ bird, level, score, coins, updated: now() });
      return json(res, 200, { ok: true, progress: stmt.getProgress.get(bird) });
    });
  }

  return false;
};

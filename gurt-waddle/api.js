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
  CREATE TABLE IF NOT EXISTS custom_likes (
    level_id TEXT NOT NULL,
    bird TEXT NOT NULL,
    at TEXT NOT NULL,
    PRIMARY KEY (level_id, bird)
  );
  CREATE TABLE IF NOT EXISTS custom_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level_id TEXT NOT NULL,
    bird TEXT NOT NULL,
    text TEXT NOT NULL,
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS custom_comments_level ON custom_comments(level_id, at DESC);
  CREATE TABLE IF NOT EXISTS custom_levels (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    grid TEXT NOT NULL,
    plays INTEGER NOT NULL DEFAULT 0,
    created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS levels (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    bird TEXT NOT NULL,
    grid TEXT NOT NULL,
    plays INTEGER NOT NULL DEFAULT 0,
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS levels_at ON levels(at DESC);
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
  listLevels: db.prepare('SELECT id, title, bird, plays, at FROM levels ORDER BY at DESC LIMIT 40'),
  getLevel: db.prepare('SELECT * FROM levels WHERE id = ?'),
  insertLevel: db.prepare('INSERT INTO levels (id,title,bird,grid,plays,at) VALUES (@id,@title,@bird,@grid,@plays,@at)'),
  bumpPlays: db.prepare('UPDATE levels SET plays = plays + 1 WHERE id = ?'),
  customList: db.prepare('SELECT id, title, author, plays, created FROM custom_levels ORDER BY created DESC LIMIT 50'),
  customGet: db.prepare('SELECT * FROM custom_levels WHERE id = ?'),
  customInsert: db.prepare('INSERT INTO custom_levels (id,title,author,grid,plays,created) VALUES (@id,@title,@author,@grid,@plays,@created)'),
  customPlay: db.prepare('UPDATE custom_levels SET plays = plays + 1 WHERE id = ?'),
  customLikes: db.prepare('SELECT COUNT(*) AS n FROM custom_likes WHERE level_id = ?'),
  customLikeAdd: db.prepare('INSERT OR IGNORE INTO custom_likes (level_id,bird,at) VALUES (?,?,?)'),
  customLikeRemove: db.prepare('DELETE FROM custom_likes WHERE level_id = ? AND bird = ?'),
  customLikeList: db.prepare('SELECT bird FROM custom_likes WHERE level_id = ?'),
  customComments: db.prepare('SELECT id, bird, text, at FROM custom_comments WHERE level_id = ? ORDER BY at DESC LIMIT 100'),
  customCommentAdd: db.prepare('INSERT INTO custom_comments (level_id,bird,text,at) VALUES (?,?,?,?)'),
  upsertProgress: db.prepare(`INSERT INTO progress (bird,level,score,coins,updated) VALUES (@bird,@level,@score,@coins,@updated)
    ON CONFLICT(bird) DO UPDATE SET level=MAX(level,excluded.level), score=MAX(score,excluded.score), coins=MAX(coins,excluded.coins), updated=excluded.updated`)
};

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
  return res;
}
function readBody(req, cb) {
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 20000) req.destroy(); });
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
      cb(body);
      resolve(true);
    });
  });
}
function birdName(v) { return String(v || '').trim().slice(0, 18) || 'anonymous bird'; }
function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }

module.exports = function handler(req, res, seg) {
  const route = seg.join('/');

  if (req.method === 'GET' && route === 'scores') {
    return json(res, 200, { scores: stmt.top.all() });
  }

  if (req.method === 'GET' && route === 'stats') {
    const st = stmt.stats.get();
    const birds = db.prepare('SELECT bird, MAX(score) AS score, MAX(level) AS level FROM runs GROUP BY bird ORDER BY score DESC LIMIT 10').all();
    return json(res, 200, { stats: st, birds });
  }

  if (req.method === 'GET' && route === 'custom') {
    const id = req.url.split('id=')[1];
    if (id) {
      const row = stmt.customGet.get(decodeURIComponent(id));
      if (!row) return json(res, 404, { error: 'no such level' });
      let rows = [];
      try { rows = JSON.parse(row.grid); } catch (e) {}
      return json(res, 200, { level: { id: row.id, title: row.title, author: row.author, plays: row.plays, rows } });
    }
    const rows = stmt.customList.all().map(r => ({ ...r, likes: stmt.customLikes.get(r.id).n }));
    return json(res, 200, { levels: rows });
  }

  if (req.method === 'POST' && route === 'custom') {
    return readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 40) || 'untitled level';
      const author = String(body.author || 'anonymous bird').trim().slice(0, 18) || 'anonymous bird';
      let rows = Array.isArray(body.rows) ? body.rows : [];
      rows = rows.map(r => String(r).slice(0, 25).padEnd(25, '.').slice(0, 25));
      if (rows.length !== 14) return json(res, 400, { error: 'a level needs 14 rows of 25 tiles' });
      const flat = rows.join('');
      if (!flat.includes('P')) return json(res, 400, { error: 'every level needs a start tile (P)' });
      if (!flat.includes('E')) return json(res, 400, { error: 'every level needs an exit tile (E)' });
      const id = 'lvl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      stmt.customInsert.run({ id, title, author, grid: JSON.stringify(rows), plays: 0, created: now() });
      return json(res, 200, { ok: true, level: { id, title, author, plays: 0 } });
    });
  }

  if (req.method === 'POST' && route === 'custom/play') {
    return readBody(req, body => {
      const id = String(body.id || '').slice(0, 40);
      stmt.customPlay.run(id);
      return json(res, 200, { ok: true });
    });
  }

  if (req.method === 'POST' && route === 'custom/like') {
    return readBody(req, body => {
      const id = String(body.id || '').slice(0, 40);
      const bird = birdName(body.bird);
      const liked = body.liked === false || body.liked === 0;
      if (liked) stmt.customLikeRemove.run(id, bird);
      else stmt.customLikeAdd.run(id, bird, now());
      return json(res, 200, { ok: true, likes: stmt.customLikes.get(id).n, liked: !liked });
    });
  }

  if (req.method === 'GET' && route === 'custom/comments') {
    const id = String(req.url.split('id=')[1] || '').slice(0, 40);
    const likes = stmt.customLikes.get(id).n;
    const likedBy = stmt.customLikeList.all(id).map(r => r.bird);
    return json(res, 200, { comments: stmt.customComments.all(id), likes, likedBy });
  }

  if (req.method === 'POST' && route === 'custom/comment') {
    return readBody(req, body => {
      const id = String(body.id || '').slice(0, 40);
      const bird = birdName(body.bird);
      const text = String(body.text || '').trim().slice(0, 300);
      if (!text) return json(res, 400, { error: 'comment text required' });
      stmt.customCommentAdd.run(id, bird, text, now());
      return json(res, 200, { ok: true, comments: stmt.customComments.all(id) });
    });
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

  if (req.method === 'GET' && route === 'levels') {
    return json(res, 200, { levels: stmt.listLevels.all() });
  }

  if (req.method === 'GET' && route === 'level') {
    const id = String(req.url.split('id=')[1] || '').slice(0, 40);
    const row = stmt.getLevel.get(id);
    if (!row) return json(res, 404, { error: 'no such level' });
    let grid = [];
    try { grid = JSON.parse(row.grid); } catch (e) {}
    return json(res, 200, { level: { id: row.id, title: row.title, bird: row.bird, grid, plays: row.plays, at: row.at } });
  }

  if (req.method === 'POST' && route === 'level') {
    return readBody(req, body => {
      const bird = birdName(body.bird);
      const title = String(body.title || '').trim().slice(0, 60) || 'a little level';
      let grid = body.grid;
      if (typeof grid === 'string') { try { grid = JSON.parse(grid); } catch (e) { grid = []; } }
      if (!Array.isArray(grid) || grid.length !== 14) return json(res, 400, { error: 'a level needs 14 rows' });
      const rows = grid.map(r => String(r).slice(0, 25).padEnd(25, '.'));
      if (rows.some(r => r.length !== 25)) return json(res, 400, { error: 'each row needs 25 tiles' });
      const flat = rows.join('');
      if (!flat.includes('P')) return json(res, 400, { error: 'every level needs a start tile (P)' });
      if (!flat.includes('E')) return json(res, 400, { error: 'every level needs an exit tile (E)' });
      const id = 'lv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      stmt.insertLevel.run({ id, title, bird, grid: JSON.stringify(rows), plays: 0, at: now() });
      return json(res, 200, { ok: true, level: { id, title, bird, grid: rows, plays: 0, at: now() } });
    });
  }

  if (req.method === 'POST' && route === 'level/play') {
    return readBody(req, body => {
      const id = String(body.id || '').slice(0, 40);
      stmt.bumpPlays.run(id);
      const row = stmt.getLevel.get(id);
      return json(res, 200, { ok: true, plays: row ? row.plays : 0 });
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

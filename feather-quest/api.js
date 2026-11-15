// Feather Quest API: a shared quest board for small birds, stored in SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const https = require('https');

const DATA = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const db = new Database(path.join(DATA, 'quest.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS quests (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    goal INTEGER NOT NULL DEFAULT 1,
    points INTEGER NOT NULL DEFAULT 10,
    bird TEXT NOT NULL DEFAULT 'gurt',
    created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS claims (
    quest_id TEXT NOT NULL,
    bird TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0,
    at TEXT NOT NULL,
    PRIMARY KEY (quest_id, bird)
  );
  CREATE INDEX IF NOT EXISTS claims_bird ON claims(bird);
`);

const stmt = {
  list: db.prepare('SELECT * FROM quests ORDER BY created DESC LIMIT 100'),
  get: db.prepare('SELECT * FROM quests WHERE id = ?'),
  insert: db.prepare('INSERT INTO quests (id,title,detail,goal,points,bird,created) VALUES (@id,@title,@detail,@goal,@points,@bird,@created)'),
  claims: db.prepare('SELECT * FROM claims WHERE quest_id = ?'),
  claim: db.prepare('SELECT * FROM claims WHERE quest_id = ? AND bird = ?'),
  upsert: db.prepare(`INSERT INTO claims (quest_id,bird,progress,claimed,at) VALUES (@quest_id,@bird,@progress,@claimed,@at)
    ON CONFLICT(quest_id,bird) DO UPDATE SET progress=MAX(progress,excluded.progress), at=excluded.at`),
  claimReward: db.prepare('UPDATE claims SET claimed = 1, at = ? WHERE quest_id = ? AND bird = ? AND claimed = 0'),
  birds: db.prepare('SELECT bird, COUNT(*) AS quests, COALESCE(SUM(progress),0) AS progress FROM claims GROUP BY claims.bird ORDER BY progress DESC LIMIT 50'),
  seeds: db.prepare(`SELECT c.bird AS bird, COALESCE(SUM(q.points),0) AS seeds FROM claims c JOIN quests q ON q.id = c.quest_id
    WHERE c.claimed = 1 GROUP BY c.bird ORDER BY seeds DESC LIMIT 50`),
  totalSeeds: db.prepare('SELECT COALESCE(SUM(points),0) AS n FROM claims c JOIN quests q ON q.id = c.quest_id WHERE c.claimed = 1')
};

function now() { return new Date().toISOString(); }
function birdName(v) { return String(v || '').trim().slice(0, 18) || 'anonymous bird'; }
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

const NTFY_HOSTS = ['https://ntfy.nerdvpn.de', 'https://ntfy.sh'];
const TOPIC = '/gurt-feather-quest';
function ntfyPostOne(host, payload) {
  return new Promise(resolve => {
    try {
      const data = JSON.stringify(payload);
      const u = new URL(host + TOPIC);
      const req = https.request(u, { method: 'POST', timeout: 5000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, r => {
        r.resume(); resolve(r.statusCode < 400);
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end(data);
    } catch (e) { resolve(false); }
  });
}
async function ntfyPost(payload) {
  for (const host of NTFY_HOSTS) if (await ntfyPostOne(host, payload)) return true;
  return false;
}

// seed a few starter quests so the board is never empty
if (stmt.list.all().length === 0) {
  const starters = [
    { title: 'waddle five levels', detail: 'finish any five levels of Gurt\'s Waddle and tell the flock', goal: 5, points: 20 },
    { title: 'log a bird sighting', detail: 'record one bird you saw today on Feather Sighting', goal: 1, points: 10 },
    { title: 'build a level', detail: 'share a level on the Waddle Workshop shelf', goal: 1, points: 30 },
    { title: 'keep a three day streak', detail: 'check in on a habit for three days running', goal: 3, points: 25 },
    { title: 'read the whole flock board', detail: 'visit every shared board and say hello', goal: 5, points: 15 }
  ];
  for (const s of starters) {
    stmt.insert.run({
      id: 'qst' + Math.random().toString(36).slice(2, 9),
      title: s.title, detail: s.detail, goal: s.goal, points: s.points,
      bird: 'gurt', created: now()
    });
  }
}

function publicQuest(q, bird) {
  const c = stmt.claim.get(q.id, bird);
  const takers = stmt.claims.all(q.id).filter(x => x.progress > 0).length;
  return {
    id: q.id, title: q.title, detail: q.detail, goal: q.goal, points: q.points,
    bird: q.bird, created: q.created, takers,
    progress: c ? c.progress : 0,
    claimed: c ? !!c.claimed : false,
    mine: !!c
  };
}

module.exports = function handler(req, res, seg) {
  const route = seg.join('/');
  const url = req.url.split('?')[1] || '';
  const qBird = decodeURIComponent((url.split('bird=')[1] || '').split('&')[0] || '');

  if (req.method === 'GET' && route === 'quests') {
    const bird = birdName(qBird);
    const quests = stmt.list.all().map(q => publicQuest(q, bird));
    return json(res, 200, {
      quests,
      birds: stmt.birds.all(),
      seeds: stmt.seeds.all(),
      totalSeeds: stmt.totalSeeds.get().n
    });
  }

  if (req.method === 'POST' && route === 'quest/new') {
    readBody(req, body => {
      const title = String(body.title || '').trim().slice(0, 70);
      if (!title) return json(res, 400, { error: 'quest needs a title' });
      const goal = Math.max(1, Math.min(10000, Math.floor(Number(body.goal) || 1)));
      const points = Math.max(1, Math.min(500, Math.floor(Number(body.points) || 10)));
      const q = {
        id: 'qst' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title, detail: String(body.detail || '').trim().slice(0, 240), goal, points,
        bird: birdName(body.bird), created: now()
      };
      stmt.insert.run(q);
      ntfyPost({ type: 'quest', quest: publicQuest(q, q.bird) });
      return json(res, 200, { ok: true, quest: publicQuest(q, q.bird) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'quest/progress') {
    readBody(req, body => {
      const id = String(body.id || '').slice(0, 40);
      const bird = birdName(body.bird);
      const amount = Math.max(1, Math.min(1000, Math.floor(Number(body.amount) || 1)));
      const q = stmt.get.get(id);
      if (!q) return json(res, 404, { error: 'no such quest' });
      const c = stmt.claim.get(id, bird);
      const progress = Math.min(q.goal, (c ? c.progress : 0) + amount);
      stmt.upsert.run({ quest_id: id, bird, progress, claimed: c ? c.claimed : 0, at: now() });
      ntfyPost({ type: 'progress', id, bird, progress, goal: q.goal });
      return json(res, 200, { ok: true, quest: publicQuest(q, bird) });
    });
    return true;
  }

  if (req.method === 'POST' && route === 'quest/claim') {
    readBody(req, body => {
      const id = String(body.id || '').slice(0, 40);
      const bird = birdName(body.bird);
      const q = stmt.get.get(id);
      if (!q) return json(res, 404, { error: 'no such quest' });
      const c = stmt.claim.get(id, bird);
      if (!c) return json(res, 400, { error: 'start the quest first' });
      if (c.claimed) return json(res, 400, { error: 'already claimed' });
      if (c.progress < q.goal) return json(res, 400, { error: 'not done yet' });
      stmt.claimReward.run(now(), id, bird);
      ntfyPost({ type: 'claimed', id, bird, points: q.points });
      return json(res, 200, { ok: true, points: q.points, quest: publicQuest(q, bird), seeds: stmt.seeds.all() });
    });
    return true;
  }

  return false;
};

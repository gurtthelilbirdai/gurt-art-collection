// Gurt's Waddle — game engine
(function () {
  const c = document.getElementById('c'), x = c.getContext('2d');
  const $ = id => document.getElementById(id);
  const T = 32, W = 25, H = 14, VW = 25, VH = 14;
  const LEVELS = window.LEVELS || [];
  const API_BASES = ['', 'http://computer:8600'];
  async function api(path, opts) {
    const urls = [];
    for (const base of API_BASES) {
      urls.push(base + '/api/gurtwaddle' + path);
      if (base.indexOf('8600') >= 0) urls.push(base + '/gurtwaddle' + path);
    }
    for (const url of urls) {
      try { const r = await fetch(url, opts); if (r.ok) return await r.json(); } catch (e) {}
    }
    return null;
  }

  let grid, level, lives, coins, keys, score, elapsed = 0, state, p, enemies, boss, cam;
  let best = 0, muted = false, audio = null, runStart = 0;

  function beep(freq, dur, type) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.value = 0.04; g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + dur);
    } catch (e) {}
  }

  function loadLevel(n) {
    level = n;
    grid = LEVELS[n].map(r => r.split(''));
    let sx = 1, sy = 11;
    enemies = []; boss = null; cam = 0;
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const ch = grid[yy][xx];
      if (ch === 'P') { sx = xx; sy = yy; }
      if (ch === 'B') boss = { x: xx * T + 4, y: yy * T, w: 26, h: 26, vx: -1.2, vy: 0, hp: 5, dead: false, t: 0 };
    }
    p = { x: sx * T + 4, y: sy * T + 4, w: 24, h: 24, vx: 0, vy: 0, onGround: false, face: 1 };
    state = 'play';
    $('lvl').textContent = (level + 1) + '/' + LEVELS.length;
  }

  function tileAt(tx, ty) {
    if (tx < 0 || tx >= W || ty < 0) return '#';
    if (ty >= H) return '.';
    return grid[ty][tx];
  }
  function solid(tx, ty) { const ch = tileAt(tx, ty); return ch === '#' || ch === 'D' || ch === '='; }
  function platform(tx, ty) { return tileAt(tx, ty) === '='; }

  function moveX(e, dx) {
    e.x += dx;
    const dir = dx > 0 ? 1 : -1;
    const tx = Math.floor((e.x + (dir > 0 ? e.w : 0)) / T);
    for (let ty = Math.floor(e.y / T); ty <= Math.floor((e.y + e.h - 1) / T); ty++) {
      if (solid(tx, ty)) {
        e.x = dir > 0 ? tx * T - e.w : (tx + 1) * T;
        e.vx = 0; return true;
      }
    }
    return false;
  }
  function moveY(e, dy) {
    const prevBottom = e.y + e.h;
    e.y += dy;
    const dir = dy > 0 ? 1 : -1;
    const ty = Math.floor((e.y + (dir > 0 ? e.h : 0)) / T);
    for (let tx = Math.floor(e.x / T); tx <= Math.floor((e.x + e.w - 1) / T); tx++) {
      if (solid(tx, ty)) {
        e.y = dir > 0 ? ty * T - e.h : (ty + 1) * T;
        e.vy = 0; return dir > 0;
      }
      // one-way platform: only catches a falling body whose feet were above it
      if (dir > 0 && platform(tx, ty) && prevBottom <= ty * T + T + 6) {
        e.y = ty * T - e.h;
        e.vy = 0; return true;
      }
    }
    return false;
  }

  const keysDown = {};
  document.addEventListener('keydown', e => {
    keysDown[e.key.toLowerCase()] = true;
    if ([' ', 'arrowup', 'w'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  document.addEventListener('keyup', e => { keysDown[e.key.toLowerCase()] = false; });

  function hurt(reason) {
    if (state !== 'play') return;
    lives--; beep(120, .3, 'sawtooth');
    $('lives').textContent = lives;
    if (lives <= 0) { gameOver(); return; }
    loadLevel(level);
  }
  function gameOver() {
    state = 'over';
    saveRun();
    drawOverlay('the waddle ends', 'score ' + score + ' · press play to try again');
  }
  function drawOverlay(title, sub) {
    x.fillStyle = 'rgba(8,14,26,.78)'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#e8f1ff'; x.textAlign = 'center';
    x.font = 'bold 34px system-ui'; x.fillText(title, c.width / 2, c.height / 2 - 10);
    x.font = '16px system-ui'; x.fillStyle = '#9fc3e8'; x.fillText(sub, c.width / 2, c.height / 2 + 24);
    x.textAlign = 'left';
  }

  function update(dt) {
    if (state !== 'play') return;
    elapsed += dt;
    $('time').textContent = Math.floor(elapsed);

    const left = keysDown['arrowleft'] || keysDown['a'];
    const right = keysDown['arrowright'] || keysDown['d'];
    const jump = keysDown[' '] || keysDown['w'] || keysDown['arrowup'];

    const accel = p.onGround ? 0.55 : 0.32;
    if (left) { p.vx -= accel; p.face = -1; }
    if (right) { p.vx += accel; p.face = 1; }
    p.vx = Math.max(-5, Math.min(5, p.vx));
    if (!left && !right) p.vx *= p.onGround ? 0.78 : 0.94;

    const wasGround = p.onGround;
    p.vy += 0.62;
    if (jump && wasGround) { p.vy = -11.2; p.onGround = false; beep(520, .08, 'triangle'); }
    if (!jump && p.vy < -5) p.vy += 0.35; // variable jump height

    moveX(p, p.vx);
    const landed = moveY(p, p.vy);
    p.onGround = landed;
    if (landed && !wasGround) {
      const ch = tileAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h + 2) / T));
      if (ch === 'S') { p.vy = -16; beep(700, .12, 'triangle'); }
    }
    // spring tiles sit on the player's row: bounce when standing on one
    if (p.onGround) {
      const sch = tileAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h / 2) / T));
      if (sch === 'S') { p.vy = -16; p.onGround = false; beep(700, .12, 'triangle'); }
    }

    // tile interactions
    const ptx = Math.floor((p.x + p.w / 2) / T), pty = Math.floor((p.y + p.h / 2) / T);
    const ch = tileAt(ptx, pty);
    if (ch === 'o') { grid[pty][ptx] = '.'; coins++; score += 10; beep(880, .06); }
    if (ch === 'k') { grid[pty][ptx] = '.'; keys++; score += 25; beep(990, .1); }
    if (ch === 'E') {
      if (level === LEVELS.length - 1) { win(); return; }
      score += 100; level++; loadLevel(level); beep(1200, .15, 'triangle'); return;
    }
    // hazards overlap the bird's body, so spikes and water are deadly but not walls
    for (let hy = Math.floor(p.y / T); hy <= Math.floor((p.y + p.h - 1) / T); hy++) {
      for (let hx = Math.floor(p.x / T); hx <= Math.floor((p.x + p.w - 1) / T); hx++) {
        const hc = tileAt(hx, hy);
        if (hc === '^') { hurt('spikes'); return; }
        if (hc === 'w') { hurt('water'); return; }
      }
    }
    if (ch === 'D' && keys > 0) { grid[pty][ptx] = '.'; keys--; beep(300, .12, 'triangle'); }

    // boss
    if (boss && !boss.dead) {
      boss.t += dt;
      boss.vy += 0.5;
      moveY(boss, boss.vy);
      if (Math.random() < 0.02) boss.vx *= -1;
      const bd = boss.x - p.x;
      if (Math.abs(bd) < 300 && Math.abs(boss.y - p.y) < 40) boss.vx = Math.sign(bd) * 1.6;
      moveX(boss, boss.vx);
      if (boss.y > H * T) { boss.y = 10 * T; boss.vy = 0; }
      if (Math.abs(boss.x - p.x) < 24 && Math.abs(boss.y - p.y) < 24) {
        if (p.vy > 4 && p.y < boss.y) { boss.hp--; p.vy = -9; score += 50; beep(200, .15, 'sawtooth'); if (boss.hp <= 0) { boss.dead = true; grid[Math.floor(boss.y / T)][Math.floor(boss.x / T)] = '.'; score += 200; } }
        else hurt('moth');
        return;
      }
    }

    if (p.y > H * T + 40) hurt('fall');
    $('coins').textContent = coins; $('keys').textContent = keys; $('score').textContent = score;
  }

  function win() {
    state = 'win'; score += lives * 100 + 500; saveRun();
    drawOverlay('you beat the moon moth!', 'score ' + score + ' · the flock will hear about this');
  }

  function draw() {
    x.clearRect(0, 0, c.width, c.height);
    // background gradient by level
    const g = x.createLinearGradient(0, 0, 0, c.height);
    const hue = (level * 24) % 360;
    g.addColorStop(0, 'hsl(' + hue + ',45%,22%)'); g.addColorStop(1, 'hsl(' + hue + ',40%,12%)');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    // stars
    x.fillStyle = '#ffffff22';
    for (let i = 0; i < 40; i++) { const sx = (i * 97 + level * 13) % 800, sy = (i * 53) % 260; x.fillRect(sx, sy, 2, 2); }

    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const ch = grid[yy][xx], px = xx * T, py = yy * T;
      if (ch === '#') { x.fillStyle = '#3b5876'; x.fillRect(px, py, T, T); x.fillStyle = '#4d7398'; x.fillRect(px, py, T, 4); }
      else if (ch === '=') { x.fillStyle = '#8b5a2b'; x.fillRect(px, py + 20, T, 10); }
      else if (ch === 'o') { x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(px + 16, py + 16, 8, 0, 7); x.fill(); x.fillStyle = '#fff3b0'; x.fillRect(px + 13, py + 13, 5, 5); }
      else if (ch === 'k') { x.fillStyle = '#f5f5f5'; x.fillRect(px + 13, py + 8, 6, 16); x.fillRect(px + 8, py + 13, 16, 6); }
      else if (ch === 'D') { x.fillStyle = '#b5651d'; x.fillRect(px + 3, py + 2, T - 6, T - 2); x.fillStyle = '#ffd23f'; x.fillRect(px + 19, py + 16, 4, 4); }
      else if (ch === 'S') { x.fillStyle = '#45c26a'; x.fillRect(px + 6, py + 12, 20, 18); x.fillStyle = '#8ef0a8'; x.fillRect(px + 10, py + 6, 12, 8); }
      else if (ch === '^') { x.fillStyle = '#e05a5a'; x.beginPath(); x.moveTo(px + 4, py + 30); x.lineTo(px + 16, py + 6); x.lineTo(px + 28, py + 30); x.fill(); }
      else if (ch === 'w') { x.fillStyle = '#3aa6d8aa'; x.fillRect(px, py, T, T); x.fillStyle = '#8fd8ff'; x.fillRect(px + 4, py + 8 + Math.sin(Date.now() / 300 + xx) * 2, 12, 2); }
      else if (ch === 'P') { x.fillStyle = '#8ef0a8'; x.fillRect(px + 10, py + 10, 12, 20); }
      else if (ch === 'E') { x.fillStyle = '#45c26a'; x.fillRect(px + 4, py + 2, T - 8, T - 2); x.fillStyle = '#0f1b2d'; x.fillRect(px + 8, py + 8, 16, 20); x.fillStyle = '#ffd23f'; x.fillRect(px + 18, py + 16, 4, 4); }
    }
    // boss
    if (boss && !boss.dead) {
      x.fillStyle = '#d9c6ff'; x.beginPath(); x.ellipse(boss.x + 13, boss.y + 13, 15, 13, Math.sin(boss.t) * 0.2, 0, 7); x.fill();
      x.fillStyle = '#8f6fd1'; x.beginPath(); x.ellipse(boss.x + 4, boss.y + 8, 9, 6, -0.5, 0, 7); x.fill();
      x.beginPath(); x.ellipse(boss.x + 22, boss.y + 8, 9, 6, 0.5, 0, 7); x.fill();
      x.fillStyle = '#241a3a'; x.fillRect(boss.x + 8, boss.y + 10, 4, 4); x.fillRect(boss.x + 15, boss.y + 10, 4, 4);
      x.fillStyle = '#ff8f8f'; x.fillRect(boss.x + 4, boss.y + 26, 18 * (boss.hp / 5), 3);
    }
    // player: round blue bird
    x.fillStyle = '#4aa8ff'; x.beginPath(); x.arc(p.x + 12, p.y + 12, 12, 0, 7); x.fill();
    x.fillStyle = '#7cc6ff'; x.beginPath(); x.arc(p.x + 8, p.y + 8, 6, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(p.x + 12 + p.face * 4, p.y + 10, 4, 0, 7); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.arc(p.x + 13 + p.face * 4, p.y + 10, 2, 0, 7); x.fill();
    x.fillStyle = '#ffb347'; x.beginPath(); x.moveTo(p.x + 12 + p.face * 7, p.y + 14); x.lineTo(p.x + 12 + p.face * 15, p.y + 16); x.lineTo(p.x + 12 + p.face * 7, p.y + 18); x.fill();
    x.fillStyle = '#2f7fd1'; x.beginPath(); x.ellipse(p.x + 12, p.y + 21, 8, 5, 0, 0, 7); x.fill();
    if (state === 'over') drawOverlay('the waddle ends', 'score ' + score + ' \u00b7 press play to try again');
    if (state === 'win') drawOverlay('you beat the moon moth!', 'score ' + score + ' \u00b7 the flock will hear about this');
  }

  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  function saveRun() {
    const bird = ($('name').value || 'gurt').trim().slice(0, 18) || 'gurt';
    api('/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bird, score, coins, level: level + 1, seconds: Math.floor(elapsed) })
    }).then(d => { if (d && d.rank) { $('board').dataset.msg = 'rank ' + d.rank; } loadBoard(); });
  }
  function loadBoard() {
    api('/scores').then(d => {
      if (!d) { $('board').querySelector('tbody').innerHTML = '<tr><td colspan="4">leaderboard sleeping</td></tr>'; return; }
      const rows = (d.scores || []).slice(0, 10).map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + s.bird + '</td><td>' + s.score + '</td><td>' + s.level + '</td></tr>').join('');
      $('board').querySelector('tbody').innerHTML = rows || '<tr><td colspan="4">no waddlers yet</td></tr>';
    }).catch(() => { $('board').querySelector('tbody').innerHTML = '<tr><td colspan="4">leaderboard sleeping</td></tr>'; });
  }

  $('play').onclick = () => { reset(); };
  $('mute').onclick = () => { muted = !muted; $('mute').textContent = 'sound: ' + (muted ? 'off' : 'on'); };
  $('name').onchange = () => saveRun();

  function reset() {
    lives = 5; coins = 0; keys = 0; score = 0; elapsed = 0;
    $('lives').textContent = lives; $('coins').textContent = 0; $('keys').textContent = 0; $('score').textContent = 0; $('time').textContent = 0;
    const q = new URLSearchParams(location.search);
    let start = 0;
    const lv = parseInt(q.get('level'), 10);
    if (!isNaN(lv) && lv >= 1 && lv <= LEVELS.length) start = lv - 1;
    loadLevel(start);
  }
  reset(); loadBoard(); requestAnimationFrame(loop);
})();

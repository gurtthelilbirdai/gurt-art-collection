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

  let grid, level, lives, coins, keys, score, elapsed = 0, state, p, enemies, bosses, cam;
  let platforms, checkpoint, spawn, maxLevel = 1, crumbling = [];
  let best = 0, muted = false, audio = null, runStart = 0;
  let safeFor = 0;

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
    enemies = []; bosses = []; cam = 0; platforms = []; crumbling = [];
    checkpoint = null; spawn = { x: 1, y: 11 };
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const ch = grid[yy][xx];
      if (ch === 'P') { sx = xx; sy = yy; spawn = { x: xx, y: yy }; }
      if (ch === 'B') bosses.push({ x: xx * T + 4, y: yy * T, baseY: yy * T, hoverY: yy * T - 10, w: 26, h: 26, vx: level >= 41 ? -0.8 : -1.2, vx0: level >= 41 ? -0.8 : -1.2, vy: 0, hp: level >= 41 ? 1 : 2, maxHp: level >= 41 ? 1 : 2, dead: false, stun: 0, t: 0, x0: Math.max(1 * T, xx * T - 2 * T), x1: Math.min(23 * T, xx * T + 2 * T) });
      if (ch === 'C') checkpoint = { x: xx, y: yy };
      if (ch === 'c') crumbling.push({ x: xx, y: yy, timer: -1, back: 0 });
      if (ch === 'e') enemies.push({ kind: 'walker', x: xx * T + 4, y: yy * T + 4, w: 24, h: 24, vx: 1.1, vy: 0, dead: false, t: 0 });
      if (ch === 'f') enemies.push({ kind: 'flyer', x: xx * T + 4, y: yy * T + 4, w: 22, h: 22, vx: 1.3, vy: 0, dead: false, t: 0, base: yy * T, x0: xx * T, x1: Math.min(W * T - T, xx * T + T * 3) });
      if (ch === 'm') enemies.push({ kind: 'hammer', x: xx * T + 4, y: yy * T + 4, w: 26, h: 26, vx: 1.6, vy: 0, dead: false, t: 0, base: yy * T });
      if (ch === 'M') platforms.push({ kind: 'h', x: xx * T, y: yy * T, w: T * 2, h: 12, x0: xx * T, x1: xx * T + T * 2, dx: 0, dy: 0 });
      if (ch === 'F') platforms.push({ kind: 'h', x: xx * T, y: yy * T, w: T * 2, h: 12, x0: xx * T, x1: Math.min(22 * T, xx * T + 10 * T), dx: 1.1, dy: 0, wait: 30 });
      if (ch === 'G') platforms.push({ kind: 'h', x: xx * T, y: yy * T, w: T * 2, h: 12, x0: xx * T, x1: Math.max(4 * T, xx * T - 10 * T), dx: -1.1, dy: 0, wait: 30 });
      if (ch === 'V') platforms.push({ kind: 'v', x: xx * T, y: (yy + 1) * T, w: T * 2, h: 12, y0: (yy + 1) * T, y1: (yy - 5) * T, dx: 0, dy: -0.9, wait: 120 });
    }
    p = { x: sx * T + 4, y: sy * T + 4, w: 24, h: 24, vx: 0, vy: 0, onGround: false, face: 1, ride: null };
    state = 'play';
    $('lvl').textContent = (level + 1) + '/' + LEVELS.length;
  }

  function tileAt(tx, ty) {
    if (tx < 0 || tx >= W || ty < 0) return '#';
    if (ty >= H) return '.';
    return grid[ty][tx];
  }
  function solid(tx, ty) { const ch = tileAt(tx, ty); if (ch === 'D') return keys <= 0; return ch === '#' || ch === 'i' || ch === 'c'; }
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
      // one-way platform: the walkable surface is the BOTTOM of the tile,
      // so catch a falling body as it crosses that bottom edge
      for (const row of [ty, ty - 1]) {
        if (row < 0) continue;
        const surf = (row + 1) * T;
        if (dir > 0 && platform(tx, row) && prevBottom <= surf + 24 && e.y + e.h >= surf) {
          e.y = surf - e.h;
          e.vy = 0; return true;
        }
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
    lives--; safeFor = 1.5; beep(120, .3, 'sawtooth');
    $('lives').textContent = lives;
    if (lives <= 0) { gameOver(); return; }
    const keepScore = score, keepCoins = coins;
    loadLevel(level);
    score = keepScore; coins = keepCoins;
    if (checkpoint) { p.x = checkpoint.x * T + 4; p.y = checkpoint.y * T; }
    $('score').textContent = score; $('coins').textContent = coins;
  }
  let overlay = null;
  function gameOver() {
    state = 'over';
    saveRun();
    overlay = { title: 'the waddle ends', sub: 'score ' + score + ' · press play to try again' };
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
    if (safeFor > 0) safeFor -= dt;
    $('time').textContent = Math.floor(elapsed);

    const left = keysDown['arrowleft'] || keysDown['a'];
    const right = keysDown['arrowright'] || keysDown['d'];
    const jump = keysDown[' '] || keysDown['w'] || keysDown['arrowup'];

    let onIce = false;
    if (p.onGround) {
      const ix = Math.floor((p.x + p.w / 2) / T);
      const iy = Math.floor((p.y + p.h + 2) / T);
      onIce = tileAt(ix, iy) === 'i' || tileAt(Math.floor((p.x + 4) / T), iy) === 'i';
    }
    const accel = p.onGround ? 0.55 : 0.32; // ice keeps momentum, handled by friction
    if (left) { p.vx -= accel; p.face = -1; }
    if (right) { p.vx += accel; p.face = 1; }
    p.vx = Math.max(-5, Math.min(5, p.vx));
    if (!left && !right) p.vx *= p.onGround ? (onIce ? 0.985 : 0.78) : 0.94;

    const wasGround = p.onGround;
    // a bird riding a moving platform stays glued to it
    if (p.ride) {
      const r = p.ride;
      const stillOn = p.x + p.w > r.x && p.x < r.x + r.w && Math.abs((p.y + p.h) - r.y) < 18;
      if (stillOn) { p.y = r.y - p.h; p.vy = 0; p.onGround = true; }
      else p.ride = null;
    }
    p.vy += 0.62;
    if (jump && wasGround) { p.vy = -12.8; p.onGround = false; beep(520, .08, 'triangle'); }
    if (!jump && p.vy < -5) p.vy += 0.35; // variable jump height

    moveX(p, p.vx);
    const prevFeet = p.y + p.h;
    const landed = moveY(p, p.vy);
    p.onGround = landed;
    // moving platforms catch a falling bird from above
    if (!p.onGround && p.vy > 0) {
      for (const pl of platforms) {
        if (prevFeet <= pl.y + 6 && p.y + p.h >= pl.y &&
            p.x + p.w > pl.x + 2 && p.x < pl.x + pl.w - 2) {
          p.y = pl.y - p.h; p.vy = 0; p.onGround = true; p.ride = pl; break;
        }
      }
    }
    if (landed && !wasGround) {
      const ch = tileAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h + 2) / T));
      if (ch === 'S') { p.vy = -16; beep(700, .12, 'triangle'); }
    }
    // spring tiles bounce the bird when it stands on them
    if (p.onGround) {
      const sxs = [Math.floor((p.x + p.w / 2) / T), Math.floor((p.x + 4) / T), Math.floor((p.x + p.w - 4) / T)];
      for (const sx of sxs) {
        const sch = tileAt(sx, Math.floor((p.y + p.h / 2) / T));
        if (sch === 'S') { p.vy = -17; p.onGround = false; beep(700, .12, 'triangle'); break; }
      }
    }

    // crumbling roots: they hold for a moment, then fall away and grow back
    for (const cr of crumbling) {
      if (cr.timer >= 0) {
        cr.timer += dt;
        if (cr.timer > 0.55) { grid[cr.y][cr.x] = '.'; cr.timer = -1; cr.back = 2.5; }
      } else if (cr.back > 0) {
        cr.back -= dt;
        if (cr.back <= 0) grid[cr.y][cr.x] = 'c';
      }
    }
    if (p.onGround) {
      const ftx = Math.floor((p.x + p.w / 2) / T);
      const fty = Math.floor((p.y + p.h + 3) / T);
      for (const cr of crumbling) {
        if (cr.x === ftx && cr.y === fty && cr.timer < 0 && cr.back <= 0) {
          cr.timer = 0; beep(180, .08, 'square');
        }
      }
    }

    // tile interactions: scan every tile the bird's body touches, so a key
    // two rows above the floor can still be grabbed while jumping past it
    const ptx = Math.floor((p.x + p.w / 2) / T), pty = Math.floor((p.y + p.h / 2) / T);
    const ch = tileAt(ptx, pty);
    for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + p.h - 1) / T); ty++) {
      for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 1) / T); tx++) {
        const tc = tileAt(tx, ty);
        if (tc === 'o') { grid[ty][tx] = '.'; coins++; score += 10; beep(880, .06); }
        else if (tc === 'k') { grid[ty][tx] = '.'; keys++; score += 25; beep(990, .1); }
        else if (tc === 'H') { grid[ty][tx] = '.'; lives = Math.min(9, lives + 1); score += 50; $('lives').textContent = lives; beep(1320, .18, 'triangle'); }
        else if (tc === 'D' && keys > 0) { grid[ty][tx] = '.'; keys--; beep(300, .12, 'triangle'); }
      }
    }
    if (ch === 'E') {
      if (bosses.some(b => !b.dead)) { $('msg').textContent = 'the moths guard the exit — stomp them first'; beep(160, .12, 'sawtooth'); return; }
      if (level === LEVELS.length - 1) { win(); return; }
      score += 100; level++; loadLevel(level); beep(1200, .15, 'triangle'); return;
    }
    // spikes only catch the bird's feet, so it can hop over them
    // spikes only catch the bird's feet, so it can hop over them
    // spikes sit at the bottom of their tile: only a falling bird or one
    // walking into them gets hurt, so a clean hop clears them
    const feet = p.y + p.h;
    // the tile the feet are actually inside; the floor row is below the spikes
    const fy = Math.floor(feet / T);
    // spikes sit at the bottom of their tile, so only a bird landing low
    // on them is hurt: a clean hop passes over the points
    if (p.vy > 0 && feet > fy * T + 16) {
      const cx = p.x + p.w / 2;
      for (let hx = Math.floor(cx / T); hx <= Math.floor((cx + 0.5) / T); hx++) {
        if (tileAt(hx, fy) === '^') { hurt('spikes'); return; }
      }
    }
    // water swallows the whole bird
    for (let hy = Math.floor(p.y / T); hy <= Math.floor((p.y + p.h - 1) / T); hy++) {
      for (let hx = Math.floor(p.x / T); hx <= Math.floor((p.x + p.w - 1) / T); hx++) {
        if (tileAt(hx, hy) === 'w') { hurt('water'); return; }
      }
    }

    // moving platforms (simulation)
    for (const pl of platforms) {
      if (pl.kind === 'h') {
        if (pl.wait > 0) { pl.wait--; pl.moveX = 0; }
        else {
          pl.moveX = pl.dx; pl.x += pl.dx;
          if (pl.x <= pl.x0) { pl.x = pl.x0; pl.dx = 1.1; }
          else if (pl.x >= pl.x1) { pl.x = pl.x1; pl.dx = -1.1; }
        }
      } else {
        if (pl.wait > 0) { pl.wait--; }
        else {
          pl.y += pl.dy;
          if (pl.y >= pl.y0) { pl.y = pl.y0; pl.dy = -0.9; pl.wait = 120; }
          if (pl.y <= pl.y1) { pl.y = pl.y1; pl.dy = 0.9; pl.wait = 120; }
        }
      }
      // ride the platform if the bird stands on it
      const feet = p.y + p.h;
      if (p.onGround && feet >= pl.y - 4 && feet <= pl.y + 10 &&
          p.x + p.w > pl.x && p.x < pl.x + pl.w) {
        p.x += (pl.moveX || 0); p.y += (pl.dy || 0); p.ride = pl;
      }
    }

    // enemies (simulation)
    for (const e of enemies) {
      if (e.dead) continue;
      e.t += dt;
      if (e.kind === 'walker' || e.kind === 'hammer') {
        e.vy += 0.5;
        const blocked = moveX(e, e.vx);
        if (blocked) e.vx *= -1;
        moveY(e, e.vy);
        if (e.kind === 'hammer' && e.onGround !== true && e.vy > 0) { e.vy = 0; e.vx *= -1; }
        if (e.kind === 'hammer' && e.t > 1.2 && Math.abs(e.y - e.base) < 4) { e.vy = -7; e.t = 0; }
      } else if (e.kind === 'flyer') {
        e.x += e.vx;
        if (e.x <= e.x0) { e.x = e.x0; e.vx = 1.3; }
        if (e.x >= e.x1) { e.x = e.x1; e.vx = -1.3; }
        e.y = e.base + Math.sin(e.t * 2.2) * 40;
      }
      if (Math.abs(e.x - p.x) < 24 && Math.abs(e.y - p.y) < 24) {
        // stomp from above defeats the enemy
        if (p.vy > 3 && p.y + p.h < e.y + 12) {
          e.dead = true; p.vy = -9; score += 75; beep(260, .12, 'sawtooth');
        } else { hurt(e.kind); return; }
      }
    }

    // bosses
    for (const boss of bosses) {
      if (boss.dead) continue;
      boss.t += dt;
      // moths hover: they bob over the garden instead of sinking to the floor
      boss.y = boss.hoverY + Math.sin(boss.t * 1.6) * 6;
      // moths patrol their own patch of garden and never hunt the bird
      if (Math.random() < 0.012) boss.vx *= -1;
      boss.vx = Math.max(-1.6, Math.min(1.6, boss.vx));
      boss.x += boss.vx;
      if (boss.x < boss.x0) { boss.x = boss.x0; boss.vx = Math.abs(boss.vx); }
      if (boss.x > boss.x1) { boss.x = boss.x1; boss.vx = -Math.abs(boss.vx); }
      if (boss.stun > 0) { boss.stun -= dt; if (boss.stun <= 0) boss.vx = boss.vx0; }
      const feet = p.y + p.h;
      // real body overlap: the bird must actually touch the moth
      const nearX = Math.abs(boss.x - p.x) < 58;
      const stomping = nearX && p.vy > 0 && feet >= boss.y - 34 && feet <= boss.y + boss.h + 16;
      const touching = nearX && feet > boss.y - 8 && p.y < boss.y + boss.h;
      if (safeFor <= 0 && touching) {
        if (stomping) {
          boss.hp--; boss.stun = 1.2; boss.vx = 0; safeFor = 0.8; p.vy = -12; score += 50; beep(200, .15, 'sawtooth');
          if (boss.hp <= 0) { boss.dead = true; score += 200; beep(1400, .2, 'triangle'); }
        } else if (boss.stun <= 0 && p.vy > 3) {
          // only a real fall into the moth hurts; brushing past is safe
          hurt('moth');
        }
        return;
      }
    }

    if (p.y > H * T + 40) hurt('fall');
    const aliveB = bosses.filter(b => !b.dead).length;
    if ($('moths')) $('moths').textContent = aliveB;
    $('coins').textContent = coins; $('keys').textContent = keys; $('score').textContent = score;
    const posEl = $('pos'); if (posEl) posEl.textContent = 'x' + Math.floor(p.x / T) + ' y' + Math.floor(p.y / T);
  }

  function win() {
    state = 'win'; score += lives * 100 + 500; saveRun();
    $('score').textContent = score;
    overlay = { title: level >= 59 ? 'you beat the lantern moth!' : 'you beat the moon moth!', sub: 'score ' + score + ' · the flock will hear about this' };
  }

  function draw() {
    x.clearRect(0, 0, c.width, c.height);
    // background gradient by level
    const icy = level >= 20 && level < 40;
    const woods = level >= 40;
    const g = x.createLinearGradient(0, 0, 0, c.height);
    if (icy) {
      g.addColorStop(0, '#2b4f74'); g.addColorStop(0.55, '#3d6f99'); g.addColorStop(1, '#dcefff');
    } else {
      const hue = (level * 24) % 360;
      g.addColorStop(0, 'hsl(' + hue + ',45%,22%)'); g.addColorStop(1, 'hsl(' + hue + ',40%,12%)');
    }
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    if (woods) {
      g.addColorStop(0, '#241a12'); g.addColorStop(0.55, '#3d2a18'); g.addColorStop(1, '#6b4a26');
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      // fireflies drifting between the roots
      for (let i = 0; i < 40; i++) {
        const fx = (i * 149 + Math.sin(Date.now() / 900 + i) * 30) % 800;
        const fy = (i * 71 + Math.cos(Date.now() / 1100 + i * 1.7) * 24) % 420;
        x.fillStyle = i % 3 ? '#ffd76a88' : '#ffe9a8cc';
        x.beginPath(); x.arc(fx, fy, 1.6 + (i % 3), 0, 7); x.fill();
      }
      // lantern glow along the floor
      for (let i = 0; i < 6; i++) {
        const lx = 40 + i * 140;
        const rg = x.createRadialGradient(lx, 400, 4, lx, 400, 70);
        rg.addColorStop(0, '#ffb34733'); rg.addColorStop(1, '#ffb34700');
        x.fillStyle = rg; x.fillRect(lx - 70, 330, 140, 140);
      }
    } else if (icy) {
      // falling snow
      x.fillStyle = '#ffffffcc';
      for (let i = 0; i < 70; i++) {
        const sx = (i * 137 + level * 13) % 800;
        const sy = ((i * 61 + Math.floor(Date.now() / 40) * (1 + i % 3)) % 450);
        x.beginPath(); x.arc(sx, sy, 1 + (i % 3) * 0.7, 0, 7); x.fill();
      }
      // distant icy peaks
      x.fillStyle = '#ffffff33';
      for (let i = 0; i < 5; i++) {
        const bx = i * 190 - 40, by = 300 + (i % 2) * 30;
        x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + 90, by - 110); x.lineTo(bx + 180, by); x.fill();
      }
    } else {
      x.fillStyle = '#ffffff22';
      for (let i = 0; i < 40; i++) { const sx = (i * 97 + level * 13) % 800, sy = (i * 53) % 260; x.fillRect(sx, sy, 2, 2); }
    }

    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const ch = grid[yy][xx], px = xx * T, py = yy * T;
      if (ch === '#') {
        if (woods) { x.fillStyle = '#4a331d'; x.fillRect(px, py, T, T); x.fillStyle = '#5f4327'; x.fillRect(px, py, T, 4); }
        else if (icy) { x.fillStyle = '#d7eaf7'; x.fillRect(px, py, T, T); x.fillStyle = '#ffffff'; x.fillRect(px, py, T, 5); x.fillStyle = '#9fc6de'; x.fillRect(px, py + T - 5, T, 5); }
        else { x.fillStyle = '#3b5876'; x.fillRect(px, py, T, T); x.fillStyle = '#4d7398'; x.fillRect(px, py, T, 4); }
      }
      else if (ch === 'c') {
        x.fillStyle = '#6b4a2a'; x.fillRect(px, py, T, T);
        x.fillStyle = '#8a6338'; x.fillRect(px, py, T, 4);
        x.strokeStyle = '#3a2714'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(px + 6, py + 4); x.lineTo(px + 12, py + 15); x.lineTo(px + 7, py + 26);
        x.moveTo(px + 12, py + 15); x.lineTo(px + 22, py + 22); x.stroke();
      }
      else if (ch === '=') { if (woods) { x.fillStyle = '#8a6338'; x.fillRect(px, py + 20, T, 10); } else if (icy) { x.fillStyle = '#bfe9ff'; x.fillRect(px, py + 20, T, 10); x.fillStyle = '#ffffff'; x.fillRect(px, py + 20, T, 3); } else { x.fillStyle = '#8b5a2b'; x.fillRect(px, py + 20, T, 10); } }
      else if (ch === 'o') { x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(px + 16, py + 16, 8, 0, 7); x.fill(); x.fillStyle = '#fff3b0'; x.fillRect(px + 13, py + 13, 5, 5); }
      else if (ch === 'k') { x.fillStyle = '#f5f5f5'; x.fillRect(px + 13, py + 8, 6, 16); x.fillRect(px + 8, py + 13, 16, 6); }
      else if (ch === 'D') { x.fillStyle = '#b5651d'; x.fillRect(px + 3, py + 2, T - 6, T - 2); x.fillStyle = '#ffd23f'; x.fillRect(px + 19, py + 16, 4, 4); }
      else if (ch === 'S') { x.fillStyle = '#45c26a'; x.fillRect(px + 6, py + 12, 20, 18); x.fillStyle = '#8ef0a8'; x.fillRect(px + 10, py + 6, 12, 8); }
      else if (ch === '^') { x.fillStyle = '#e05a5a'; x.beginPath(); x.moveTo(px + 4, py + 30); x.lineTo(px + 16, py + 6); x.lineTo(px + 28, py + 30); x.fill(); }
      else if (ch === 'i') { x.fillStyle = '#bfe9ff'; x.fillRect(px, py, T, T); x.fillStyle = '#7fc9ef'; x.fillRect(px, py + T - 6, T, 6); x.fillStyle = '#ffffffaa'; x.fillRect(px + 5, py + 6, 14, 3); }
      else if (ch === 'w') { x.fillStyle = '#3aa6d8aa'; x.fillRect(px, py, T, T); x.fillStyle = '#8fd8ff'; x.fillRect(px + 4, py + 8 + Math.sin(Date.now() / 300 + xx) * 2, 12, 2); }
      else if (ch === 'P') { x.fillStyle = '#8ef0a8'; x.fillRect(px + 10, py + 10, 12, 20); }
      else if (ch === 'C') { x.fillStyle = '#45c26a'; x.fillRect(px + 14, py + 4, 4, 26); x.fillStyle = '#8ef0a8'; x.beginPath(); x.moveTo(px + 18, py + 4); x.lineTo(px + 30, py + 10); x.lineTo(px + 18, py + 16); x.fill(); }
      else if (ch === 'H') { x.fillStyle = '#ff6b8b'; x.beginPath(); x.arc(px + 12, py + 12, 7, 0, 7); x.arc(px + 20, py + 12, 7, 0, 7); x.fill(); x.beginPath(); x.moveTo(px + 5, py + 12); x.lineTo(px + 27, py + 12); x.lineTo(px + 16, py + 27); x.fill(); }
      else if (ch === 'E') { x.fillStyle = '#45c26a'; x.fillRect(px + 4, py + 2, T - 8, T - 2); x.fillStyle = '#0f1b2d'; x.fillRect(px + 8, py + 8, 16, 20); x.fillStyle = '#ffd23f'; x.fillRect(px + 18, py + 16, 4, 4); }
    }
    // moving platforms
    for (const pl of platforms) {
      x.fillStyle = '#c98a3d'; x.fillRect(pl.x, pl.y, pl.w, pl.h);
      x.fillStyle = '#e8b56a'; x.fillRect(pl.x, pl.y, pl.w, 4);
      x.fillStyle = '#8b5a2b'; x.fillRect(pl.x + 4, pl.y + pl.h, 4, 4); x.fillRect(pl.x + pl.w - 8, pl.y + pl.h, 4, 4);
    }
    // enemies
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.kind === 'walker') {
        x.fillStyle = '#e05a5a'; x.beginPath(); x.arc(e.x + 12, e.y + 12, 12, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.fillRect(e.x + 5, e.y + 8, 5, 5); x.fillRect(e.x + 15, e.y + 8, 5, 5);
        x.fillStyle = '#111'; x.fillRect(e.x + 7, e.y + 10, 3, 3); x.fillRect(e.x + 17, e.y + 10, 3, 3);
      } else if (e.kind === 'flyer') {
        x.fillStyle = '#ffb347'; x.beginPath(); x.ellipse(e.x + 11, e.y + 11, 11, 9, 0, 0, 7); x.fill();
        x.fillStyle = '#ffd88a'; x.beginPath(); x.ellipse(e.x + 3, e.y + 6, 7, 5, -0.5 + Math.sin(e.t * 12) * 0.3, 0, 7); x.fill();
        x.beginPath(); x.ellipse(e.x + 19, e.y + 6, 7, 5, 0.5 - Math.sin(e.t * 12) * 0.3, 0, 7); x.fill();
      } else if (e.kind === 'hammer') {
        x.fillStyle = '#7a4fbf'; x.fillRect(e.x + 2, e.y + 8, 22, 16);
        x.fillStyle = '#b79ae8'; x.fillRect(e.x + 8, e.y + 2, 10, 8);
        x.fillStyle = '#fff'; x.fillRect(e.x + 6, e.y + 12, 4, 4); x.fillRect(e.x + 16, e.y + 12, 4, 4);
      }
    }
    // bosses
    for (const boss of bosses) {
      if (boss.dead) continue;
      x.fillStyle = '#d9c6ff'; x.beginPath(); x.ellipse(boss.x + 13, boss.y + 13, 15, 13, Math.sin(boss.t) * 0.2, 0, 7); x.fill();
      x.fillStyle = '#8f6fd1'; x.beginPath(); x.ellipse(boss.x + 4, boss.y + 8, 9, 6, -0.5, 0, 7); x.fill();
      x.beginPath(); x.ellipse(boss.x + 22, boss.y + 8, 9, 6, 0.5, 0, 7); x.fill();
      x.fillStyle = '#241a3a'; x.fillRect(boss.x + 8, boss.y + 10, 4, 4); x.fillRect(boss.x + 15, boss.y + 10, 4, 4);
      x.fillStyle = '#ff8f8f'; x.fillRect(boss.x + 4, boss.y + 26, 18 * (boss.hp / (boss.maxHp || 2)), 3);
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
    if (overlay) drawOverlay(overlay.title, overlay.sub);
  }

  window.addEventListener('error', e => { const m=$('msg'); if(m) m.textContent='ERR: '+e.message; });
  window.addEventListener('unhandledrejection', e => { const m=$('msg'); if(m) m.textContent='ERR: '+(e.reason&&e.reason.message||e.reason); });

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
    saveLocalRun({ bird, score, coins, level: level + 1, seconds: Math.floor(elapsed) });
  }
  function localRuns() {
    try { return JSON.parse(localStorage.getItem('waddle-runs') || '[]'); } catch (e) { return []; }
  }
  function saveLocalRun(r) {
    try { const l = localRuns(); l.push(r); l.sort((a, b) => b.score - a.score); localStorage.setItem('waddle-runs', JSON.stringify(l.slice(0, 50))); } catch (e) {}
  }
  function localBoard() {
    const rows = localRuns().slice(0, 10).map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + s.bird + '</td><td>' + s.score + '</td><td>' + s.level + '</td></tr>').join('');
    $('board').querySelector('tbody').innerHTML = rows || '<tr><td colspan="4">no waddlers yet</td></tr>';
  }
  function loadBoard() {
    api('/scores').then(d => {
      if (!d) { localBoard(); return; }
      const rows = (d.scores || []).slice(0, 10).map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + s.bird + '</td><td>' + s.score + '</td><td>' + s.level + '</td></tr>').join('');
      $('board').querySelector('tbody').innerHTML = rows || '<tr><td colspan="4">no waddlers yet</td></tr>';
    }).catch(() => { localBoard(); });
  }

  $('play').onclick = () => { reset(); };
  $('mute').onclick = () => { muted = !muted; $('mute').textContent = 'sound: ' + (muted ? 'off' : 'on'); };
  $('name').onchange = () => saveRun();

  function reset() {
    overlay = null;
    lives = 5; coins = 0; keys = 0; score = 0; elapsed = 0;
    $('lives').textContent = lives; $('coins').textContent = 0; $('keys').textContent = 0; $('score').textContent = 0; $('time').textContent = 0;
    const q = new URLSearchParams(location.search);
    let start = 0;
    const lv = parseInt(q.get('level'), 10);
    if (!isNaN(lv) && lv >= 1 && lv <= LEVELS.length) start = lv - 1;
    const lv2 = parseInt(q.get('lives'), 10);
    if (!isNaN(lv2) && lv2 >= 1 && lv2 <= 9) { lives = lv2; $('lives').textContent = lives; }
    loadLevel(start);
  }
  reset(); loadBoard(); requestAnimationFrame(loop);
})();

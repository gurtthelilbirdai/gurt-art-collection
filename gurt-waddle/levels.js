// Gurt's Waddle — twelve levels, generated so every grid is exactly 25x14.
// Legend: P start, E exit, # solid, = one-way platform, o coin, k key,
//         D door, S spring, ^ spike, w water, B boss.
(function (root) {
  const W = 25, H = 14;

  function blank() {
    const g = [];
    for (let y = 0; y < H; y++) g.push(new Array(W).fill('.'));
    return g;
  }
  function put(g, x, y, ch) {
    if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch;
  }
  function rect(g, x, y, w, h, ch) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, ch);
  }
  function ground(g, holes) {
    rect(g, 0, 12, W, 2, '#');
    (holes || []).forEach(([x, w]) => rect(g, x, 12, w, 2, '.'));
  }
  function row(g, y, x, ch, n) { rect(g, x, y, n, 1, ch); }
  function col(g, x, y, ch, n) { rect(g, x, y, 1, n, ch); }
  function coins(g, pairs) { pairs.forEach(([x, y]) => put(g, x, y, 'o')); }

  const builders = [
    // 1 — first steps: flat ground, a line of coins, exit far right
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      coins(g, [[5, 10], [9, 10], [13, 10], [17, 10]]);
      return g;
    },
    // 2 — gaps: three pits bridged by one-way platforms
    () => {
      const g = blank(); ground(g, [[7, 3], [13, 3], [19, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 9, 7, '=', 3); row(g, 8, 13, '=', 3); row(g, 9, 19, '=', 3);
      coins(g, [[4, 10], [8, 8], [14, 7], [20, 8]]);
      return g;
    },
    // 3 — springs over spikes
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 6, '^', 2); row(g, 11, 13, '^', 2); row(g, 11, 19, '^', 2);
      put(g, 5, 10, 'S'); put(g, 12, 10, 'S'); put(g, 18, 10, 'S');
      coins(g, [[5, 7], [12, 7], [18, 7], [22, 10]]);
      return g;
    },
    // 4 — one key, one door
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 4, 9, 'k'); put(g, 12, 10, 'D');
      coins(g, [[8, 10], [16, 10], [20, 10]]);
      return g;
    },
    // 5 — cold water
    () => {
      const g = blank(); ground(g, [[6, 5], [15, 6]]);
      rect(g, 6, 12, 5, 2, 'w'); rect(g, 15, 12, 6, 2, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 9, 7, '=', 3); row(g, 9, 16, '=', 4);
      coins(g, [[8, 8], [17, 8], [12, 10]]);
      return g;
    },
    // 6 — stairway to nowhere
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 5, '=', 3); row(g, 9, 9, '=', 3); row(g, 8, 13, '=', 3); row(g, 7, 17, '=', 3);
      coins(g, [[6, 9], [10, 8], [14, 7], [18, 6], [21, 10]]);
      return g;
    },
    // 7 — spike corridor
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 5, '^', 1); row(g, 11, 9, '^', 1); row(g, 11, 13, '^', 1);
      row(g, 11, 17, '^', 1); row(g, 11, 20, '^', 1);
      coins(g, [[5, 8], [9, 8], [13, 8], [17, 8], [21, 8]]);
      return g;
    },
    // 8 — two keys, two doors
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 4, 9, 'k'); put(g, 8, 9, 'k');
      put(g, 11, 10, 'D'); put(g, 16, 10, 'D');
      coins(g, [[6, 10], [13, 10], [19, 10], [21, 10]]);
      return g;
    },
    // 9 — floating over the pond
    () => {
      const g = blank(); ground(g, [[5, 4], [12, 5], [20, 4]]);
      rect(g, 5, 12, 4, 2, 'w'); rect(g, 12, 12, 5, 2, 'w'); rect(g, 20, 12, 4, 2, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 9, 6, '=', 3); row(g, 8, 13, '=', 3); row(g, 9, 20, '=', 3);
      coins(g, [[7, 8], [14, 7], [21, 8]]);
      return g;
    },
    // 10 — the long climb
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 4, '=', 3); row(g, 9, 8, '=', 3); row(g, 8, 12, '=', 3);
      row(g, 7, 16, '=', 3); row(g, 6, 20, '=', 3);
      coins(g, [[5, 9], [9, 8], [13, 7], [17, 6], [21, 5]]);
      return g;
    },
    // 11 — spring city
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      [5, 10, 15, 20].forEach(x => { put(g, x, 10, 'S'); row(g, 11, x + 1, '^', 2); });
      coins(g, [[5, 6], [10, 6], [15, 6], [20, 6], [23, 10]]);
      return g;
    },
    // 12 — the Moon Moth
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 21, 10, 'B');
      coins(g, [[6, 10], [11, 10], [16, 10], [18, 6]]);
      row(g, 6, 16, '=', 3);
      return g;
    }
  ];

  const LEVELS = builders.map(b => b().map(r => r.join('')));

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);

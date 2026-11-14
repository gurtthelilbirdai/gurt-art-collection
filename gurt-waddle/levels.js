// Gurt's Waddle — twenty levels, every grid exactly 25x14.
// Legend: P start, E exit, # solid, = one-way platform, o coin, k key,
//         D door, S spring, ^ spike, w water, B boss,
//         C checkpoint, e walker enemy, M moving platform, m moving spike,
//         i slippery ice block, f flyer, h hammer.
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
    // 1 — first steps
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      coins(g, [[5, 11], [9, 11], [13, 11], [17, 11]]);
      return g;
    },
    // 2 — gaps bridged by one-way platforms
    () => {
      const g = blank(); ground(g, [[7, 3], [13, 3], [19, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 6, '=', 5); row(g, 12, 12, '=', 5); row(g, 12, 18, '=', 5);
      coins(g, [[4, 11], [8, 11], [14, 11], [20, 11]]);
      return g;
    },
    // 3 — springs over spikes
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 6, '^', 2); row(g, 11, 13, '^', 2); row(g, 11, 19, '^', 2);
      put(g, 5, 11, 'S'); put(g, 12, 11, 'S'); put(g, 18, 11, 'S');
      put(g, 15, 7, 'f');
      coins(g, [[5, 8], [12, 8], [18, 8], [22, 11]]);
      return g;
    },
    // 4 — one key, one door
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 4, 9, 'k'); put(g, 12, 11, 'D');
      coins(g, [[8, 11], [16, 11], [20, 11]]);
      return g;
    },
    // 5 — cold water
    () => {
      const g = blank(); ground(g, [[6, 4], [15, 4]]);
      rect(g, 6, 13, 4, 1, 'w'); rect(g, 15, 13, 4, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 6, '=', 5); row(g, 12, 15, '=', 5);
      put(g, 10, 8, 'f');
      coins(g, [[8, 11], [17, 11], [12, 11]]);
      return g;
    },
    // 6 — stairway to nowhere
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 5, '=', 3); row(g, 9, 9, '=', 3); row(g, 8, 13, '=', 3); row(g, 7, 17, '=', 3);
      coins(g, [[6, 9], [10, 8], [14, 7], [18, 6], [21, 11]]);
      return g;
    },
    // 7 — spike corridor
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 5, '^', 1); row(g, 11, 9, '^', 1); row(g, 11, 13, '^', 1);
      row(g, 11, 17, '^', 1); row(g, 11, 20, '^', 1);
      coins(g, [[5, 9], [9, 9], [13, 9], [17, 9], [21, 9]]);
      return g;
    },
    // 8 — two keys, two doors
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 4, 9, 'k'); put(g, 8, 9, 'k');
      put(g, 11, 11, 'D'); put(g, 16, 11, 'D');
      coins(g, [[6, 11], [13, 11], [19, 11], [21, 11]]);
      return g;
    },
    // 9 — floating over the pond
    () => {
      const g = blank(); ground(g, [[5, 4], [12, 4], [20, 4]]);
      rect(g, 5, 13, 4, 1, 'w'); rect(g, 12, 13, 4, 1, 'w'); rect(g, 20, 13, 4, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 5, '=', 5); row(g, 12, 12, '=', 5); row(g, 12, 19, '=', 5);
      coins(g, [[7, 11], [14, 11], [21, 11]]);
      return g;
    },
    // 10 — the long climb
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 4, '=', 3); row(g, 9, 8, '=', 3); row(g, 8, 12, '=', 3);
      row(g, 7, 16, '=', 3); row(g, 6, 20, '=', 3);
      put(g, 21, 10, 'H');
      coins(g, [[5, 9], [9, 8], [13, 7], [17, 6], [21, 5]]);
      return g;
    },
    // 11 — spring city
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      [5, 10, 15, 20].forEach(x => { put(g, x, 11, 'S'); row(g, 11, x + 1, '^', 2); });
      coins(g, [[5, 7], [10, 7], [15, 7], [20, 7], [21, 11]]);
      return g;      put(g, 8, 11, 'e'); put(g, 18, 11, 'e');

    },
    // 12 — the Moon Moth
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 21, 10, 'B');
      put(g, 8, 9, 'f'); put(g, 13, 10, 'H');
      coins(g, [[6, 11], [11, 11], [16, 11], [18, 8]]);
      row(g, 10, 16, '=', 4);
      return g;
    },
    // 13 — checkpoint meadow
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 12, 11, 'C');
      row(g, 11, 6, '^', 2); row(g, 11, 15, '^', 2);
      coins(g, [[4, 11], [9, 11], [14, 11], [19, 11], [22, 11]]);
      return g;
    },
    // 14 — walker patrol
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 8, 11, 'e'); put(g, 16, 11, 'e');
      put(g, 12, 11, 'C');
      put(g, 20, 10, 'H');
      coins(g, [[4, 11], [10, 11], [14, 11], [20, 11]]);
      return g;
    },
    // 15 — the ferry
    () => {
      const g = blank(); ground(g, [[4, 17]]);
      rect(g, 4, 13, 17, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 2, 12, 'F'); put(g, 22, 12, 'G');
      put(g, 12, 11, 'C');
      coins(g, [[7, 11], [17, 11]]);
      return g;
    },
    // 16 — elevator shaft
    () => {
      const g = blank(); ground(g, [[10, 5]]);
      rect(g, 10, 13, 5, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 11, 10, 'V');
      col(g, 12, 4, '=', 1);
      row(g, 6, 12, '=', 4); row(g, 9, 18, '=', 4);
      put(g, 12, 11, 'C');
      coins(g, [[4, 11], [14, 5], [20, 8]]);
      return g;
    },
    // 17 — hammerhead
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 12, 11, 'C');
      put(g, 7, 9, 'm'); put(g, 17, 9, 'm');
      row(g, 11, 9, '^', 2); row(g, 11, 14, '^', 2);
      put(g, 10, 7, 'f');
      coins(g, [[4, 11], [10, 11], [15, 11], [20, 11]]);
      return g;
    },
    // 18 — key garden
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 5, 8, 'k'); put(g, 12, 8, 'k'); put(g, 19, 8, 'k');
      put(g, 9, 11, 'D'); put(g, 15, 11, 'D'); put(g, 21, 11, 'D');
      put(g, 12, 11, 'C');
      coins(g, [[3, 11], [7, 11], [13, 11], [17, 11]]);
      return g;
    },
    // 19 — the long pond
    () => {
      const g = blank(); ground(g, [[3, 5], [11, 5], [19, 5]]);
      rect(g, 3, 13, 5, 1, 'w'); rect(g, 11, 13, 5, 1, 'w'); rect(g, 19, 13, 5, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 6, 11, 'M'); put(g, 14, 11, 'M'); put(g, 21, 11, 'M');
      put(g, 9, 11, 'C');
      coins(g, [[5, 11], [13, 11], [20, 11]]);
      return g;
    },
    // 20 — the Moon Moth's big garden
    () => {
      const g = blank();
      row(g, 12, 0, '#', 25); row(g, 13, 0, '#', 25);
      // plank bridges over both ponds: walkable on top of row 12
      row(g, 11, 7, '.', 4); row(g, 11, 16, '.', 4);
      row(g, 12, 7, '#', 4); row(g, 12, 16, '#', 4);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 21, 10, 'B');
      put(g, 10, 10, 'B');
      put(g, 12, 11, 'C');
      // drifting planks above the bridges, for the coin route
      coins(g, [[3, 11], [8, 10], [13, 11], [17, 10], [15, 7]]);
      return g;
    },
    // 21 — ice pond
    () => {
      const g = blank(); ground(g, [[6, 4], [15, 4]]);
      rect(g, 6, 13, 4, 1, 'w'); rect(g, 15, 13, 4, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 6, 'i', 4); row(g, 12, 15, 'i', 4);
      put(g, 10, 8, 'f');
      coins(g, [[8, 11], [17, 11], [12, 11]]);
      return g;
    },
    // 22 — spike and spring mix
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 6, '^', 2); row(g, 11, 13, '^', 2); row(g, 11, 20, '^', 2);
      put(g, 5, 11, 'S'); put(g, 12, 11, 'S'); put(g, 19, 11, 'S');
      put(g, 9, 8, 'f'); put(g, 16, 8, 'f');
      coins(g, [[5, 8], [12, 8], [19, 8], [22, 11]]);
      return g;
    },
    // 23 — three doors
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 3, 9, 'k'); put(g, 9, 9, 'k'); put(g, 15, 9, 'k');
      put(g, 6, 11, 'D'); put(g, 12, 11, 'D'); put(g, 18, 11, 'D');
      put(g, 21, 10, 'H');
      coins(g, [[5, 11], [11, 11], [17, 11], [20, 11]]);
      return g;
    },
    // 24 — walker hall
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 6, 11, 'e'); put(g, 11, 11, 'e'); put(g, 16, 11, 'e'); put(g, 20, 11, 'e');
      put(g, 13, 11, 'C');
      coins(g, [[4, 11], [9, 11], [14, 11], [18, 11]]);
      return g;
    },
    // 25 — the frozen climb
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 4, 'i', 4); row(g, 10, 9, 'i', 4); row(g, 9, 14, 'i', 4); row(g, 8, 19, 'i', 4);
      put(g, 12, 11, 'C');
      coins(g, [[5, 10], [10, 9], [15, 8], [20, 7], [22, 11]]);
      return g;
    },
    // 26 — moth watch
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 20, 10, 'B');
      put(g, 9, 9, 'f'); put(g, 14, 8, 'f');
      put(g, 12, 11, 'C');
      coins(g, [[5, 11], [10, 11], [16, 11], [18, 8]]);
      return g;
    },
    // 27 — moving platform over the icy gap
    () => {
      const g = blank(); ground(g, [[10, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 10, '=', 3);
      put(g, 14, 11, 'C');
      coins(g, [[4, 11], [11, 11], [17, 11], [21, 11]]);
      return g;
    },
    // 28 — hammer bridge
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 8, 9, 'm'); put(g, 17, 9, 'm');
      row(g, 11, 6, '^', 2); row(g, 11, 13, '^', 2);
      put(g, 12, 11, 'C');
      coins(g, [[4, 11], [10, 11], [15, 11], [21, 11]]);
      return g;
    },
    // 29 — key tower
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 4, '=', 3); row(g, 9, 8, '=', 3); row(g, 8, 12, '=', 3); row(g, 7, 16, '=', 3);
      put(g, 6, 8, 'k'); put(g, 10, 7, 'k'); put(g, 14, 6, 'k'); put(g, 18, 5, 'k');
      put(g, 9, 11, 'D'); put(g, 15, 11, 'D'); put(g, 21, 11, 'D');
      put(g, 12, 11, 'C');
      coins(g, [[5, 9], [9, 8], [13, 7], [17, 6], [20, 11]]);
      return g;
    },
    // 30 — the long ferry
    () => {
      const g = blank(); ground(g);
      // a frozen river runs under the ferry deck
      rect(g, 3, 13, 19, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 11, 11, 'M');
      put(g, 16, 11, 'C');
      coins(g, [[4, 11], [9, 11], [14, 11], [19, 11]]);
      return g;
    },
    // 31 — spring ladder
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      [4, 9, 14, 19].forEach(x => { put(g, x, 11, 'S'); row(g, 11, x + 1, '^', 2); });
      put(g, 12, 11, 'C');
      coins(g, [[4, 7], [9, 7], [14, 7], [19, 7], [22, 11]]);
      return g;
    },
    // 32 — moth and moth
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 10, 10, 'B'); put(g, 18, 10, 'B');
      put(g, 14, 11, 'C');
      row(g, 10, 13, '=', 4);
      coins(g, [[4, 11], [8, 8], [16, 8], [21, 11]]);
      return g;
    },
    // 33 — the slippery corridor
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 5, 'i', 8); row(g, 11, 15, 'i', 7);
      put(g, 13, 11, '^');
      put(g, 12, 11, 'C');
      coins(g, [[7, 10], [10, 10], [17, 10], [20, 10]]);
      return g;
    },
    // 34 — hammer and moth
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 8, 9, 'm'); put(g, 21, 10, 'B');
      put(g, 14, 11, 'C');
      coins(g, [[4, 11], [10, 11], [16, 11], [19, 8]]);
      return g;
    },
    // 35 — four doors
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 3, 9, 'k'); put(g, 8, 9, 'k'); put(g, 13, 9, 'k'); put(g, 18, 9, 'k');
      put(g, 5, 11, 'D'); put(g, 10, 11, 'D'); put(g, 15, 11, 'D'); put(g, 20, 11, 'D');
      put(g, 12, 11, 'C');
      coins(g, [[7, 11], [12, 11], [17, 11]]);
      return g;
    },
    // 36 — the deep pond
    () => {
      const g = blank(); ground(g, [[3, 5], [11, 5], [19, 5]]);
      rect(g, 3, 13, 5, 1, 'w'); rect(g, 11, 13, 5, 1, 'w'); rect(g, 19, 13, 5, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 3, '=', 5); row(g, 12, 11, '=', 5); row(g, 12, 19, '=', 5);
      put(g, 9, 11, 'C');
      put(g, 13, 8, 'f');
      coins(g, [[5, 10], [13, 10], [20, 10]]);
      return g;
    },
    // 37 — the long climb, colder
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 4, 'i', 3); row(g, 9, 8, 'i', 3); row(g, 8, 12, 'i', 3);
      row(g, 7, 16, 'i', 3); row(g, 6, 20, 'i', 3);
      put(g, 21, 10, 'H');
      put(g, 12, 11, 'C');
      coins(g, [[5, 9], [9, 8], [13, 7], [17, 6], [21, 5]]);
      return g;
    },
    // 38 — three moths
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 8, 10, 'B'); put(g, 14, 10, 'B'); put(g, 20, 10, 'B');
      put(g, 12, 11, 'C');
      row(g, 10, 5, '=', 3); row(g, 10, 17, '=', 3);
      coins(g, [[4, 11], [11, 8], [17, 8], [22, 11]]);
      return g;
    },
    // 39 — everything at once
    () => {
      const g = blank(); ground(g, [[7, 3], [16, 3]]);
      rect(g, 7, 13, 3, 1, 'w'); rect(g, 16, 13, 3, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 7, 'i', 3); row(g, 12, 16, 'i', 3);
      put(g, 5, 11, 'k'); put(g, 14, 11, 'k');
      put(g, 11, 11, 'D'); put(g, 18, 11, 'D');
      put(g, 9, 8, 'm'); put(g, 14, 7, 'f');
      put(g, 12, 11, 'C');
      coins(g, [[4, 11], [10, 11], [15, 11], [21, 11]]);
      return g;
    },
    // 40 — the Moon Moth's last garden
    () => {
      const g = blank();
      row(g, 12, 0, '#', 25); row(g, 13, 0, '#', 25);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 21, 10, 'B'); put(g, 10, 10, 'B');
      put(g, 12, 11, 'C');
      put(g, 4, 11, 'S'); put(g, 19, 11, 'S');
      put(g, 4, 10, 'k'); put(g, 19, 10, 'k');
      row(g, 11, 7, 'i', 4); row(g, 11, 16, 'i', 4);
      coins(g, [[3, 11], [8, 10], [13, 11], [17, 10], [15, 7]]);
      return g;
    },
    // 41 — the lantern woods
    () => {
      const g = blank(); ground(g, [[9, 3], [17, 3]]);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 9, 'c', 3); row(g, 12, 17, 'c', 3);
      put(g, 13, 11, 'C');
      coins(g, [[4, 11], [10, 10], [18, 10], [21, 11]]);
      return g;
    },
    // 42 — crumbling steps
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 6, 11, 'c'); put(g, 9, 10, 'c'); put(g, 12, 9, 'c'); put(g, 15, 8, 'c');
      put(g, 12, 11, 'C');
      coins(g, [[6, 10], [9, 9], [12, 8], [15, 7], [21, 11]]);
      return g;
    },
    // 43 — moth over the rot
    () => {
      const g = blank(); ground(g, [[8, 4], [16, 4]]);
      rect(g, 8, 13, 4, 1, 'w'); rect(g, 16, 13, 4, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 8, 'c', 4); row(g, 12, 16, 'c', 4);
      put(g, 20, 10, 'B');
      put(g, 13, 11, 'C');
      coins(g, [[5, 11], [12, 8], [19, 11]]);
      return g;
    },
    // 44 — key roots
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 5, 9, 'k'); put(g, 12, 8, 'k'); put(g, 19, 9, 'k');
      put(g, 9, 11, 'D'); put(g, 15, 11, 'D'); put(g, 21, 11, 'D');
      put(g, 12, 11, 'C');
      coins(g, [[3, 11], [7, 11], [13, 11], [17, 11]]);
      return g;
    },
    // 45 — the lantern ferry
    () => {
      const g = blank(); ground(g, [[4, 17]]);
      rect(g, 4, 13, 17, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 2, 12, 'F'); put(g, 22, 12, 'G');
      put(g, 12, 11, 'C');
      coins(g, [[7, 11], [17, 11]]);
      return g;
    },
    // 46 — spring thicket
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      [5, 10, 15, 20].forEach(x => { put(g, x, 11, 'S'); row(g, 11, x + 1, '^', 2); });
      put(g, 12, 11, 'C');
      coins(g, [[5, 7], [10, 7], [15, 7], [20, 7], [22, 11]]);
      return g;
    },
    // 47 — walker patrol
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 7, 11, 'e'); put(g, 13, 11, 'e'); put(g, 19, 11, 'e');
      put(g, 12, 11, 'C');
      put(g, 21, 10, 'H');
      coins(g, [[4, 11], [10, 11], [16, 11], [22, 11]]);
      return g;
    },
    // 48 — the crumbling bridge
    () => {
      const g = blank(); ground(g, [[5, 15]]);
      rect(g, 5, 13, 15, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      for (let x = 5; x < 20; x += 2) put(g, x, 12, 'c');
      put(g, 12, 11, 'C');
      coins(g, [[3, 11], [9, 10], [15, 10], [21, 11]]);
      return g;
    },
    // 49 — moth and moth
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 9, 10, 'B'); put(g, 17, 10, 'B');
      put(g, 13, 11, 'C');
      row(g, 10, 12, '=', 3);
      coins(g, [[4, 11], [7, 8], [19, 8], [22, 11]]);
      return g;
    },
    // 50 — the long climb, warm
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 4, '=', 3); row(g, 9, 8, '=', 3); row(g, 8, 12, '=', 3);
      row(g, 7, 16, '=', 3); row(g, 6, 20, '=', 3);
      put(g, 21, 10, 'H');
      put(g, 12, 11, 'C');
      coins(g, [[5, 9], [9, 8], [13, 7], [17, 6], [21, 5]]);
      return g;
    },
    // 51 — the deep rot
    () => {
      const g = blank(); ground(g, [[3, 5], [11, 5], [19, 5]]);
      rect(g, 3, 13, 5, 1, 'w'); rect(g, 11, 13, 5, 1, 'w'); rect(g, 19, 13, 5, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 3, 'c', 5); row(g, 12, 11, 'c', 5); row(g, 12, 19, 'c', 5);
      put(g, 9, 11, 'C');
      put(g, 14, 8, 'f');
      coins(g, [[5, 10], [13, 10], [21, 10]]);
      return g;
    },
    // 52 — three moths
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 7, 10, 'B'); put(g, 13, 10, 'B'); put(g, 19, 10, 'B');
      put(g, 12, 11, 'C');
      row(g, 10, 4, '=', 3); row(g, 10, 16, '=', 3);
      coins(g, [[4, 11], [10, 8], [16, 8], [22, 11]]);
      return g;
    },
    // 53 — hammer roots
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 8, 9, 'm'); put(g, 17, 9, 'm');
      row(g, 11, 6, '^', 2); row(g, 11, 13, '^', 2);
      put(g, 10, 7, 'f');
      put(g, 12, 11, 'C');
      coins(g, [[4, 11], [10, 11], [15, 11], [20, 11]]);
      return g;
    },
    // 54 — four doors
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 3, 9, 'k'); put(g, 8, 9, 'k'); put(g, 13, 9, 'k'); put(g, 18, 9, 'k');
      put(g, 5, 11, 'D'); put(g, 10, 11, 'D'); put(g, 15, 11, 'D'); put(g, 20, 11, 'D');
      put(g, 12, 11, 'C');
      coins(g, [[7, 11], [12, 11], [17, 11]]);
      return g;
    },
    // 55 — the elevator in the roots
    () => {
      const g = blank(); ground(g, [[10, 5]]);
      rect(g, 10, 13, 5, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 11, 10, 'V');
      row(g, 6, 12, '=', 4); row(g, 9, 18, '=', 4);
      put(g, 12, 11, 'C');
      coins(g, [[4, 11], [14, 5], [20, 8]]);
      return g;
    },
    // 56 — crumbling stairs
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 6, 11, 'c'); put(g, 8, 10, 'c'); put(g, 10, 9, 'c');
      put(g, 12, 8, 'c'); put(g, 14, 9, 'c'); put(g, 16, 10, 'c'); put(g, 18, 11, 'c');
      put(g, 12, 11, 'C');
      coins(g, [[6, 10], [10, 8], [14, 7], [18, 10], [22, 11]]);
      return g;
    },
    // 57 — moth watch, warm
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 20, 10, 'B');
      put(g, 9, 9, 'f'); put(g, 14, 8, 'f');
      put(g, 12, 11, 'C');
      coins(g, [[5, 11], [10, 11], [16, 11], [18, 8]]);
      return g;
    },
    // 58 — everything at once, warm
    () => {
      const g = blank(); ground(g, [[7, 3], [16, 3]]);
      rect(g, 7, 13, 3, 1, 'w'); rect(g, 16, 13, 3, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 7, 'c', 3); row(g, 12, 16, 'c', 3);
      put(g, 5, 11, 'k'); put(g, 14, 11, 'k');
      put(g, 11, 11, 'D'); put(g, 18, 11, 'D');
      put(g, 9, 8, 'm'); put(g, 14, 7, 'f');
      put(g, 12, 11, 'C');
      coins(g, [[4, 11], [10, 11], [15, 11], [21, 11]]);
      return g;
    },
    // 59 — the lantern tower
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      // a clear ground corridor: keys sit before each locked door
      put(g, 4, 11, 'k'); put(g, 10, 11, 'k'); put(g, 18, 11, 'k');
      put(g, 7, 11, 'D'); put(g, 15, 11, 'D'); put(g, 21, 11, 'D');
      put(g, 11, 11, 'C');
      // lantern shelves float overhead, reachable with a jump
      row(g, 8, 3, '#', 2); row(g, 7, 9, '#', 2); row(g, 8, 16, '#', 2); row(g, 7, 20, '#', 2);
      coins(g, [[3, 7], [4, 7], [9, 6], [10, 6], [16, 7], [17, 7], [20, 6], [21, 6], [22, 9]]);
      return g;
    },
    // 60 — the Moon Moth's lantern garden
    () => {
      const g = blank();
      row(g, 12, 0, '#', 25); row(g, 13, 0, '#', 25);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 21, 10, 'B'); put(g, 10, 10, 'B'); put(g, 15, 10, 'B');
      put(g, 12, 11, 'C');
      put(g, 4, 11, 'S'); put(g, 19, 11, 'S');
      put(g, 4, 10, 'k'); put(g, 19, 10, 'k');

      coins(g, [[3, 11], [8, 10], [13, 11], [17, 10], [15, 7]]);
      return g;
    },

    // 61 — first beach of the starfall coast
    () => {
      const g = blank(); ground(g, [[7, 4], [15, 4]]);
      rect(g, 7, 13, 4, 1, 'w'); rect(g, 15, 13, 4, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 7, '=', 4); row(g, 12, 15, '=', 4);
      put(g, 11, 8, 'f');
      coins(g, [[4, 11], [9, 11], [17, 11], [21, 11]]);
      return g;
    },
    // 62 — tide pools
    () => {
      const g = blank(); ground(g, [[5, 3], [11, 3], [17, 3]]);
      rect(g, 5, 13, 3, 1, 'w'); rect(g, 11, 13, 3, 1, 'w'); rect(g, 17, 13, 3, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 5, '=', 3); row(g, 12, 11, '=', 3); row(g, 12, 17, '=', 3);
      put(g, 8, 8, 'f'); put(g, 14, 7, 'f');
      put(g, 12, 11, 'C');
      coins(g, [[3, 11], [9, 11], [15, 11], [20, 11]]);
      return g;
    },
    // 63 — the jetty
    () => {
      const g = blank(); ground(g, [[4, 17]]);
      rect(g, 4, 13, 17, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 2, 12, 'F'); put(g, 22, 12, 'G');
      put(g, 12, 11, 'C');
      coins(g, [[6, 11], [12, 11], [18, 11]]);
      return g;
    },
    // 64 — shell stair
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 5, '=', 3); row(g, 9, 9, '=', 3); row(g, 8, 13, '=', 3);
      row(g, 7, 17, '=', 3); row(g, 6, 21, '=', 3);
      coins(g, [[4, 9], [8, 8], [12, 7], [16, 6], [20, 5]]);
      return g;
    },
    // 65 — driftwood spikes
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 5, '^', 2); row(g, 11, 11, '^', 2); row(g, 11, 17, '^', 2);
      put(g, 8, 11, 'S'); put(g, 14, 11, 'S');
      put(g, 12, 11, 'C');
      coins(g, [[4, 11], [10, 11], [16, 11], [21, 11]]);
      return g;
    },
    // 66 — the lighthouse door
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 4, 9, 'k'); put(g, 12, 11, 'D');
      put(g, 18, 9, 'k'); put(g, 21, 11, 'D');
      put(g, 9, 11, 'C');
      coins(g, [[7, 11], [15, 11], [19, 11]]);
      return g;
    },
    // 67 — the long pier
    () => {
      const g = blank(); ground(g, [[3, 5], [11, 5], [19, 5]]);
      rect(g, 3, 13, 5, 1, 'w'); rect(g, 11, 13, 5, 1, 'w'); rect(g, 19, 13, 5, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 6, 11, 'M'); put(g, 14, 11, 'M'); put(g, 21, 11, 'M');
      put(g, 9, 11, 'C');
      coins(g, [[5, 11], [13, 11], [20, 11]]);
      return g;
    },
    // 68 — dune climb
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 11, 4, '#', 2); row(g, 10, 7, '#', 2); row(g, 9, 10, '#', 2);
      row(g, 8, 13, '#', 2); row(g, 7, 16, '#', 2); row(g, 6, 19, '#', 2);
      put(g, 22, 5, 'H');
      coins(g, [[5, 10], [8, 9], [11, 8], [14, 7], [17, 6]]);
      return g;
    },
    // 69 — sand drifters
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 7, 11, 'e'); put(g, 15, 11, 'e');
      put(g, 12, 11, 'C');
      put(g, 19, 9, 'f');
      coins(g, [[4, 11], [10, 11], [13, 11], [18, 11], [22, 11]]);
      return g;
    },
    // 70 — the tide elevator
    () => {
      const g = blank(); ground(g, [[10, 5]]);
      rect(g, 10, 13, 5, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 11, 10, 'V');
      row(g, 6, 12, '=', 4); row(g, 9, 18, '=', 4);
      put(g, 12, 11, 'C');
      coins(g, [[4, 11], [14, 5], [20, 8]]);
      return g;
    },
    // 71 — three keys, three doors
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 4, 9, 'k'); put(g, 10, 9, 'k'); put(g, 16, 9, 'k');
      put(g, 7, 11, 'D'); put(g, 13, 11, 'D'); put(g, 20, 11, 'D');
      put(g, 12, 11, 'C');
      coins(g, [[3, 11], [9, 11], [15, 11], [22, 11]]);
      return g;
    },
    // 72 — hammerhead shore
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 12, 11, 'C');
      put(g, 7, 9, 'm'); put(g, 17, 9, 'm');
      row(g, 11, 9, '^', 2); row(g, 11, 14, '^', 2);
      put(g, 10, 7, 'f');
      coins(g, [[4, 11], [11, 11], [15, 11], [20, 11]]);
      return g;
    },
    // 73 — the starfall shore
    () => {
      const g = blank(); ground(g, [[6, 4], [15, 4]]);
      rect(g, 6, 13, 4, 1, 'w'); rect(g, 15, 13, 4, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 6, 'i', 4); row(g, 12, 15, 'i', 4);
      put(g, 11, 8, 'f');
      put(g, 12, 11, 'C');
      coins(g, [[4, 11], [9, 11], [17, 11], [21, 11]]);
      return g;
    },
    // 74 — crumbling driftwood
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 6, 11, 'c'); put(g, 8, 10, 'c'); put(g, 10, 9, 'c');
      put(g, 12, 8, 'c'); put(g, 14, 9, 'c'); put(g, 16, 10, 'c'); put(g, 18, 11, 'c');
      put(g, 12, 11, 'C');
      coins(g, [[6, 10], [10, 8], [14, 7], [18, 10], [22, 11]]);
      return g;
    },
    // 75 — coast moths
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 20, 10, 'B');
      put(g, 9, 9, 'f'); put(g, 14, 8, 'f');
      put(g, 12, 11, 'C');
      coins(g, [[5, 11], [10, 11], [16, 11], [18, 8]]);
      return g;
    },
    // 76 — the harbour tower
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 4, 11, 'k'); put(g, 10, 11, 'k'); put(g, 18, 11, 'k');
      put(g, 7, 11, 'D'); put(g, 15, 11, 'D'); put(g, 21, 11, 'D');
      put(g, 11, 11, 'C');
      row(g, 8, 3, '#', 2); row(g, 7, 9, '#', 2); row(g, 8, 16, '#', 2); row(g, 7, 20, '#', 2);
      coins(g, [[3, 7], [4, 7], [9, 6], [10, 6], [16, 7], [17, 7], [20, 6], [21, 6]]);
      return g;
    },
    // 77 — tide break
    () => {
      const g = blank(); ground(g, [[7, 3], [16, 3]]);
      rect(g, 7, 13, 3, 1, 'w'); rect(g, 16, 13, 3, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 12, 7, 'c', 3); row(g, 12, 16, 'c', 3);
      put(g, 5, 11, 'k'); put(g, 14, 11, 'k');
      put(g, 11, 11, 'D'); put(g, 18, 11, 'D');
      put(g, 9, 8, 'm'); put(g, 14, 7, 'f');
      put(g, 12, 11, 'C');
      coins(g, [[3, 11], [9, 11], [13, 11], [21, 11]]);
      return g;
    },
    // 78 — the ferry home
    () => {
      const g = blank(); ground(g, [[4, 17]]);
      rect(g, 4, 13, 17, 1, 'w');
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 2, 12, 'F'); put(g, 22, 12, 'G');
      put(g, 12, 11, 'C');
      put(g, 8, 9, 'f'); put(g, 16, 9, 'f');
      coins(g, [[6, 11], [12, 11], [18, 11]]);
      return g;
    },
    // 79 — the lighthouse climb
    () => {
      const g = blank(); ground(g);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      row(g, 10, 4, '=', 3); row(g, 9, 8, '=', 3); row(g, 8, 12, '=', 3);
      row(g, 7, 16, '=', 3); row(g, 6, 20, '=', 3);
      put(g, 12, 11, 'C');
      put(g, 6, 6, 'f'); put(g, 18, 5, 'f');
      coins(g, [[4, 9], [8, 8], [12, 7], [16, 6], [20, 5]]);
      return g;
    },
    // 80 — the Starfall Moth
    () => {
      const g = blank();
      row(g, 12, 0, '#', 25); row(g, 13, 0, '#', 25);
      put(g, 1, 11, 'P'); put(g, 23, 11, 'E');
      put(g, 21, 10, 'B'); put(g, 10, 10, 'B'); put(g, 15, 10, 'B');
      put(g, 12, 11, 'C');
      put(g, 4, 11, 'S'); put(g, 19, 11, 'S');
      put(g, 4, 10, 'k'); put(g, 19, 10, 'k');
      coins(g, [[3, 11], [8, 10], [13, 11], [17, 10], [15, 7]]);
      return g;
    },
  ];

  const LEVELS = builders.map(b => b().map(r => r.join('')));

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);

// fig. 04: a procedurally generated "satellite" scene, scanned tile by tile.
// Scores come from how much synthetic fire each tile contains, not from a model.
const W = 320, H = 200, COLS = 8, ROWS = 5, TW = W / COLS, TH = H / ROWS;

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise2(rand) {
  const S = 64, g = new Float32Array(S * S);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  const at = (x, y) => g[(y & 63) * S + (x & 63)];
  const smooth = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  return (x, y, oct = 4) => {
    let v = 0, amp = 0.5, f = 1, tot = 0;
    for (let o = 0; o < oct; o++) { v += smooth(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return v / tot;
  };
}

const RAMP = [[0, [22, 30, 22]], [0.42, [36, 48, 30]], [0.58, [62, 70, 40]], [0.74, [104, 92, 60]], [1, [140, 124, 88]]];
function ramp(h) {
  for (let i = 1; i < RAMP.length; i++) {
    if (h <= RAMP[i][0]) {
      const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i], k = (h - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
    }
  }
  return RAMP[RAMP.length - 1][1];
}
const mix = (c, to, k) => { c[0] += (to[0] - c[0]) * k; c[1] += (to[1] - c[1]) * k; c[2] += (to[2] - c[2]) * k; };

function scene(seed, ctx) {
  const rand = rng(seed), fbm = noise2(rand);
  const fires = [];
  const count = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) fires.push({ x: 24 + rand() * (W - 48), y: 20 + rand() * (H - 40), r: 9 + rand() * 15 });
  const wind = rand() * Math.PI * 2, wx = Math.cos(wind), wy = Math.sin(wind);
  const img = ctx.createImageData(W, H), d = img.data;
  const tileMax = new Float32Array(COLS * ROWS);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h = fbm(x / 70, y / 70) * 0.85 + fbm(x / 9, y / 9, 2) * 0.15;
      const c = ramp(Math.min(1, Math.max(0, (h - 0.25) * 1.9)));
      const tex = (fbm(x / 3, y / 3, 1) - 0.5) * 16;
      c[0] += tex; c[1] += tex; c[2] += tex;
      let f = 0, smoke = 0;
      for (const fr of fires) {
        const dx = x - fr.x, dy = y - fr.y;
        f = Math.max(f, Math.exp(-(dx * dx + dy * dy) / (fr.r * fr.r)));
        // plume: distance along and across the wind direction
        const along = dx * wx + dy * wy, across = -dx * wy + dy * wx;
        if (along > 0) {
          const spread = fr.r * 0.5 + along * 0.28;
          smoke = Math.max(smoke, Math.exp(-(across * across) / (spread * spread)) * Math.exp(-along / (fr.r * 6)));
        }
      }
      f *= 0.55 + 0.9 * fbm(x / 7 + 40, y / 7 + 40, 2);
      if (f > 0.18) mix(c, [18, 13, 10], Math.min(1, (f - 0.18) * 4));
      if (f > 0.42) mix(c, [255, 91, 46], Math.min(1, (f - 0.42) * 5));
      if (f > 0.66) mix(c, [255, 214, 130], Math.min(1, (f - 0.66) * 5));
      mix(c, [190, 184, 172], Math.min(0.6, smoke * (0.35 + 0.9 * fbm(x / 14 + 9, y / 14 + 9, 3))));
      const i = (y * W + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      const ti = Math.floor(y / TH) * COLS + Math.floor(x / TW);
      if (f > tileMax[ti]) tileMax[ti] = f;
    }
  }
  ctx.putImageData(img, 0, 0);
  return Array.from(tileMax, (m) => {
    const p = 1 / (1 + Math.exp(-(m - 0.45) * 11)) + (rand() - 0.5) * 0.04;
    return Math.min(0.99, Math.max(0.01, p));
  });
}

export function mount(root, { reduce }) {
  const body = root.querySelector(".inst-body");
  body.innerHTML = `
    <div class="fire-stage">
      <canvas width="${W}" height="${H}" role="img" aria-label="Synthetic satellite image with wildfires"></canvas>
      <div class="fire-grid mono" aria-hidden="true">${"<span></span>".repeat(COLS * ROWS)}</div>
    </div>
    <div class="inst-controls mono">
      <button type="button" class="ctl ctl-go" data-new>new scene ↻</button>
      <button type="button" class="ctl" data-rescan>rescan</button>
      <span class="ctl-read" data-read aria-live="polite">0 / ${COLS * ROWS} tiles</span>
    </div>`;
  const ctx = body.querySelector("canvas").getContext("2d");
  const tiles = [...body.querySelectorAll(".fire-grid span")];
  const read = body.querySelector("[data-read]");
  let probs = [], idx = 0, timer = 0, visible = false, seeded = false;

  function mark(i) {
    const t = tiles[i], p = probs[i];
    t.textContent = p.toFixed(2);
    t.className = "scanned" + (p >= 0.5 ? " hot" : "");
  }
  function report() {
    const flagged = probs.slice(0, idx).filter((p) => p >= 0.5).length;
    read.textContent = `${idx} / ${tiles.length} tiles · ${flagged} flagged p(fire) ≥ 0.50`;
  }
  function scan() {
    clearInterval(timer);
    tiles.forEach((t) => { t.textContent = ""; t.className = ""; });
    idx = 0;
    if (reduce) { tiles.forEach((_, i) => mark(i)); idx = tiles.length; report(); return; }
    report();
    timer = setInterval(() => {
      if (!visible) return;
      tiles.forEach((t) => t.classList.remove("cursor"));
      if (idx >= tiles.length) { clearInterval(timer); return; }
      mark(idx);
      tiles[idx].classList.add("cursor");
      idx++;
      report();
    }, 75);
  }
  function fresh() {
    probs = scene((Math.random() * 1e9) | 0, ctx);
    scan();
  }

  body.querySelector("[data-new]").addEventListener("click", fresh);
  body.querySelector("[data-rescan]").addEventListener("click", scan);

  return {
    start() { visible = true; if (!seeded) { seeded = true; fresh(); } },
    stop() { visible = false; },
  };
}

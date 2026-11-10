// Hero: the name resolves out of noise, one denoising step at a time.
// Each dot is a sampled pixel of the rendered text; step t moves it from a
// random position (t = T) to its place in the name (t = 0).
const T = 40;
const FONT = '"Instrument Serif", "Times New Roman", serif';

function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function mount(root, { reduce }) {
  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const scrub = root.querySelector("[data-scrub]");
  const out = root.querySelector("[data-step]");
  const again = root.querySelector("[data-resample]");
  const cs = getComputedStyle(document.documentElement);
  const BONE = cs.getPropertyValue("--bone").trim() || "#ece5d6";
  const SIGNAL = cs.getPropertyValue("--signal").trim() || "#ff5b2e";

  let pts = [], W = 0, H = 0, dpr = 1, cell = 4;
  let t = T, playing = false, lastStep = 0, raf = 0, visible = false, ready = false, played = false;
  const pointer = { x: -9999, y: -9999 };

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.floor(canvas.clientWidth);
    if (!W) return;
    const lines = W < 620 ? ["Naman", "Nanda"] : ["Naman Nanda"];
    const off = document.createElement("canvas");
    const o = off.getContext("2d", { willReadFrequently: true });
    o.font = `200px ${FONT}`;
    const widest = Math.max(...lines.map((l) => o.measureText(l).width));
    const fs = Math.min(200 * (W * 0.985) / widest, 340);
    const lh = fs * 0.9;
    H = Math.ceil(lh * lines.length + fs * 0.2);
    canvas.style.height = H + "px";
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    off.width = W;
    off.height = H;
    o.font = `${fs}px ${FONT}`;
    o.fillStyle = "#fff";
    lines.forEach((l, i) => o.fillText(l, 0, fs * 0.8 + i * lh));
    cell = W < 620 ? 3 : Math.max(3, Math.round(W / 320));
    const data = o.getImageData(0, 0, W, H).data;
    pts = [];
    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        if (data[(y * W + x) * 4 + 3] > 110) {
          pts.push({ x0: x, y0: y, nx: Math.random() * W, ny: Math.random() * H, x: 0, y: 0, tx: 0, ty: 0, hot: Math.random() < 0.05 });
        }
      }
    }
    setStep(t, true);
  }

  function setStep(step, snap) {
    t = Math.max(0, Math.min(T, step));
    const s = t / T;
    const mix = Math.pow(s, 1.15);
    const jit = s * 7;
    for (const p of pts) {
      p.tx = p.x0 + (p.nx - p.x0) * mix + gauss() * jit;
      p.ty = p.y0 + (p.ny - p.y0) * mix + gauss() * jit;
      if (snap) { p.x = p.tx; p.y = p.ty; }
    }
    scrub.value = T - t;
    out.textContent = "t = " + String(t).padStart(2, "0");
    root.classList.toggle("is-clean", t === 0);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sz = Math.max(1, (cell - 1) * dpr);
    const R = 90, R2 = R * R;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? SIGNAL : BONE;
      for (const p of pts) {
        if (p.hot !== !!pass) continue;
        let tx = p.tx, ty = p.ty;
        const dx = p.x - pointer.x, dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2), f = (1 - d / R) * 46;
          tx += (dx / d) * f;
          ty += (dy / d) * f;
        }
        p.x += (tx - p.x) * 0.22;
        p.y += (ty - p.y) * 0.22;
        ctx.fillRect(p.x * dpr, p.y * dpr, sz, sz);
      }
    }
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    if (playing && now - lastStep > 55) {
      lastStep = now;
      setStep(t - 1);
      if (t === 0) playing = false;
    }
    draw();
    raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible && !reduce) raf = requestAnimationFrame(frame); };

  function resample() {
    for (const p of pts) { p.nx = Math.random() * W; p.ny = Math.random() * H; }
    if (reduce) { setStep(0, true); draw(); return; }
    setStep(T, true);
    playing = true;
    lastStep = performance.now() + 250;
    kick();
  }

  scrub.addEventListener("input", () => {
    playing = false;
    setStep(T - Number(scrub.value), reduce);
    if (reduce) draw();
  });
  again.addEventListener("click", resample);
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  });
  canvas.addEventListener("pointerleave", () => { pointer.x = pointer.y = -9999; });

  let rz = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => { if (ready && Math.floor(canvas.clientWidth) !== W) { build(); if (reduce) draw(); } }, 150);
  });

  function begin() {
    if (!ready || !visible || played) return;
    played = true;
    resample();
  }

  const fontReady = document.fonts && document.fonts.load ? document.fonts.load(`100px ${FONT}`, "Naman Nanda").catch(() => {}) : Promise.resolve();
  Promise.race([fontReady, new Promise((r) => setTimeout(r, 2500))]).then(() => {
    root.classList.add("is-live");
    t = reduce ? 0 : T;
    build();
    if (!pts.length) { root.classList.remove("is-live"); return; }
    ready = true;
    if (reduce) draw();
    begin();
  });

  return {
    start() { visible = true; begin(); kick(); },
    stop() { visible = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } },
  };
}

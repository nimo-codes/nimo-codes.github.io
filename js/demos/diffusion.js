// fig. 03: a toy reverse-diffusion sampler on a 96×96 canvas.
// x_t = sqrt(ᾱ_t)·x_0 + sqrt(1−ᾱ_t)·ε with a cosine schedule. The "model" is a
// procedural drawing of the product; LoRA off swaps in a blurry, generic target.
const N = 96, T = 30;

function rr(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
}

const SCENES = {
  bottle(c, d) {
    c.fillStyle = d ? "#9fc4b4" : "#8f9a94"; rr(c, 31, 42, 34, 40, 5); c.fill();
    c.fillStyle = d ? "#c9dfd4" : "#9aa39e"; c.fillRect(43, 32, 10, 11);
    c.fillStyle = d ? "#e9c46a" : "#a79f8c"; rr(c, 40, 21, 16, 12, 2); c.fill();
    if (d) {
      c.fillStyle = "#f4efe4"; c.fillRect(36, 54, 24, 15);
      c.fillStyle = "#ff5b2e"; c.fillRect(39, 58, 18, 2); c.fillStyle = "#3a352d"; c.fillRect(39, 63, 12, 1.5);
      c.fillStyle = "rgba(255,255,255,.55)"; c.fillRect(34, 45, 2.5, 33);
    }
  },
  mug(c, d) {
    c.strokeStyle = d ? "#ff5b2e" : "#a8725e"; c.lineWidth = 5;
    c.beginPath(); c.arc(64, 58, 10, -1.2, 1.2); c.stroke();
    c.fillStyle = d ? "#ff5b2e" : "#a8725e"; rr(c, 28, 38, 36, 42, 5); c.fill();
    c.fillStyle = d ? "#2a1a14" : "#7a5a4c"; c.beginPath(); c.ellipse(46, 40, 16, 3.5, 0, 0, 7); c.fill();
    if (d) {
      c.fillStyle = "rgba(255,255,255,.5)"; c.fillRect(32, 46, 3, 28);
      c.strokeStyle = "rgba(236,229,214,.7)"; c.lineWidth = 1.5;
      for (const x of [40, 47, 54]) { c.beginPath(); c.moveTo(x, 33); c.bezierCurveTo(x - 4, 28, x + 4, 23, x, 17); c.stroke(); }
    }
  },
  lamp(c, d) {
    if (d) {
      const g = c.createRadialGradient(62, 46, 2, 62, 60, 34);
      g.addColorStop(0, "rgba(255,214,140,.75)"); g.addColorStop(1, "rgba(255,214,140,0)");
      c.fillStyle = g; c.fillRect(20, 30, 76, 54);
    }
    c.strokeStyle = d ? "#ece5d6" : "#9a958a"; c.lineWidth = 3; c.lineCap = "round";
    c.beginPath(); c.moveTo(36, 80); c.lineTo(36, 44); c.lineTo(54, 28); c.stroke();
    c.fillStyle = d ? "#ece5d6" : "#9a958a"; c.beginPath(); c.ellipse(36, 81, 15, 3.5, 0, 0, 7); c.fill();
    c.fillStyle = d ? "#ff5b2e" : "#a07a6c"; c.beginPath(); c.moveTo(50, 24); c.lineTo(66, 22); c.lineTo(76, 42); c.lineTo(50, 44); c.closePath(); c.fill();
    if (d) { c.fillStyle = "#ffe6a8"; c.beginPath(); c.ellipse(63, 43, 12, 2.5, -0.06, 0, 7); c.fill(); }
  },
  headphones(c, d) {
    c.strokeStyle = d ? "#ece5d6" : "#9a958a"; c.lineWidth = 5; c.lineCap = "round";
    c.beginPath(); c.arc(48, 52, 24, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
    c.fillStyle = d ? "#ff5b2e" : "#a07a6c"; rr(c, 16, 48, 14, 28, 6); c.fill(); rr(c, 66, 48, 14, 28, 6); c.fill();
    if (d) {
      c.fillStyle = "#2a1a14"; rr(c, 27, 52, 5, 20, 2); c.fill(); rr(c, 64, 52, 5, 20, 2); c.fill();
      c.fillStyle = "rgba(255,255,255,.5)"; c.fillRect(19, 52, 2, 18);
      c.strokeStyle = "#8fb8a8"; c.lineWidth = 1.5; c.beginPath(); c.arc(48, 52, 21, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    }
  },
};
const PROMPTS = { bottle: "perfume bottle", mug: "ceramic mug", lamp: "desk lamp", headphones: "headphones" };

function target(kind, lora) {
  const full = document.createElement("canvas");
  full.width = full.height = N;
  const f = full.getContext("2d", { willReadFrequently: true });
  const paint = (c, d) => {
    const bg = c.createLinearGradient(0, 0, 0, N);
    bg.addColorStop(0, d ? "#221e19" : "#2a2824"); bg.addColorStop(0.84, d ? "#2e2822" : "#302d29");
    bg.addColorStop(0.85, d ? "#3b332b" : "#35322d"); bg.addColorStop(1, d ? "#2a241e" : "#2d2a26");
    c.fillStyle = bg; c.fillRect(0, 0, N, N);
    if (d) { c.fillStyle = "rgba(0,0,0,.35)"; c.beginPath(); c.ellipse(48, 82, 24, 3, 0, 0, 7); c.fill(); }
    SCENES[kind](c, d);
  };
  if (lora) paint(f, true);
  else {
    // the base model has never seen this product: low-detail, low-resolution guess
    const S = 22, small = document.createElement("canvas");
    small.width = small.height = S;
    const s = small.getContext("2d");
    s.scale(S / N, S / N);
    paint(s, false);
    f.imageSmoothingEnabled = true;
    f.drawImage(small, 0, 0, N, N);
  }
  const px = f.getImageData(0, 0, N, N).data, x0 = new Float32Array(N * N * 3);
  for (let i = 0, j = 0; i < px.length; i += 4) { x0[j++] = px[i] / 127.5 - 1; x0[j++] = px[i + 1] / 127.5 - 1; x0[j++] = px[i + 2] / 127.5 - 1; }
  return x0;
}

export function mount(root, { reduce }) {
  const body = root.querySelector(".inst-body");
  body.innerHTML = `
    <div class="diff-wrap">
      <canvas class="diff-canvas" width="${N}" height="${N}" role="img" aria-label="Image being denoised"></canvas>
      <div class="diff-side mono">
        <p class="diff-prompt"><span class="dim">prompt</span><br />“a product photo of a <b data-tok></b> <span data-obj></span>”</p>
        <div class="chips-row" data-prompts>${Object.keys(PROMPTS).map((k) => `<button type="button" class="ctl" data-kind="${k}">${PROMPTS[k]}</button>`).join("")}</div>
        <button type="button" class="ctl switch" data-lora aria-pressed="true"><i></i>LoRA adapter · <span data-lora-txt>on</span></button>
        <label class="diff-step"><span data-step>step 00 / ${T}</span><input type="range" min="0" max="${T}" value="0" step="1" data-scrub aria-label="Denoising step" /></label>
        <button type="button" class="ctl ctl-go" data-play>sample ▸</button>
      </div>
    </div>`;
  const canvas = body.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(N, N);
  const scrub = body.querySelector("[data-scrub]");
  const stepOut = body.querySelector("[data-step]");
  const loraBtn = body.querySelector("[data-lora]");
  const kinds = body.querySelectorAll("[data-kind]");

  const eps = new Float32Array(N * N * 3);
  let kind = "bottle", lora = true, x0 = null, step = 0, timer = 0, autoplayed = false, visible = false;

  function reseed() {
    for (let i = 0; i < eps.length; i += 2) {
      const u = Math.random() || 1e-9, v = Math.random();
      const r = Math.sqrt(-2 * Math.log(u));
      eps[i] = r * Math.cos(6.2832 * v);
      if (i + 1 < eps.length) eps[i + 1] = r * Math.sin(6.2832 * v);
    }
  }

  function draw() {
    const t = T - step; // noise level remaining
    const ab = Math.pow(Math.cos((t / T) * Math.PI / 2), 2);
    const a = Math.sqrt(ab), b = Math.sqrt(1 - ab) * 0.85;
    const d = img.data;
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) {
      d[i] = (a * x0[j] + b * eps[j]) * 127.5 + 127.5;
      d[i + 1] = (a * x0[j + 1] + b * eps[j + 1]) * 127.5 + 127.5;
      d[i + 2] = (a * x0[j + 2] + b * eps[j + 2]) * 127.5 + 127.5;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    scrub.value = step;
    stepOut.textContent = `step ${String(step).padStart(2, "0")} / ${T}`;
  }

  function refresh() {
    x0 = target(kind, lora);
    kinds.forEach((b) => b.setAttribute("aria-pressed", b.dataset.kind === kind));
    loraBtn.setAttribute("aria-pressed", lora);
    body.querySelector("[data-lora-txt]").textContent = lora ? "on" : "off";
    body.querySelector("[data-tok]").textContent = lora ? "sks" : "";
    body.querySelector("[data-obj]").textContent = PROMPTS[kind];
  }

  function play() {
    clearInterval(timer);
    reseed();
    if (reduce) { step = T; draw(); return; }
    step = 0;
    draw();
    timer = setInterval(() => {
      if (!visible) return;
      step++;
      draw();
      if (step >= T) clearInterval(timer);
    }, 85);
  }

  kinds.forEach((b) => b.addEventListener("click", () => { kind = b.dataset.kind; refresh(); play(); }));
  loraBtn.addEventListener("click", () => { lora = !lora; refresh(); play(); });
  body.querySelector("[data-play]").addEventListener("click", play);
  scrub.addEventListener("input", () => { clearInterval(timer); step = Number(scrub.value); draw(); });

  reseed();
  refresh();
  step = reduce ? T : 0;
  draw();

  return {
    start() { visible = true; if (!autoplayed) { autoplayed = true; play(); } },
    stop() { visible = false; },
  };
}

// fig. 02: per-token surprisal before and after domain fine-tuning.
// The token values are illustrative. The fine-tuned values are scaled so that
// sentence perplexity drops by exactly the measured 26%.
const IMPROVEMENT = 0.26;
// [token, base surprisal in nats, how much of the gain lands on this token]
const TOKENS = [
  ["The", 0.9, 0], ["redshift", 5.2, 1], ["of", 0.6, 0], ["the", 0.8, 0.05], ["quasar", 4.6, 0.9], ["implies", 2.9, 0.2],
  ["a", 0.7, 0], ["recession", 5.0, 1], ["velocity", 2.4, 0.5], ["of", 0.5, 0], ["0.3", 3.6, 0.3], ["c", 3.1, 0.6],
];
const MAX = 5.6;

export function mount(root, { reduce }) {
  const body = root.querySelector(".inst-body");
  const n = TOKENS.length;
  const totalGain = -Math.log(1 - IMPROVEMENT) * n;
  const wSum = TOKENS.reduce((s, t) => s + t[2], 0);
  const base = TOKENS.map((t) => t[1]);
  const tuned = TOKENS.map((t) => t[1] - (t[2] / wSum) * totalGain);
  const ppl = (a) => Math.exp(a.reduce((s, v) => s + v, 0) / n);
  const P = { base: ppl(base), tuned: ppl(tuned) };

  body.innerHTML = `
    <div class="ppl-top">
      <div class="seg mono" role="tablist" aria-label="Model">
        <button type="button" role="tab" data-mode="base" aria-selected="true">base LLaMA</button>
        <button type="button" role="tab" data-mode="tuned" aria-selected="false">QLoRA fine-tuned</button>
      </div>
      <div class="ppl-read">
        <span class="mono dim small">perplexity</span>
        <span class="ppl-num" data-ppl>${P.base.toFixed(2)}</span>
        <span class="ppl-delta mono" data-delta></span>
      </div>
    </div>
    <div class="ppl-stage">
      <svg class="ppl-arcs" aria-hidden="true"></svg>
      <div class="ppl-tokens"></div>
    </div>
    <p class="inst-foot mono">bar height = surprisal, −log p(token | context). outline = base model. lower is better.</p>`;
  const stage = body.querySelector(".ppl-stage");
  const row = body.querySelector(".ppl-tokens");
  const arcs = body.querySelector(".ppl-arcs");
  const num = body.querySelector("[data-ppl]");
  const delta = body.querySelector("[data-delta]");
  const tabs = body.querySelectorAll("[data-mode]");

  const cols = TOKENS.map(([tok, b], i) => {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "tok" + (TOKENS[i][2] >= 0.3 ? " domain" : "");
    c.innerHTML = `<span class="tok-val mono"></span><span class="tok-bar"><i class="ghost"></i><i class="fill"></i></span><span class="tok-chip mono"></span>`;
    c.querySelector(".tok-chip").textContent = tok;
    c.querySelector(".ghost").style.height = (b / MAX) * 100 + "%";
    c.setAttribute("aria-label", `token ${tok}`);
    c.style.flex = `${Math.max(3, tok.length)} 1 ${tok.length * 7 + 14}px`;
    const on = () => setActive(i);
    c.addEventListener("pointerenter", on);
    c.addEventListener("focus", on);
    c.addEventListener("click", on);
    row.appendChild(c);
    return c;
  });

  let mode = "base", active = 4, shown = P.base, tween = 0, autoplayed = false;

  function attention(i) {
    const w = TOKENS.map((t, j) => {
      if (j === i) return 0;
      const dist = Math.abs(i - j);
      return mode === "base" ? 0.2 + 0.8 / dist : (t[2] >= 0.3 ? 1 : 0.1) / (1 + 0.18 * dist);
    });
    const m = Math.max(...w);
    return w.map((v) => v / m);
  }

  function drawArcs() {
    const sr = stage.getBoundingClientRect();
    arcs.setAttribute("viewBox", `0 0 ${sr.width} ${sr.height}`);
    const pos = cols.map((c) => {
      const r = c.querySelector(".tok-chip").getBoundingClientRect();
      return [r.left + r.width / 2 - sr.left, r.bottom - sr.top + 3];
    });
    const w = attention(active);
    const [x1, y1] = pos[active];
    let html = "";
    w.forEach((v, j) => {
      cols[j].style.setProperty("--att", v < 0.16 ? 0 : v.toFixed(2));
      if (v < 0.16) return;
      const [x2, y2] = pos[j];
      if (Math.abs(y2 - y1) > 4) return; // wrapped onto another row: the chip underline carries the weight
      const sag = Math.min(64, 14 + Math.abs(x2 - x1) * 0.22);
      html += `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} Q${((x1 + x2) / 2).toFixed(1)},${(Math.max(y1, y2) + sag).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" style="opacity:${(0.15 + v * 0.85).toFixed(2)};stroke-width:${(0.6 + v * 2.4).toFixed(2)}"/>`;
    });
    arcs.innerHTML = html;
    cols.forEach((c, j) => c.classList.toggle("active", j === active));
  }

  function setActive(i) { active = i; drawArcs(); }

  function setMode(m) {
    mode = m;
    const vals = m === "base" ? base : tuned;
    cols.forEach((c, i) => {
      c.querySelector(".fill").style.height = (vals[i] / MAX) * 100 + "%";
      c.querySelector(".tok-val").textContent = vals[i].toFixed(1);
    });
    tabs.forEach((b) => b.setAttribute("aria-selected", b.dataset.mode === m));
    body.dataset.mode = m;
    delta.textContent = m === "tuned" ? `−${Math.round(IMPROVEMENT * 100)}% vs base` : "";
    const from = shown, to = P[m], start = performance.now();
    cancelAnimationFrame(tween);
    if (reduce) { shown = to; num.textContent = to.toFixed(2); }
    else (function step(now) {
      const k = Math.min(1, (now - start) / 600), e = 1 - Math.pow(1 - k, 3);
      shown = from + (to - from) * e;
      num.textContent = shown.toFixed(2);
      if (k < 1) tween = requestAnimationFrame(step);
    })(start);
    drawArcs();
  }

  tabs.forEach((b) => b.addEventListener("click", () => { autoplayed = true; setMode(b.dataset.mode); }));
  window.addEventListener("resize", drawArcs);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawArcs);
  setMode("base");

  return {
    start() {
      drawArcs();
      if (autoplayed) return;
      autoplayed = true;
      setTimeout(() => { if (mode === "base") setMode("tuned"); }, reduce ? 0 : 1400);
    },
    stop() {},
  };
}

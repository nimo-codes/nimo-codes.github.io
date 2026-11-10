// fig. 01: a simulated event-driven KYC run. Nodes light up as workers pick up
// messages; "inject failure" crashes one worker and the run resumes from its checkpoint.
const NS = "http://www.w3.org/2000/svg";

const LAYOUTS = {
  wide: {
    box: [750, 270],
    dir: "h",
    nodes: {
      ingest: [43, 135, 78, "ingest"],
      ocr: [140, 135, 64, "ocr"],
      evidence: [241, 135, 86, "evidence"],
      screen: [400, 48, 140, "screening hits"],
      media: [400, 135, 140, "adverse media"],
      entity: [400, 222, 140, "entity resolution"],
      risk: [579, 135, 126, "risk assessment"],
      report: [707, 135, 78, "report"],
    },
  },
  tall: {
    box: [340, 440],
    dir: "v",
    nodes: {
      ingest: [170, 30, 130, "ingest"],
      ocr: [170, 100, 130, "ocr"],
      evidence: [170, 170, 130, "evidence"],
      screen: [58, 260, 104, "screening"],
      media: [170, 260, 104, "adverse media"],
      entity: [282, 260, 104, "entity res."],
      risk: [170, 345, 150, "risk assessment"],
      report: [170, 412, 130, "report"],
    },
  },
};
const EDGES = [["ingest", "ocr"], ["ocr", "evidence"], ["evidence", "screen"], ["evidence", "media"], ["evidence", "entity"], ["screen", "risk"], ["media", "risk"], ["entity", "risk"], ["risk", "report"]];
const NH = 40;

function el(name, attrs = {}, text) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}

export function mount(root, { reduce }) {
  const body = root.querySelector(".inst-body");
  body.innerHTML = `
    <div class="pipe-graph"></div>
    <div class="inst-controls mono">
      <button type="button" class="ctl ctl-go" data-run>run case ▸</button>
      <button type="button" class="ctl" data-fail aria-pressed="false">inject failure</button>
      <span class="ctl-read" data-status>idle</span>
    </div>
    <ol class="pipe-log mono" aria-live="polite"></ol>`;
  const graph = body.querySelector(".pipe-graph");
  const logEl = body.querySelector(".pipe-log");
  const runBtn = body.querySelector("[data-run]");
  const failBtn = body.querySelector("[data-fail]");
  const status = body.querySelector("[data-status]");

  let layoutName = "", nodeEls = {}, edgeEls = {};
  const state = {}, edgeState = {};
  let busy = false, armed = false, t0 = 0, autoplayed = false;

  function render() {
    const name = graph.clientWidth < 560 ? "tall" : "wide";
    if (name === layoutName) return;
    layoutName = name;
    const L = LAYOUTS[name];
    const svg = el("svg", { viewBox: `0 0 ${L.box[0]} ${L.box[1]}`, role: "img", "aria-label": "KYC pipeline: ingest, OCR, evidence, then screening, adverse media and entity resolution in parallel, then risk assessment and report" });
    svg.style.maxWidth = name === "tall" ? "400px" : "none";
    nodeEls = {}; edgeEls = {};
    for (const [a, b] of EDGES) {
      const [ax, ay, aw] = L.nodes[a], [bx, by, bw] = L.nodes[b];
      let d;
      if (L.dir === "h") {
        const x1 = ax + aw / 2, x2 = bx - bw / 2, m = (x1 + x2) / 2;
        d = `M${x1},${ay} C${m},${ay} ${m},${by} ${x2},${by}`;
      } else {
        const y1 = ay + NH / 2, y2 = by - NH / 2, m = (y1 + y2) / 2;
        d = `M${ax},${y1} C${ax},${m} ${bx},${m} ${bx},${y2}`;
      }
      svg.appendChild(el("path", { d, class: "pe" }));
      const flow = el("path", { d, class: "pe-flow", pathLength: 1 });
      flow.dataset.state = edgeState[a + b] || "idle";
      svg.appendChild(flow);
      edgeEls[a + b] = flow;
    }
    for (const id in L.nodes) {
      const [x, y, w, label] = L.nodes[id];
      const g = el("g", { class: "pn", transform: `translate(${x - w / 2},${y - NH / 2})` });
      g.dataset.state = state[id] || "idle";
      g.appendChild(el("rect", { width: w, height: NH, rx: 6 }));
      g.appendChild(el("text", { x: w / 2, y: NH / 2 + 4, "text-anchor": "middle" }, label));
      g.appendChild(el("circle", { cx: w - 9, cy: 9, r: 3 }));
      svg.appendChild(g);
      nodeEls[id] = g;
    }
    graph.replaceChildren(svg);
  }

  const setNode = (id, s) => { state[id] = s; if (nodeEls[id]) nodeEls[id].dataset.state = s; };
  const setEdge = (a, b, s) => { edgeState[a + b] = s; if (edgeEls[a + b]) edgeEls[a + b].dataset.state = s; };
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

  function log(msg, cls) {
    const li = document.createElement("li");
    if (cls) li.className = cls;
    const secs = ((performance.now() - t0) / 1000).toFixed(2).padStart(5, "0");
    li.innerHTML = `<time>${secs}</time><span></span>`;
    li.lastChild.textContent = msg;
    logEl.appendChild(li);
    logEl.scrollTop = logEl.scrollHeight;
  }

  async function work(id, ms, msg, from) {
    if (from) { for (const f of [].concat(from)) setEdge(f, id, "flow"); await wait(380); }
    setNode(id, "run");
    await wait(ms);
    setNode(id, "done");
    if (from) for (const f of [].concat(from)) setEdge(f, id, "done");
    log(msg);
  }

  async function mediaBranch(fail) {
    setEdge("evidence", "media", "flow");
    await wait(380);
    setNode("media", "run");
    if (fail) {
      await wait(650);
      setNode("media", "fail");
      log("adverse-media worker crashed · message abandoned", "err");
      status.textContent = "worker down";
      await wait(1100);
      log("service bus redelivers · resuming from checkpoint ckpt_03", "warn");
      status.textContent = "recovering";
      setNode("media", "run");
      await wait(900);
      setNode("media", "done");
      setEdge("evidence", "media", "done");
      log("adverse media · 0 relevant articles · recovered, nothing re-run upstream", "ok");
      status.textContent = "running";
      return;
    }
    await wait(1150);
    setNode("media", "done");
    setEdge("evidence", "media", "done");
    log("adverse media · 0 relevant articles · sources cited");
  }

  async function run() {
    if (busy) return;
    busy = true;
    runBtn.disabled = true;
    const fail = armed;
    for (const id in LAYOUTS.wide.nodes) setNode(id, "idle");
    for (const [a, b] of EDGES) setEdge(a, b, "idle");
    logEl.replaceChildren();
    t0 = performance.now();
    status.textContent = "running";
    log("case received · synthetic customer file");
    await work("ingest", 450, "ingest · 4 documents → blob storage");
    await work("ocr", 700, "ocr · fields extracted · json schema valid", "ingest");
    await work("evidence", 600, "evidence indexed · checkpoint ckpt_03 → cosmos db", "ocr");
    log("fan-out · 3 messages → service bus");
    await Promise.all([
      work("screen", 850, "screening · 2 hits · both dismissed with evidence", "evidence"),
      mediaBranch(fail),
      work("entity", 650, "entity resolution · 1 entity matched", "evidence"),
    ]);
    await work("risk", 800, "risk assessment · structured output · evidence grounded", ["screen", "media", "entity"]);
    await work("report", 500, "report.docx · findings.xlsx · audit trail written", "risk");
    log(`done in ${((performance.now() - t0) / 1000).toFixed(1)}s` + (fail ? " · 1 failure survived" : ""), "ok");
    status.textContent = fail ? "done · recovered" : "done";
    if (fail) { armed = false; failBtn.setAttribute("aria-pressed", "false"); }
    busy = false;
    runBtn.disabled = false;
  }

  runBtn.addEventListener("click", run);
  failBtn.addEventListener("click", () => {
    armed = !armed;
    failBtn.setAttribute("aria-pressed", armed);
    if (!busy) status.textContent = armed ? "failure armed · press run" : "idle";
  });
  window.addEventListener("resize", render);
  render();

  return {
    start() { render(); if (!autoplayed) { autoplayed = true; run(); } },
    stop() {},
  };
}

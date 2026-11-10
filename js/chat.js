// naman-7b. Two engines, both fully in the browser (no API key, no backend):
//  1. scripted (default): keyword routing over fixed, resume-grounded answers.
//  2. real LLM (opt-in): a small open model run on the visitor's GPU via WebLLM,
//     grounded on the same answers. See js/llm.js.
(function () {
  const log = document.getElementById("chatLog");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const chipsEl = document.getElementById("chips");
  const stats = document.getElementById("tokStats");
  const loadBtn = document.getElementById("loadLLM");
  const engineNote = document.getElementById("engineNote");
  const progress = document.getElementById("llmProgress");
  if (!log || !form) return;

  // Each intent: keywords to match, and the answer. [text](url) becomes a link.
  const KB = [
    {
      id: "intro", chip: "who are you?",
      keys: ["who", "about", "yourself", "naman", "intro", "hello", "hi", "hey", "summary"],
      a: "Hi! I'm Naman, an AI Engineer at MUFG in Bangalore. I work on both sides of AI: research (fine-tuning LLMs at ANU, diffusion models at Samsung R&D) and engineering (production agentic GenAI systems for KYC at MUFG). B.Tech CSE with AI/ML from SRM, 9.25 CGPA.",
    },
    {
      id: "research", chip: "your research?",
      keys: ["research", "paper", "publication", "anu", "astrollama", "perplexity", "qlora", "samsung", "diffusion", "dreambooth", "vidas", "icvgip", "australia"],
      a: "Three research threads:\n\n1. ANU (2025): fine-tuned AstroLLaMA on scientific literature with QLoRA + PEFT for a 26% perplexity improvement on 385K tokens.\n2. Samsung R&D (2024): fine-tuned Stable Diffusion and DreamBooth GANs with LoRA under tight GPU memory, and added LLaMA prompt generation to the pipeline. That work earned a Certificate of Excellence.\n3. Co-authored \"ViDAS: Vision-based Danger Assessment and Scoring\" at ICVGIP 2024.",
    },
    {
      id: "mufg", chip: "what do you do at MUFG?",
      keys: ["mufg", "work", "job", "current", "kyc", "bank", "engineer", "langgraph", "azure", "now", "role"],
      a: "At MUFG I architect an AI-driven KYC platform: document ingestion → OCR → evidence processing → GenAI risk assessment → automated DOCX/XLSX reports.\n\nIt runs as an event-driven system on LangGraph, Azure Service Bus and worker microservices, with checkpointing and fault recovery on Cosmos DB + Blob Storage. The LLM side uses structured outputs, JSON-schema validation, evidence grounding, versioned prompts and audit trails. I joined as an intern in Nov 2025 and went full-time in July 2026.",
    },
    {
      id: "projects", chip: "show me projects",
      keys: ["project", "projects", "built", "firewatch", "fire", "wildfire", "formulary", "medicare", "demo", "portfolio", "codefest"],
      a: "Two favourites:\n\n🔥 FireWatch: wildfire detection on NASA satellite imagery with a fine-tuned VGG-19, 97%+ accuracy on 42K images, with real-time MLOps. Try it: [firewatch-hosted.vercel.app](https://firewatch-hosted.vercel.app)\n\n💊 Formulary Lens: Mistral-7B + few-shot prompting for Medicare Part D formulary insights. It won CodeFest 2025. Try it: [formulary lens demo](https://v0-ai-us-formulary-ey5461.vercel.app)",
    },
    {
      id: "skills", chip: "tech stack?",
      keys: ["skill", "skills", "stack", "tech", "tools", "language", "python", "pytorch", "know", "framework"],
      a: "My weights, roughly:\n\n• AI/ML: PyTorch, TensorFlow, Hugging Face, LoRA/QLoRA, RAG, LLMs, prompt engineering\n• Agentic: LangGraph, LangChain, multi-agent workflows\n• Cloud/backend: Azure (Document Intelligence, Service Bus, Cosmos DB), GCP, Flask, REST\n• Languages: Python, C/C++, SQL",
    },
    {
      id: "awards", chip: "any awards?",
      keys: ["award", "awards", "achievement", "win", "won", "frt", "scholar", "honor", "excellence"],
      a: "• Top 20 nationally for the fully funded Future Research Talent program at ANU, Australia\n• Winner, CodeFest 2025 (Formulary Lens)\n• Certificate of Excellence for the Samsung R&D research\n• Publication at ICVGIP 2024",
    },
    {
      id: "contact", chip: "how to reach you?",
      keys: ["contact", "email", "reach", "hire", "phone", "linkedin", "github", "connect", "call", "cv", "resume"],
      a: "Happy to talk!\n\n✉ [namannanda5657@gmail.com](mailto:namannanda5657@gmail.com)\n☎ [+91 81157 00008](tel:+918115700008)\n in [linkedin.com/in/namannanda3](https://linkedin.com/in/namannanda3)\n ⌥ [github.com/nimo-codes](https://github.com/nimo-codes)\n\nOr grab the [full CV](assets/NamanNanda_Resume.pdf).",
    },
    {
      id: "education", chip: null,
      keys: ["education", "college", "university", "srm", "degree", "study", "cgpa", "gpa", "graduate"],
      a: "B.Tech in Computer Science with a specialization in AI/ML from SRM Institute of Science and Technology, graduating May 2026 with a 9.25 CGPA.",
    },
    {
      id: "model", chip: null,
      keys: ["real ai", "are you real", "are you an ai", "a real", "bot", "gpt", "how do you work", "chatgpt", "claude"],
      a: "Full transparency: by default I'm a tiny scripted model, just keyword routing over Naman's resume with token streaming for effect. Press \"Load real weights\" above and I become an actual LLM running on your GPU through WebGPU, with no server involved. The real Naman builds the serious ones. 😉",
    },
  ];

  const FALLBACK = "Hmm, that's outside my training distribution. I know about Naman's research, his work at MUFG, his projects, skills, awards and how to contact him. Try one of the prompts below!";

  function route(q) {
    const s = q.toLowerCase();
    let best = null, bestScore = 0;
    for (const item of KB) {
      let score = 0;
      for (const k of item.keys) {
        // short keys must match a whole word ("hi" should not match "this")
        const hit = k.length <= 3 ? new RegExp("\\b" + k + "\\b").test(s) : s.includes(k);
        if (hit) score += k.length > 4 ? 2 : 1;
      }
      if (score > bestScore) { bestScore = score; best = item; }
    }
    return best;
  }

  function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function linkify(s) {
    return esc(s).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const ext = /^https?:/.test(u);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
    });
  }
  // plain text shown while streaming (link markup hidden)
  function plain(s) { return s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1"); }

  function addMsg(cls, who, html) {
    const el = document.createElement("div");
    el.className = "msg " + cls;
    el.innerHTML = (who ? `<span class="who">${who}</span>` : "") + `<span class="txt">${html}</span>`;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el.querySelector(".txt");
  }

  let busy = false;
  const used = new Set();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setBusy(b) {
    busy = b;
    chipsEl.querySelectorAll(".chip").forEach((c) => (c.disabled = b));
    form.querySelector("button").disabled = b;
  }

  function stream(target, full, done) {
    const text = plain(full);
    const tokens = text.match(/\S+\s*|\s+/g) || [];
    let i = 0;
    const start = performance.now();
    function step() {
      // emit 1-3 tokens per tick, like a real decoder
      const n = 1 + Math.floor(Math.random() * 3);
      i = Math.min(tokens.length, i + n);
      target.textContent = tokens.slice(0, i).join("");
      target.insertAdjacentHTML("beforeend", '<span class="caret">▌</span>');
      log.scrollTop = log.scrollHeight;
      const secs = (performance.now() - start) / 1000;
      stats.textContent = `${i} tokens · ${(i / Math.max(secs, 0.01)).toFixed(0)} tok/s`;
      if (i < tokens.length) setTimeout(step, 28 + Math.random() * 40);
      else { target.innerHTML = linkify(full); stats.textContent = `done · ${tokens.length} tokens`; done(); }
    }
    if (reduce) { target.innerHTML = linkify(full); done(); } else step();
  }

  // ---- real LLM (opt-in) ----
  let llm = null, loading = false;
  const history = [];
  function scripted(target, q) {
    const hit = route(q);
    if (hit) used.add(hit.id);
    setTimeout(() => {
      stream(target, hit ? hit.a : FALLBACK, () => { setBusy(false); renderChips(); });
    }, reduce ? 0 : 500 + Math.random() * 400);
  }

  async function generate(target, q) {
    let text = "", n = 0;
    const start = performance.now();
    try {
      for await (const piece of llm.chat(history.slice(-4), q)) {
        text += piece;
        n++;
        target.textContent = text;
        log.scrollTop = log.scrollHeight;
        stats.textContent = `${n} tokens · ${(n / Math.max((performance.now() - start) / 1000, 0.01)).toFixed(0)} tok/s · on your GPU`;
      }
      if (!text.trim()) throw new Error("empty response");
      history.push({ role: "user", content: q }, { role: "assistant", content: text });
      stats.textContent = `done · ${n} tokens · generated on your device`;
      setBusy(false);
      renderChips();
    } catch (err) {
      console.error(err);
      stats.textContent = "model error · falling back to script";
      scripted(target, q);
    }
  }

  const GREETING = /^\s*(hi|hello|hey|yo|hola|namaste)\b[\s!.]*$/i;

  function ask(q) {
    if (busy || !q.trim()) return;
    setBusy(true);
    addMsg("user", "you ›", esc(q));
    const think = addMsg("bot", "naman-7b ›", '<span class="thinking">thinking</span>');
    stats.textContent = "running forward pass…";
    if (llm && !GREETING.test(q)) generate(think, q); else scripted(think, q);
  }

  if (loadBtn) {
    loadBtn.textContent = "Load real weights · ~900 MB";
    loadBtn.addEventListener("click", async () => {
      if (loading || llm) return;
      loading = true;
      loadBtn.disabled = true;
      try {
        const mod = await import("./llm.js");
        if (!mod.supported()) throw new Error("no-webgpu");
        progress.hidden = false;
        engineNote.textContent = "fetching runtime…";
        await mod.load((p, text) => {
          progress.style.setProperty("--p", p);
          engineNote.textContent = p < 1 ? `downloading weights · ${Math.round(p * 100)}% · you can keep chatting meanwhile` : "compiling shaders…";
        });
        llm = mod;
        progress.hidden = true;
        loadBtn.hidden = true;
        engineNote.textContent = `engine: ${mod.label()} · running on your GPU via WebGPU · nothing leaves this tab`;
        addMsg("sys", "", "real weights loaded. answers are now generated on your device from Naman's resume. it is a small 1.5B-parameter model, so check anything important against the page.");
      } catch (err) {
        if (err.message !== "no-webgpu") console.error(err);
        progress.hidden = true;
        loadBtn.disabled = false;
        engineNote.textContent = err.message === "no-webgpu"
          ? "this browser has no WebGPU, so the real model can't run here. try a recent desktop Chrome or Edge. the scripted engine still works."
          : "couldn't load the model (network or GPU memory). still on the scripted engine.";
      }
      loading = false;
    });
  }

  function renderChips() {
    chipsEl.innerHTML = "";
    KB.filter((k) => k.chip && !used.has(k.id)).forEach((k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = k.chip;
      b.addEventListener("click", () => ask(k.chip));
      chipsEl.appendChild(b);
    });
    if (!chipsEl.children.length) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = "are you a real AI?";
      b.addEventListener("click", () => ask("are you a real AI?"));
      chipsEl.appendChild(b);
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = "";
    ask(q);
  });

  addMsg("sys", "", "naman-7b loaded · engine: scripted · context: resume.pdf");
  addMsg("bot", "naman-7b ›", "Hey 👋 I answer questions about Naman: his research, engineering work and projects. Pick a prompt or type your own.");
  renderChips();
})();

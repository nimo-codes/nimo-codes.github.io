import { mount as hero } from "./demos/hero.js";
import { mount as pipeline } from "./demos/pipeline.js";
import { mount as perplexity } from "./demos/perplexity.js";
import { mount as diffusion } from "./demos/diffusion.js";
import { mount as firewatch } from "./demos/firewatch.js";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.getElementById("year").textContent = new Date().getFullYear();

// Nav: border on scroll + mobile menu
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 30);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();
const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");
function setMenu(open) {
  links.classList.toggle("open", open);
  toggle.classList.toggle("open", open);
  toggle.setAttribute("aria-expanded", open);
}
toggle.addEventListener("click", () => setMenu(!links.classList.contains("open")));
links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

// Recruiter summary: a one-screen overlay. /#recruiter opens it directly, so the link can be shared.
const rec = document.getElementById("recruiter");
if (rec && rec.showModal) {
  const openRec = () => { if (!rec.open) rec.showModal(); rec.scrollTop = 0; };
  document.querySelectorAll("[data-recruiter]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    setMenu(false);
    history.replaceState(null, "", "#recruiter");
    openRec();
  }));
  rec.querySelectorAll("[data-rec-close]").forEach((b) => b.addEventListener("click", () => rec.close()));
  rec.addEventListener("click", (e) => { if (e.target === rec) rec.close(); });
  rec.addEventListener("close", () => { if (location.hash === "#recruiter") history.replaceState(null, "", location.pathname + location.search); });
  if (location.hash === "#recruiter") openRec();
}

// Count-up numbers
function countUp(el) {
  const end = parseFloat(el.dataset.count);
  const dec = parseInt(el.dataset.decimals || "0", 10);
  const pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
  if (reduce) return;
  const start = performance.now(), dur = 1400;
  (function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const v = end * (1 - Math.pow(1 - t, 3));
    el.textContent = pre + v.toFixed(dec) + suf;
    if (t < 1) requestAnimationFrame(step);
  })(start);
}

// Scroll reveals
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    e.target.querySelectorAll("[data-count]").forEach(countUp);
    io.unobserve(e.target);
  });
}, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
const observeReveal = (el) => io.observe(el);

// Skills as a weight matrix
const skills = {
  "AI / ML": [["PyTorch", 0.95], ["Hugging Face", 0.95], ["LLMs", 0.98], ["LoRA / QLoRA", 0.92], ["RAG", 0.88], ["Prompt Eng.", 0.9], ["TensorFlow", 0.8], ["Scikit-learn", 0.8]],
  "Agentic AI": [["LangGraph", 0.95], ["LangChain", 0.88], ["Multi-Agent", 0.9], ["AI Agents", 0.92]],
  "Generative": [["Stable Diffusion", 0.85], ["DreamBooth", 0.8], ["GANs / cGANs", 0.75], ["PEFT", 0.88]],
  "Cloud / Backend": [["Azure", 0.9], ["Azure Doc Intelligence", 0.85], ["Service Bus", 0.82], ["Cosmos DB", 0.8], ["GCP", 0.72], ["Flask", 0.88], ["REST APIs", 0.9], ["MySQL", 0.75]],
  "Languages": [["Python", 0.98], ["C / C++", 0.72], ["SQL", 0.8]],
  "Tools": [["Git", 0.88], ["Unix", 0.82], ["Pandas", 0.9], ["NumPy", 0.9]],
};
const grid = document.getElementById("skillsGrid");
Object.entries(skills).forEach(([group, items]) => {
  const row = document.createElement("div");
  row.className = "skill-row reveal";
  const head = document.createElement("div");
  head.className = "skill-group mono";
  head.textContent = group;
  const cells = document.createElement("div");
  cells.className = "skill-cells";
  items.forEach(([name, w]) => {
    const c = document.createElement("div");
    c.className = "cell";
    c.style.setProperty("--w", w);
    c.innerHTML = `<span class="cell-name"></span><span class="cell-w mono">${w.toFixed(2)}</span><i></i>`;
    c.firstChild.textContent = name;
    cells.appendChild(c);
  });
  row.append(head, cells);
  grid.appendChild(row);
});

document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = (i % 4) * 60 + "ms";
  observeReveal(el);
});

// Demos: mount each, run only while on screen
const demos = { hero, pipeline, perplexity, diffusion, firewatch };
const demoIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    const d = e.target._demo;
    if (!d) return;
    if (e.isIntersecting) d.start(); else d.stop();
  });
}, { threshold: 0.12 });
document.querySelectorAll("[data-demo]").forEach((el) => {
  try {
    el._demo = demos[el.dataset.demo](el, { reduce });
    demoIO.observe(el);
  } catch (err) {
    console.error("demo failed:", el.dataset.demo, err);
    el.classList.add("demo-failed");
  }
});

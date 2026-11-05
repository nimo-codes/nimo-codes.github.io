(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Year
  document.getElementById("year").textContent = new Date().getFullYear();

  // Nav: background on scroll + mobile menu
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 30);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open);
  });
  links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
    links.classList.remove("open"); toggle.classList.remove("open"); toggle.setAttribute("aria-expanded", "false");
  }));

  // Typed roles in the hero
  const roles = ["AI Engineer @ MUFG", "LLM fine-tuning researcher", "agentic systems builder", "diffusion model tinkerer", "turning research into production"];
  const typed = document.getElementById("typed");
  if (reduce) typed.textContent = roles[0];
  else {
    let r = 0, c = 0, del = false;
    (function tick() {
      const word = roles[r];
      c += del ? -1 : 1;
      typed.textContent = word.slice(0, c);
      let wait = del ? 35 : 70;
      if (!del && c === word.length) { del = true; wait = 1800; }
      else if (del && c === 0) { del = false; r = (r + 1) % roles.length; wait = 300; }
      setTimeout(tick, wait);
    })();
  }

  // Cursor glow
  const glow = document.querySelector(".cursor-glow");
  if (window.matchMedia("(pointer: fine)").matches && !reduce) {
    window.addEventListener("pointermove", (e) => { glow.style.left = e.clientX + "px"; glow.style.top = e.clientY + "px"; });
  } else glow.style.display = "none";

  // Count-up numbers
  function countUp(el) {
    const end = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || "0", 10);
    const pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    if (reduce) { el.textContent = pre + end.toFixed(dec) + suf; return; }
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
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = (i % 5) * 60 + "ms";
    io.observe(el);
  });

  // Research / Engineering toggle
  const toggleWrap = document.querySelector(".toggle");
  const pill = toggleWrap.querySelector(".toggle-pill");
  const btns = toggleWrap.querySelectorAll(".toggle-btn");
  function placePill(btn) {
    pill.style.width = btn.offsetWidth + "px";
    pill.style.transform = `translateX(${btn.offsetLeft - 5}px)`;
  }
  btns.forEach((btn) => btn.addEventListener("click", () => {
    btns.forEach((b) => { b.classList.toggle("active", b === btn); b.setAttribute("aria-selected", b === btn); });
    document.querySelectorAll(".track-panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === btn.dataset.track));
    toggleWrap.classList.toggle("eng", btn.dataset.track === "engineering");
    placePill(btn);
  }));
  const placeActive = () => placePill(toggleWrap.querySelector(".toggle-btn.active"));
  window.addEventListener("resize", placeActive);
  document.fonts ? document.fonts.ready.then(placeActive) : placeActive();
  placeActive();

  // Project card spotlight follows the mouse
  document.querySelectorAll(".project").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", e.clientX - r.left + "px");
      card.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });

  // Skills as an attention-weight grid
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
    row.innerHTML = `<div class="skill-group">${group}</div><div class="skill-cells">${items.map(([n, w]) => `<span class="cell" style="--w:${w}" data-w="${w.toFixed(2)}">${n}</span>`).join("")}</div>`;
    grid.appendChild(row);
    io.observe(row);
  });
})();

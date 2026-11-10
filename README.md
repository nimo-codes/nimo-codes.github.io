# Naman Nanda: portfolio

Static site (HTML/CSS/JS, plain ES modules). No build step, so it runs on GitHub Pages as is.
Live at https://nimo-codes.github.io

## Preview locally
```bash
python3 -m http.server 8000
# open http://localhost:8000
```
It has to be served over http (not opened as a file), because the scripts are ES modules.

## What's on the page
Each piece of work has a small interactive demo. They are simulations written for this page, not the production systems, and each one is captioned that way.

| Demo | File | What it does |
| --- | --- | --- |
| Hero | `js/demos/hero.js` | The name denoises out of random dots; scrubber and re-sample |
| fig. 01 KYC pipeline | `js/demos/pipeline.js` | Simulated event-driven run with an injectable worker failure |
| fig. 02 Surprisal | `js/demos/perplexity.js` | Per-token surprisal, base vs fine-tuned, scaled to the measured 26% |
| fig. 03 Diffusion | `js/demos/diffusion.js` | Toy reverse-diffusion sampler with a LoRA on/off switch |
| fig. 04 FireWatch | `js/demos/firewatch.js` | Procedural satellite scene scanned tile by tile |

## Chat (naman-7b)
- Default engine: scripted keyword routing over the `KB` list in `js/chat.js`.
- Optional engine: the "Load real weights" button downloads Qwen2.5 1.5B (about 900 MB, cached by the browser afterwards) and runs it on the visitor's GPU with [WebLLM](https://github.com/mlc-ai/web-llm). Needs WebGPU; otherwise the page says so and stays on the scripted engine. The model only sees the `FACTS` list in `js/llm.js`.

## Editing content
- Page text, experience and projects: `index.html`
- Scripted chat answers: `KB` in `js/chat.js`
- What the real model knows: `FACTS` in `js/llm.js` (keep it in line with the page)
- Skills and their weights: the `skills` object in `js/main.js`
- Colours and fonts: the variables at the top of `css/style.css`
- Resume download: replace `assets/NamanNanda_Resume.pdf`

// Opt-in real model: WebLLM runs a small quantised LLM on the visitor's GPU (WebGPU).
// This file is only imported after the visitor clicks "Load real weights".
const WEBLLM = "https://esm.run/@mlc-ai/web-llm@0.2.88";
const MODEL = "Qwen2.5-1.5B-Instruct";

// What the model is allowed to know. Keep in sync with the page and the KB in chat.js.
const FACTS = `- Naman Nanda is an AI Engineer at MUFG Global Services in Bangalore. He joined as an intern in Nov 2025 and became full-time in July 2026.
- At MUFG he architects an AI-driven KYC platform: document ingestion, OCR, evidence processing, GenAI risk assessment and automated DOCX/XLSX reports. It is built with LangGraph, Azure Service Bus, worker microservices, Cosmos DB and Blob Storage, with checkpointing and fault recovery.
- LLM research: at the Australian National University (ANU) in Canberra, Jun-Aug 2025, he fine-tuned AstroLLaMA on scientific literature with QLoRA and PEFT and got a 26% perplexity improvement on 385K tokens.
- Diffusion research: at Samsung R&D Institute in Chennai, Mar-Jul 2024, he fine-tuned Stable Diffusion and DreamBooth GANs with LoRA on a 50-image product dataset and earned a Certificate of Excellence.
- Publication: he co-authored "ViDAS: Vision-based Danger Assessment and Scoring" at ICVGIP 2024.
- Project FireWatch: wildfire detection on NASA satellite imagery with a fine-tuned VGG-19, 97%+ accuracy on 42K images.
- Project Formulary Lens: Mistral-7B analytics for Medicare Part D formularies. It won CodeFest 2025.
- Skills: Python, PyTorch, TensorFlow, Hugging Face, LoRA/QLoRA, RAG, LangGraph, LangChain, multi-agent systems, Azure, GCP, Flask, SQL, C/C++.
- Awards: top 20 nationally for the ANU Future Research Talent program; winner of CodeFest 2025; Samsung Certificate of Excellence.
- Education: B.Tech in Computer Science (AI/ML) from SRM Institute of Science and Technology, graduating 2026, CGPA 9.25.
- Contact: namannanda5657@gmail.com, linkedin.com/in/namannanda3, github.com/nimo-codes.`;

const SYSTEM = "You are naman-7b, a friendly assistant on Naman Nanda's portfolio website. You answer visitors' questions about Naman in one to three short sentences, using only the facts you are given.";

let engine = null;

export const supported = () => typeof navigator !== "undefined" && "gpu" in navigator;
export const label = () => "Qwen2.5 1.5B (4-bit)";

export async function load(onProgress) {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("no-webgpu");
  // half-precision weights are faster where the GPU supports them
  const id = `${MODEL}-${adapter.features.has("shader-f16") ? "q4f16_1" : "q4f32_1"}-MLC`;
  const webllm = await import(WEBLLM);
  engine = await webllm.CreateMLCEngine(id, {
    initProgressCallback: (r) => onProgress(r.progress || 0, r.text || ""),
  });
  onProgress(1, "ready");
}

// history: earlier [{role, content}] turns without the facts; question: the new message.
export async function* chat(history, question) {
  const messages = [
    { role: "system", content: SYSTEM },
    ...history,
    { role: "user", content: `Facts about Naman:\n${FACTS}\n\nVisitor's message: ${question}\n\nReply using only the facts above. If the facts do not cover it, say you don't know that about Naman.` },
  ];
  const stream = await engine.chat.completions.create({ messages, stream: true, temperature: 0.2, max_tokens: 200 });
  for await (const chunk of stream) {
    const piece = chunk.choices[0]?.delta?.content;
    if (piece) yield piece;
  }
}

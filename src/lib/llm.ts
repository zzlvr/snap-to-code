import { GoogleGenAI } from "@google/genai";
import type { ImageData, LLMConfig } from "./types";

export interface StreamOptions {
  system: string;
  prompt: string;
  image: ImageData;
  json?: boolean;
  signal?: AbortSignal;
}

/** Streams text chunks from the selected vision model. Runs entirely in the browser (BYOK). */
export async function* streamLLM(cfg: LLMConfig, opts: StreamOptions): AsyncGenerator<string> {
  if (cfg.provider === "gemini") yield* streamGemini(cfg, opts);
  else yield* streamOllama(cfg, opts);
}

async function* streamGemini(cfg: LLMConfig, o: StreamOptions) {
  if (!cfg.apiKey) throw new Error("Укажите Gemini API key в настройках");
  const ai = new GoogleGenAI({ apiKey: cfg.apiKey });
  const stream = await ai.models.generateContentStream({
    model: cfg.model,
    contents: [
      {
        role: "user",
        parts: [
          { text: o.prompt },
          { inlineData: { mimeType: o.image.mimeType, data: o.image.base64 } },
        ],
      },
    ],
    config: {
      systemInstruction: o.system,
      temperature: 0.2,
      ...(o.json ? { responseMimeType: "application/json" } : {}),
      abortSignal: o.signal,
    },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

async function* streamOllama(cfg: LLMConfig, o: StreamOptions) {
  const base = cfg.ollamaUrl.replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      signal: o.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        ...(o.json ? { format: "json" } : {}),
        options: { temperature: 0.2, num_ctx: 16384 },
        messages: [
          { role: "system", content: o.system },
          { role: "user", content: o.prompt, images: [o.image.base64] },
        ],
      }),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error(
      `Не удалось подключиться к Ollama (${base}). Он запущен? Для работы с задеплоенного сайта задайте OLLAMA_ORIGINS="*".`,
    );
  }
  if (!res.ok || !res.body) {
    throw new Error(`Ollama ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(msg.error);
      if (msg.message?.content) yield msg.message.content as string;
    }
  }
}

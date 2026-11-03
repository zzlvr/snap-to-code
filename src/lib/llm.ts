import { anthropicDelta, ApiError, errorMessageFrom, openaiDelta, parseGeminiError, readSSE, retrySeconds } from "./sse";
import type { ImagePart, LLMConfig } from "./types";

export interface StreamOptions {
  system: string;
  prompt: string;
  /** One or more images of the same page, top to bottom. */
  images: ImagePart[];
  json?: boolean;
  signal?: AbortSignal;
}

/** Streams text chunks from the selected vision model. Runs entirely in the browser (BYOK). */
export async function* streamLLM(cfg: LLMConfig, opts: StreamOptions): AsyncGenerator<string> {
  switch (cfg.protocol) {
    case "gemini":
      return yield* streamGemini(cfg, opts);
    case "openai":
      return yield* streamOpenAI(cfg, opts);
    case "anthropic":
      return yield* streamAnthropic(cfg, opts);
    case "ollama":
      return yield* streamOllama(cfg, opts);
  }
}

async function post(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", signal, ...init });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error(
      `Could not reach ${new URL(url).origin}. Check that the server is running and the base URL is right. ` +
        `Browser requests also need the server to allow CORS for this site.`,
    );
  }
  if (!res.ok || !res.body) {
    const retryHeader = res.headers.get("retry-after");
    const body = await res.text().catch(() => "");
    throw new ApiError(errorMessageFrom(res.status, body, retryHeader), res.status, retrySeconds(retryHeader, body));
  }
  return res;
}

async function* streamGemini(cfg: LLMConfig, o: StreamOptions) {
  // Loaded on demand: users of other providers never download the Google SDK.
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: cfg.apiKey });
  try {
    yield* geminiChunks(ai, cfg, o);
  } catch (e) {
    if (o.signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) throw e;
    throw parseGeminiError(e);
  }
}

async function* geminiChunks(ai: import("@google/genai").GoogleGenAI, cfg: LLMConfig, o: StreamOptions) {
  const stream = await ai.models.generateContentStream({
    model: cfg.model,
    contents: [
      {
        role: "user",
        parts: [
          { text: o.prompt },
          ...o.images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
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

/** OpenAI chat-completions protocol: OpenAI, OpenRouter, LM Studio, vLLM, Groq, Together, ... */
async function* streamOpenAI(cfg: LLMConfig, o: StreamOptions) {
  // No temperature / response_format: several models and servers reject them.
  // The prompt demands JSON and the parser tolerates surrounding text.
  const res = await post(
    `${cfg.baseUrl}/chat/completions`,
    {
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        messages: [
          { role: "system", content: o.system },
          {
            role: "user",
            content: [
              { type: "text", text: o.prompt },
              ...o.images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })),
            ],
          },
        ],
      }),
    },
    o.signal,
  );
  for await (const data of readSSE(res.body!)) {
    if (data === "[DONE]") return;
    const json = JSON.parse(data);
    if (json.error) throw new Error(json.error.message ?? "The model API reported an error");
    const text = openaiDelta(json);
    if (text) yield text;
  }
}

async function* streamAnthropic(cfg: LLMConfig, o: StreamOptions) {
  const res = await post(
    `${cfg.baseUrl}/v1/messages`,
    {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
        // Required by Anthropic for calls made straight from a browser (BYOK).
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 16000,
        stream: true,
        system: o.system,
        messages: [
          {
            role: "user",
            content: [
              ...o.images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mimeType, data: img.base64 } })),
              { type: "text", text: o.prompt },
            ],
          },
        ],
      }),
    },
    o.signal,
  );
  for await (const data of readSSE(res.body!)) {
    const text = anthropicDelta(JSON.parse(data));
    if (text) yield text;
  }
}

async function* streamOllama(cfg: LLMConfig, o: StreamOptions) {
  const res = await post(
    `${cfg.baseUrl}/api/chat`,
    {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        ...(o.json ? { format: "json" } : {}),
        options: { temperature: 0.2, num_ctx: 16384 },
        messages: [
          { role: "system", content: o.system },
          { role: "user", content: o.prompt, images: o.images.map((img) => img.base64) },
        ],
      }),
    },
    o.signal,
  );
  const reader = res.body!.getReader();
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

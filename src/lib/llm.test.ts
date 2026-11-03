import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { streamLLM } from "./llm";
import type { ImagePart, LLMConfig } from "./types";

const image: ImagePart = { mimeType: "image/jpeg", base64: "QUJD" };
const second: ImagePart = { mimeType: "image/jpeg", base64: "REVG" };

interface Seen {
  url: string;
  headers: IncomingMessage["headers"];
  // Loosely typed on purpose: each protocol has a different request shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>;
}

let server: Server;
let base: string;
let seen: Seen;
let respond: (res: import("node:http").ServerResponse) => void;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen = { url: req.url ?? "", headers: req.headers, body: raw ? JSON.parse(raw) : {} };
      respond(res);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function run(cfg: LLMConfig, json = false, images: ImagePart[] = [image]) {
  let out = "";
  for await (const chunk of streamLLM(cfg, { system: "SYS", prompt: "PROMPT", images, json })) out += chunk;
  return out;
}

describe("OpenAI-compatible protocol", () => {
  const cfg = (): LLMConfig => ({ protocol: "openai", apiKey: "sk-test", model: "any-vlm", baseUrl: `${base}/v1` });

  it("sends a vision chat-completions request and assembles the stream", async () => {
    respond = (res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write('data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":"lo"}}]}\n\n');
      res.end("data: [DONE]\n\n");
    };
    expect(await run(cfg())).toBe("Hello");
    expect(seen.url).toBe("/v1/chat/completions");
    expect(seen.headers.authorization).toBe("Bearer sk-test");
    expect(seen.body.model).toBe("any-vlm");
    expect(seen.body.stream).toBe(true);
    expect(seen.body.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(seen.body.messages[1].content).toEqual([
      { type: "text", text: "PROMPT" },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } },
    ]);
    // Sampling params are omitted on purpose: several models reject them.
    expect(seen.body.temperature).toBeUndefined();
    expect(seen.body.response_format).toBeUndefined();
  });

  it("sends several images of one page in order", async () => {
    respond = (res) => res.end("data: [DONE]\n\n");
    await run(cfg(), false, [image, second]);
    expect(seen.body.messages[1].content).toEqual([
      { type: "text", text: "PROMPT" },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,REVG" } },
    ]);
  });

  it("omits the Authorization header when no key is set (local servers)", async () => {
    respond = (res) => res.end("data: [DONE]\n\n");
    await run({ ...cfg(), apiKey: "" });
    expect(seen.headers.authorization).toBeUndefined();
  });

  it("surfaces API errors with a helpful message", async () => {
    respond = (res) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Incorrect API key provided" } }));
    };
    await expect(run(cfg())).rejects.toThrow(/401.*Incorrect API key provided.*Check the API key/);
  });

  it("surfaces errors sent inside the stream", async () => {
    respond = (res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end('data: {"error":{"message":"context length exceeded"}}\n\n');
    };
    await expect(run(cfg())).rejects.toThrow("context length exceeded");
  });
});

describe("Anthropic protocol", () => {
  const cfg = (): LLMConfig => ({ protocol: "anthropic", apiKey: "sk-ant", model: "claude-x", baseUrl: base });

  it("sends the browser-access header, image block first, and assembles text deltas", async () => {
    respond = (res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write('event: message_start\ndata: {"type":"message_start"}\n\n');
      res.write('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"He"}}\n\n');
      res.write('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"llo"}}\n\n');
      res.end('event: message_stop\ndata: {"type":"message_stop"}\n\n');
    };
    expect(await run(cfg())).toBe("Hello");
    expect(seen.url).toBe("/v1/messages");
    expect(seen.headers["x-api-key"]).toBe("sk-ant");
    expect(seen.headers["anthropic-version"]).toBe("2023-06-01");
    expect(seen.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(seen.body.system).toBe("SYS");
    expect(seen.body.max_tokens).toBeGreaterThan(0);
    expect(seen.body.messages[0].content[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "QUJD" },
    });
  });

  it("sends several images of one page in order, all before the text", async () => {
    respond = (res) => res.end('event: message_stop\ndata: {"type":"message_stop"}\n\n');
    await run(cfg(), false, [image, second]);
    const content = seen.body.messages[0].content;
    expect(content.map((c: { type: string }) => c.type)).toEqual(["image", "image", "text"]);
    expect(content[1].source.data).toBe("REVG");
  });

  it("throws on stream error events", async () => {
    respond = (res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end('event: error\ndata: {"type":"error","error":{"message":"Overloaded"}}\n\n');
    };
    await expect(run(cfg())).rejects.toThrow("Overloaded");
  });
});

describe("Ollama protocol", () => {
  const cfg = (): LLMConfig => ({ protocol: "ollama", apiKey: "", model: "llava", baseUrl: base });

  it("streams NDJSON and requests JSON format for the analysis step", async () => {
    respond = (res) => {
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      res.write('{"message":{"content":"{\\"a\\""},"done":false}\n');
      res.end('{"message":{"content":":1}"},"done":true}\n');
    };
    expect(await run(cfg(), true)).toBe('{"a":1}');
    expect(seen.url).toBe("/api/chat");
    expect(seen.body.format).toBe("json");
    expect(seen.body.messages[1].images).toEqual(["QUJD"]);
  });

  it("sends several images of one page in order", async () => {
    respond = (res) => res.end('{"message":{"content":"x"},"done":true}\n');
    await run(cfg(), false, [image, second]);
    expect(seen.body.messages[1].images).toEqual(["QUJD", "REVG"]);
  });

  it("does not force JSON format for code generation", async () => {
    respond = (res) => res.end('{"message":{"content":"x"},"done":true}\n');
    await run(cfg(), false);
    expect(seen.body.format).toBeUndefined();
  });
});

describe("unreachable server", () => {
  it("explains how to fix a connection failure", async () => {
    const cfg: LLMConfig = { protocol: "openai", apiKey: "", model: "m", baseUrl: "http://127.0.0.1:1/v1" };
    await expect(run(cfg)).rejects.toThrow(/Could not reach http:\/\/127\.0\.0\.1:1.*CORS/);
  });
});

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectLocalModels, looksLikeVision } from "./local-detect";

describe("looksLikeVision", () => {
  it.each(["llava:7b", "llama3.2-vision", "qwen2.5vl:7b", "minicpm-v", "gemma3:12b", "Qwen2-VL-7B", "pixtral-12b"])(
    "accepts %s",
    (n) => expect(looksLikeVision(n)).toBe(true),
  );
  it.each(["llama3.1:8b", "mistral:7b", "nomic-embed-text", "qwen2.5-coder:7b", "deepseek-r1:8b"])(
    "rejects %s",
    (n) => expect(looksLikeVision(n)).toBe(false),
  );
});

function serve(handler: Parameters<typeof createServer>[1]): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }));
  });
}
const json = (res: import("node:http").ServerResponse, body: unknown, status = 200) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

describe("detectLocalModels", () => {
  const servers: Server[] = [];
  let ollama: string;
  let ollamaOld: string;
  let lmstudio: string;
  const dead = "http://127.0.0.1:1";

  beforeAll(async () => {
    // Modern Ollama: reports capabilities.
    const a = await serve((req, res) => {
      if (req.url === "/api/tags") return json(res, { models: [{ name: "llama3.1:8b" }, { name: "qwen2.5vl:7b" }, { name: "weird-name" }] });
      if (req.url === "/api/show") {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => {
          const { model } = JSON.parse(raw);
          // "weird-name" is vision-capable despite its name: capabilities must win over the name heuristic.
          json(res, { capabilities: model === "qwen2.5vl:7b" || model === "weird-name" ? ["completion", "vision"] : ["completion"] });
        });
        return;
      }
      json(res, {}, 404);
    });
    // Older Ollama: no capabilities field, so the name heuristic is the only signal.
    const b = await serve((req, res) => {
      if (req.url === "/api/tags") return json(res, { models: [{ name: "llava:7b" }, { name: "mistral:7b" }] });
      if (req.url === "/api/show") return json(res, {});
      json(res, {}, 404);
    });
    const c = await serve((req, res) => {
      if (req.url === "/api/v0/models") return json(res, { data: [{ id: "qwen2-vl-7b", type: "vlm" }, { id: "llama-3-8b", type: "llm" }, { id: "embed", type: "embeddings" }] });
      json(res, {}, 404);
    });
    servers.push(a.server, b.server, c.server);
    [ollama, ollamaOld, lmstudio] = [a.url, b.url, c.url];
  });
  afterAll(() => Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r())))));

  it("returns only vision models reported by Ollama, trusting capabilities over names", async () => {
    const found = await detectLocalModels({ ollamaUrl: ollama, lmStudioUrl: dead });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ providerId: "ollama", label: "Ollama", baseUrl: ollama });
    expect(found[0].models.sort()).toEqual(["qwen2.5vl:7b", "weird-name"]);
  });

  it("falls back to name matching on older Ollama versions", async () => {
    const found = await detectLocalModels({ ollamaUrl: ollamaOld, lmStudioUrl: dead });
    expect(found[0].models).toEqual(["llava:7b"]);
  });

  it("finds LM Studio vision models via its vlm type and returns an OpenAI-style base URL", async () => {
    const found = await detectLocalModels({ ollamaUrl: dead, lmStudioUrl: lmstudio });
    expect(found).toEqual([
      { providerId: "custom", label: "LM Studio", baseUrl: `${lmstudio}/v1`, models: ["qwen2-vl-7b"] },
    ]);
  });

  it("lists Ollama first when both are running", async () => {
    const found = await detectLocalModels({ ollamaUrl: ollama, lmStudioUrl: lmstudio });
    expect(found.map((f) => f.label)).toEqual(["Ollama", "LM Studio"]);
  });

  it("returns an empty list, without throwing, when nothing is running", async () => {
    expect(await detectLocalModels({ ollamaUrl: dead, lmStudioUrl: dead })).toEqual([]);
  });

  it("gives up on a hung server after the timeout", async () => {
    const hung = await serve(() => {
      /* never respond */
    });
    servers.push(hung.server);
    const t0 = Date.now();
    const found = await detectLocalModels({ ollamaUrl: hung.url, lmStudioUrl: dead, timeoutMs: 200 });
    expect(found).toEqual([]);
    expect(Date.now() - t0).toBeLessThan(2000);
    hung.server.closeAllConnections();
  });
});

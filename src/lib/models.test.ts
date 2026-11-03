import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bestModel, fetchModelIds, parseGeminiModels, parseOpenAIModels, versionOf } from "./models";
import type { LLMConfig } from "./types";

describe("versionOf", () => {
  it("reads every number in order", () => {
    expect(versionOf("gemini-3.8-flash")).toEqual([3, 8]);
    expect(versionOf("claude-sonnet-5-5")).toEqual([5, 5]);
    expect(versionOf("gpt-4o")).toEqual([4]);
    expect(versionOf("gemini-flash-latest")).toEqual([]);
  });
});

describe("bestModel", () => {
  const gemini = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.8-flash-preview",
    "gemini-3.8-flash-image",
    "text-embedding-004",
    "gemini-2.5-flash-preview-tts",
    "gemini-2.0-flash-live",
  ];

  it("picks the newest stable flash for Gemini and skips non-vision-chat models", () => {
    expect(bestModel("gemini", gemini)).toBe("gemini-3.8-flash");
  });

  it("moves on when the best model just failed", () => {
    expect(bestModel("gemini", gemini, "gemini-3.8-flash")).toBe("gemini-2.5-flash");
  });

  it("prefers a stable name over a preview of the same version", () => {
    expect(bestModel("gemini", ["gemini-4-flash-preview", "gemini-4-flash"])).toBe("gemini-4-flash");
  });

  it("follows new releases without any code change", () => {
    expect(bestModel("gemini", [...gemini, "gemini-4-flash"])).toBe("gemini-4-flash");
    expect(bestModel("gemini", [...gemini, "gemini-3.10-flash"])).toBe("gemini-3.10-flash");
  });

  it("falls back to lite or pro when no plain flash exists", () => {
    expect(bestModel("gemini", ["gemini-3.5-flash-lite", "gemini-3-pro"])).toBe("gemini-3.5-flash-lite");
    expect(bestModel("gemini", ["gemini-3-pro"])).toBe("gemini-3-pro");
  });

  it("falls back to the newest usable id when nothing matches a family", () => {
    expect(bestModel("gemini", ["gemini-9-ultra", "gemini-8-ultra"])).toBe("gemini-9-ultra");
  });

  it("picks the newest plain GPT and the newest Claude Sonnet", () => {
    expect(bestModel("openai", ["gpt-4o", "gpt-4.1", "gpt-4.1-mini", "gpt-4o-audio-preview", "text-embedding-3-large"])).toBe("gpt-4.1");
    expect(
      bestModel("anthropic", ["claude-opus-5-5", "claude-haiku-5-5", "claude-sonnet-5-5", "claude-sonnet-4-5-20250929"]),
    ).toBe("claude-sonnet-5-5");
  });

  it("has no opinion for providers without a rule, and for an empty list", () => {
    expect(bestModel("openrouter", ["a/b"])).toBeNull();
    expect(bestModel("custom", ["x"])).toBeNull();
    expect(bestModel("gemini", [])).toBeNull();
  });
});

describe("list parsers", () => {
  it("keeps Gemini models that can generate content and strips the models/ prefix", () => {
    expect(
      parseGeminiModels({
        models: [
          { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent", "countTokens"] },
          { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
        ],
      }),
    ).toEqual(["gemini-3.8-flash"]);
  });

  it("drops OpenRouter models that cannot read images", () => {
    expect(
      parseOpenAIModels({
        data: [
          { id: "a/vision", architecture: { input_modalities: ["text", "image"] } },
          { id: "b/text-only", architecture: { input_modalities: ["text"] } },
          { id: "gpt-4.1" },
        ],
      }),
    ).toEqual(["a/vision", "gpt-4.1"]);
  });
});

describe("fetchModelIds", () => {
  interface Seen {
    url: string;
    headers: IncomingMessage["headers"];
  }
  let server: Server;
  let base: string;
  let seen: Seen;
  let status = 200;

  beforeAll(async () => {
    server = createServer((req, res) => {
      seen = { url: req.url ?? "", headers: req.headers };
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ id: "model-one" }, { id: "model-two" }] }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const cfg = (protocol: LLMConfig["protocol"], baseUrl: string): LLMConfig => ({ protocol, apiKey: "k", model: "m", baseUrl });

  it("asks an OpenAI-style server with the bearer key", async () => {
    status = 200;
    expect(await fetchModelIds("openai", cfg("openai", `${base}/v1`))).toEqual(["model-one", "model-two"]);
    expect(seen.url).toBe("/v1/models");
    expect(seen.headers.authorization).toBe("Bearer k");
  });

  it("asks Anthropic with its browser-access header", async () => {
    status = 200;
    await fetchModelIds("anthropic", cfg("anthropic", base));
    expect(seen.url).toBe("/v1/models?limit=100");
    expect(seen.headers["x-api-key"]).toBe("k");
    expect(seen.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  });

  it("returns an empty list on an error status, an unreachable server, a missing key, or an unsupported provider", async () => {
    status = 401;
    expect(await fetchModelIds("openai", cfg("openai", `${base}/v1`))).toEqual([]);
    status = 200;
    expect(await fetchModelIds("openai", cfg("openai", "http://127.0.0.1:1/v1"))).toEqual([]);
    expect(await fetchModelIds("openai", { ...cfg("openai", `${base}/v1`), apiKey: "  " })).toEqual([]);
    expect(await fetchModelIds("ollama", cfg("ollama", base))).toEqual([]);
    expect(await fetchModelIds("custom", cfg("openai", `${base}/v1`))).toEqual([]);
  });
});

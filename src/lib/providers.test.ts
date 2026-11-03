import { describe, expect, it } from "vitest";
import { defaultProfile, getPreset, PROVIDERS, toConfig, validateConfig } from "./providers";

describe("provider presets", () => {
  it("has unique ids and a supported protocol for each", () => {
    expect(new Set(PROVIDERS.map((p) => p.id)).size).toBe(PROVIDERS.length);
    for (const p of PROVIDERS) expect(["gemini", "openai", "anthropic", "ollama"]).toContain(p.protocol);
  });

  it("falls back to the first preset for unknown ids", () => {
    expect(getPreset("nope").id).toBe(PROVIDERS[0].id);
  });

  it("offers a custom OpenAI-compatible endpoint so any model can be used", () => {
    const custom = getPreset("custom");
    expect(custom.protocol).toBe("openai");
    expect(custom.editableBaseUrl).toBe(true);
    expect(custom.needsKey).toBe(false);
  });
});

describe("toConfig", () => {
  it("trims values and strips trailing slashes from editable base URLs", () => {
    const cfg = toConfig("ollama", { apiKey: " k ", model: " llava ", baseUrl: " http://localhost:11434/// " });
    expect(cfg).toEqual({ protocol: "ollama", apiKey: "k", model: "llava", baseUrl: "http://localhost:11434" });
  });

  it("ignores a stale stored base URL for fixed-URL providers", () => {
    const cfg = toConfig("openai", { apiKey: "k", model: "gpt-4o", baseUrl: "https://evil.example" });
    expect(cfg.baseUrl).toBe("https://api.openai.com/v1");
  });
});

describe("validateConfig", () => {
  it("requires a key for hosted providers", () => {
    const cfg = toConfig("openai", defaultProfile("openai"));
    expect(validateConfig("openai", cfg)).toMatch(/API key/);
  });

  it("does not require a key for local or custom endpoints", () => {
    expect(validateConfig("ollama", toConfig("ollama", defaultProfile("ollama")))).toBeNull();
    expect(
      validateConfig("custom", toConfig("custom", { apiKey: "", model: "my-vlm", baseUrl: "http://localhost:1234/v1" })),
    ).toBeNull();
  });

  it("requires a model name", () => {
    const cfg = toConfig("custom", { apiKey: "", model: "  ", baseUrl: "http://localhost:1234/v1" });
    expect(validateConfig("custom", cfg)).toMatch(/model/i);
  });

  it("rejects malformed and non-http base URLs", () => {
    for (const baseUrl of ["not a url", "ftp://host", "javascript:alert(1)"]) {
      const cfg = toConfig("custom", { apiKey: "", model: "m", baseUrl });
      expect(validateConfig("custom", cfg)).toMatch(/base URL/);
    }
  });

  it("accepts a configured Gemini key", () => {
    const cfg = toConfig("gemini", { ...defaultProfile("gemini"), apiKey: "AIza-test" });
    expect(validateConfig("gemini", cfg)).toBeNull();
  });
});

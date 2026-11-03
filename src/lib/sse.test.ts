import { describe, expect, it } from "vitest";
import { anthropicDelta, errorMessageFrom, openaiDelta, readSSE } from "./sse";

function streamOf(...chunks: string[]) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

async function collect(gen: AsyncGenerator<string>) {
  const out: string[] = [];
  for await (const x of gen) out.push(x);
  return out;
}

describe("readSSE", () => {
  it("yields each data payload and ignores other lines", async () => {
    const body = streamOf('event: x\ndata: {"a":1}\n\n: comment\ndata: [DONE]\n\n');
    expect(await collect(readSSE(body))).toEqual(['{"a":1}', "[DONE]"]);
  });

  it("reassembles lines split across network chunks", async () => {
    const body = streamOf('da', 'ta: {"te', 'xt":"hi"}\n', "\ndata: 2\n\n");
    expect(await collect(readSSE(body))).toEqual(['{"text":"hi"}', "2"]);
  });

  it("handles CRLF and a final line without a trailing newline", async () => {
    const body = streamOf("data: 1\r\n\r\ndata: 2");
    expect(await collect(readSSE(body))).toEqual(["1", "2"]);
  });
});

describe("openaiDelta", () => {
  it("reads string content", () => {
    expect(openaiDelta({ choices: [{ delta: { content: "abc" } }] })).toBe("abc");
  });
  it("reads array-of-parts content", () => {
    expect(openaiDelta({ choices: [{ delta: { content: [{ text: "a" }, "b"] } }] })).toBe("ab");
  });
  it("returns empty for role-only, empty-choices and malformed chunks", () => {
    expect(openaiDelta({ choices: [{ delta: { role: "assistant" } }] })).toBe("");
    expect(openaiDelta({ choices: [] })).toBe("");
    expect(openaiDelta(null)).toBe("");
  });
});

describe("anthropicDelta", () => {
  it("reads text deltas", () => {
    expect(anthropicDelta({ type: "content_block_delta", delta: { type: "text_delta", text: "hi" } })).toBe("hi");
  });
  it("ignores other event types", () => {
    expect(anthropicDelta({ type: "message_start" })).toBe("");
    expect(anthropicDelta({ type: "content_block_delta", delta: { type: "input_json_delta" } })).toBe("");
  });
  it("throws on error events", () => {
    expect(() => anthropicDelta({ type: "error", error: { message: "overloaded" } })).toThrow("overloaded");
  });
});

describe("errorMessageFrom", () => {
  it("extracts the provider message and adds a fix hint", () => {
    const msg = errorMessageFrom(401, JSON.stringify({ error: { message: "Invalid API key" } }));
    expect(msg).toContain("401");
    expect(msg).toContain("Invalid API key");
    expect(msg).toMatch(/Check the API key/);
  });
  it("hints about model and URL on 404, and about limits on 429", () => {
    expect(errorMessageFrom(404, "")).toMatch(/model name and base URL/);
    expect(errorMessageFrom(429, "")).toMatch(/Rate limit/);
  });
  it("falls back to raw text for non-JSON bodies", () => {
    expect(errorMessageFrom(500, "boom")).toContain("boom");
  });
});

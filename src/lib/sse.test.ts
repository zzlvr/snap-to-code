import { describe, expect, it } from "vitest";
import { anthropicDelta, ApiError, errorMessageFrom, geminiErrorMessage, openaiDelta, parseGeminiError, rateLimitHint, readSSE, retrySeconds } from "./sse";

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

describe("geminiErrorMessage", () => {
  // The exact payload a real user got: JSON inside a JSON string.
  const nested = new Error(
    JSON.stringify({
      error: {
        message:
          '{\n "error": {\n "code": 404,\n "message": "This model models/gemini-2.5-flash is no longer available to new users.",\n "status": "NOT_FOUND"\n }\n}\n',
        code: 404,
        status: "",
      },
    }),
  );

  it("unwraps nested JSON into one readable sentence with a hint", () => {
    const msg = geminiErrorMessage(nested);
    expect(msg).toBe(
      "Gemini returned 404: This model models/gemini-2.5-flash is no longer available to new users. Pick another model in the model settings.",
    );
    expect(msg).not.toContain("{");
    expect(msg).not.toContain("\\");
  });

  it("hints at the key and at quota limits", () => {
    expect(geminiErrorMessage(new Error(JSON.stringify({ error: { code: 403, message: "API key not valid" } })))).toMatch(/Check the API key/);
    expect(geminiErrorMessage(new Error(JSON.stringify({ error: { code: 429, message: "Quota exceeded" } })))).toMatch(/Rate limit or quota reached/);
  });

  it("uses the status property of the SDK error when the message has no code", () => {
    const e = Object.assign(new Error("plain text failure"), { status: 429 });
    expect(geminiErrorMessage(e)).toMatch(/^Gemini returned 429: plain text failure/);
  });

  it("passes through a plain message that has no code", () => {
    expect(geminiErrorMessage(new Error("something odd"))).toBe("something odd");
  });
});

describe("rate limits", () => {
  // Shaped like a real Gemini 429: JSON inside JSON, quota id and a RetryInfo detail.
  const perMinute = new Error(
    JSON.stringify({
      error: {
        message: JSON.stringify({
          error: {
            code: 429,
            message: "You exceeded your current quota. Please retry in 34.5s.",
            status: "RESOURCE_EXHAUSTED",
            details: [
              { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }] },
              { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "34s" },
            ],
          },
        }),
        code: 429,
        status: "",
      },
    }),
  );
  const perDay = new Error(
    JSON.stringify({
      error: {
        message: JSON.stringify({ error: { code: 429, message: "Quota exceeded for GenerateRequestsPerDayPerProjectPerModel-FreeTier" } }),
        code: 429,
      },
    }),
  );

  it("reads the wait time the provider asks for", () => {
    expect(retrySeconds("retry in 34.5s")).toBe(34.5);
    expect(retrySeconds('"retryDelay": "34s"')).toBe(34);
    expect(retrySeconds('{\\"retryDelay\\": \\"12s\\"}')).toBe(12);
    expect(retrySeconds("7")).toBe(7);
    expect(retrySeconds(null, undefined, "nothing here")).toBeUndefined();
  });

  it("tells the user how long to wait after a per-minute limit", () => {
    const e = parseGeminiError(perMinute) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(429);
    expect(e.retryAfter).toBe(34.5);
    expect(e.message).toMatch(/Try again in about 35 s/);
    expect(e.message).toMatch(/lighter model/);
  });

  it("says a daily limit will not clear in seconds", () => {
    const e = parseGeminiError(perDay) as ApiError;
    expect(e.status).toBe(429);
    expect(e.message).toMatch(/daily limit/);
    expect(e.message).toMatch(/midnight Pacific/);
    expect(e.message).not.toMatch(/Try again in about/);
  });

  it("handles OpenAI-style 429s with a Retry-After header", () => {
    const msg = errorMessageFrom(429, '{"error":{"message":"Too many requests"}}', "7");
    expect(msg).toMatch(/Too many requests/);
    expect(msg).toMatch(/Try again in about 7 s/);
    expect(errorMessageFrom(429, "{}", null)).toMatch(/Wait a moment/);
  });

  it("builds the hint on its own", () => {
    expect(rateLimitHint("x", 3)).toMatch(/about 3 s/);
    expect(rateLimitHint("PerDay", 3)).toMatch(/daily/);
  });
});

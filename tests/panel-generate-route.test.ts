import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/panel/generate/route";

type JsonRecord = Record<string, unknown>;

function makeRequest(body: string): Request {
  return new Request("http://localhost/api/panel/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
}

function makeValidPayload(): JsonRecord {
  return {
    model: "google/gemini-2.5-flash-image",
    prompt: "A hero jumping between rooftops",
    referenceImageUrls: [],
    imageConfig: {
      aspect_ratio: "4:3",
      image_size: "1K"
    }
  };
}

describe("POST /api/panel/generate", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(makeRequest("not-json"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid JSON body."
    });
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(makeRequest(JSON.stringify({ model: "x" })));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid request payload."
    });
  });

  it("returns 413 when references exceed server limit", async () => {
    const oversized = "a".repeat(4_500_001);
    const payload = {
      ...makeValidPayload(),
      referenceImageUrls: [oversized]
    };

    const response = await POST(makeRequest(JSON.stringify(payload)));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error:
        "Reference images are too large for one request. Try fewer references or smaller images."
    });
  });

  it("returns 401 when OpenRouter key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const response = await POST(makeRequest(JSON.stringify(makeValidPayload())));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "OpenRouter authentication failed. Check OPENROUTER_API_KEY."
    });
  });

  it("returns 429 when upstream rate limits", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("rate limited", {
        status: 429
      })
    );

    const response = await POST(makeRequest(JSON.stringify(makeValidPayload())));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: "Rate limited by OpenRouter. Please wait and retry."
    });
  });

  it("returns 502 when model returns no image", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "No image output" } }]
        }),
        { status: 200 }
      )
    );

    const response = await POST(makeRequest(JSON.stringify(makeValidPayload())));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: "Model response did not include an image. Try a different model."
    });
  });

  it("returns 500 for unexpected runtime errors", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));

    const response = await POST(makeRequest(JSON.stringify(makeValidPayload())));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unexpected server error while generating panel image."
    });
  });

  it("returns generated image on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                images: [{ image_url: { url: "data:image/png;base64,abc123" } }],
                content: [{ text: "ok" }]
              }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const response = await POST(makeRequest(JSON.stringify(makeValidPayload())));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      imageDataUrl: "data:image/png;base64,abc123",
      text: "ok"
    });
  });
});

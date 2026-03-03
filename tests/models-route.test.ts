import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/models/route";
import { CURATED_IMAGE_MODELS } from "../lib/constants";

describe("GET /api/models", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns curated fallback when key is missing", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      models: CURATED_IMAGE_MODELS,
      source: "fallback"
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns filtered image-capable models from OpenRouter", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "model/image-1",
              architecture: { output_modalities: ["text", "image"] }
            },
            {
              id: "model/text-only",
              architecture: { output_modalities: ["text"] }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      models: ["model/image-1"],
      source: "openrouter"
    });
  });

  it("falls back when OpenRouter returns no image models", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "model/text-only",
              architecture: { output_modalities: ["text"] }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      models: CURATED_IMAGE_MODELS,
      source: "fallback"
    });
  });

  it("falls back when OpenRouter upstream fails", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";

    vi.mocked(fetch).mockResolvedValueOnce(new Response("upstream error", { status: 500 }));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      models: CURATED_IMAGE_MODELS,
      source: "fallback"
    });
  });

  it("falls back when OpenRouter response is invalid JSON", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";

    vi.mocked(fetch).mockResolvedValueOnce(new Response("not-json", { status: 200 }));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      models: CURATED_IMAGE_MODELS,
      source: "fallback"
    });
  });
});

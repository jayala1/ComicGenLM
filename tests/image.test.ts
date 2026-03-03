import { describe, expect, it } from "vitest";
import { compressImageDataUrl, slugify } from "../lib/image";

describe("image helpers", () => {
  it("slugify() normalizes title text", () => {
    expect(slugify("  My Comic: Chapter #1  ")).toBe("my-comic-chapter-1");
  });

  it("slugify() falls back when value becomes empty", () => {
    expect(slugify("***")).toBe("comic-page");
  });

  it("compressImageDataUrl() is safe in node/non-browser tests", async () => {
    const sample = "data:image/png;base64,abc123";
    await expect(compressImageDataUrl(sample)).resolves.toBe(sample);
  });

  it("compressImageDataUrl() leaves non-image data unchanged", async () => {
    const sample = "data:text/plain;base64,abc123";
    await expect(compressImageDataUrl(sample)).resolves.toBe(sample);
  });
});

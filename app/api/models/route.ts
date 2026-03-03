import { NextResponse } from "next/server";
import { CURATED_IMAGE_MODELS } from "../../../lib/constants";
import { OpenRouterHttpError, openRouterListModels } from "../../../lib/openrouter";

type OpenRouterModel = {
  id?: string;
  architecture?: {
    output_modalities?: string[];
  };
};

function extractImageModels(data: unknown): string[] {
  if (typeof data !== "object" || data === null) {
    return [];
  }

  const list = (data as { data?: unknown[] }).data;

  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .filter((item): item is OpenRouterModel => typeof item === "object" && item !== null)
    .filter((model) => {
      const outputs = model.architecture?.output_modalities;
      return Array.isArray(outputs) && outputs.includes("image") && typeof model.id === "string";
    })
    .map((model) => model.id as string)
    .slice(0, 30);
}

export async function GET(): Promise<NextResponse> {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ models: CURATED_IMAGE_MODELS, source: "fallback" });
  }

  try {
    const data = await openRouterListModels();
    const extracted = extractImageModels(data);

    if (extracted.length === 0) {
      return NextResponse.json({ models: CURATED_IMAGE_MODELS, source: "fallback" });
    }

    return NextResponse.json({ models: extracted, source: "openrouter" });
  } catch (error) {
    if (error instanceof OpenRouterHttpError) {
      return NextResponse.json({ models: CURATED_IMAGE_MODELS, source: "fallback" });
    }

    return NextResponse.json({ models: CURATED_IMAGE_MODELS, source: "fallback" });
  }
}

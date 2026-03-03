import { NextResponse } from "next/server";
import { z } from "zod";
import { OpenRouterHttpError, openRouterChatCompletion } from "../../../../lib/openrouter";

const requestSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1).max(8000),
  referenceImageUrls: z.array(z.string().min(1)).max(4).default([]),
  imageConfig: z
    .object({
      aspect_ratio: z.string().min(1).optional(),
      image_size: z.string().min(1).optional()
    })
    .optional()
});

const MAX_REF_TOTAL_CHARS = 4_500_000;

function getErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "OpenRouter authentication failed. Check OPENROUTER_API_KEY.";
  }

  if (status === 413) {
    return "Request payload too large. Use fewer/smaller references and retry.";
  }

  if (status === 429) {
    return "Rate limited by OpenRouter. Please wait and retry.";
  }

  return "OpenRouter request failed.";
}

function parseImageFromResponse(data: unknown): { imageDataUrl?: string; text?: string } {
  if (typeof data !== "object" || data === null) {
    return {};
  }

  const firstChoice = (data as { choices?: unknown[] }).choices?.[0] as
    | {
        message?: {
          images?: { image_url?: { url?: string } }[];
          content?: unknown;
        };
      }
    | undefined;

  const imageDataUrl = firstChoice?.message?.images?.[0]?.image_url?.url;

  const content = firstChoice?.message?.content;
  let text = "";

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .map((part) => {
        if (typeof part === "object" && part !== null && "text" in part) {
          const candidate = (part as { text?: unknown }).text;
          return typeof candidate === "string" ? candidate : "";
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return {
    imageDataUrl: typeof imageDataUrl === "string" ? imageDataUrl : undefined,
    text: text || undefined
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const totalRefChars = input.referenceImageUrls.reduce((acc, item) => acc + item.length, 0);

  if (totalRefChars > MAX_REF_TOTAL_CHARS) {
    return NextResponse.json(
      {
        error:
          "Reference images are too large for one request. Try fewer references or smaller images."
      },
      { status: 413 }
    );
  }

  const contentParts = [
    { type: "text", text: input.prompt },
    ...input.referenceImageUrls.map((url) => ({
      type: "image_url",
      image_url: { url }
    }))
  ];

  try {
    const data = await openRouterChatCompletion({
      model: input.model,
      messages: [{ role: "user", content: contentParts }],
      modalities: ["image", "text"],
      image_config: input.imageConfig
    });

    const parsedResponse = parseImageFromResponse(data);

    if (!parsedResponse.imageDataUrl) {
      return NextResponse.json(
        { error: "Model response did not include an image. Try a different model." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      imageDataUrl: parsedResponse.imageDataUrl,
      text: parsedResponse.text
    });
  } catch (error) {
    if (error instanceof OpenRouterHttpError) {
      const status = [401, 403, 413, 429].includes(error.status) ? error.status : 502;

      return NextResponse.json(
        {
          error: getErrorMessage(error.status),
          upstream: error.responseText
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        error: "Unexpected server error while generating panel image."
      },
      { status: 500 }
    );
  }
}

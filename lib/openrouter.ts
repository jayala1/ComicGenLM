const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export class OpenRouterHttpError extends Error {
  status: number;
  responseText: string;

  constructor(status: number, responseText: string) {
    super(`OpenRouter request failed with status ${status}`);
    this.status = status;
    this.responseText = responseText;
  }
}

function authHeaders(): HeadersInit {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new OpenRouterHttpError(401, "OPENROUTER_API_KEY is missing on the server.");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "ComicGen MVP"
  };
}

export async function openRouterChatCompletion(payload: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new OpenRouterHttpError(response.status, text);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new OpenRouterHttpError(502, "Invalid JSON returned by OpenRouter.");
  }
}

export async function openRouterListModels(): Promise<unknown> {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    method: "GET",
    headers: authHeaders()
  });

  const text = await response.text();

  if (!response.ok) {
    throw new OpenRouterHttpError(response.status, text);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new OpenRouterHttpError(502, "Invalid models JSON returned by OpenRouter.");
  }
}

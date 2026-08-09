import "server-only";

const DEFAULT_MODEL = "gemini-3.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message?: string;
  };
}

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

interface GenerateGeminiTextOptions {
  systemInstruction: string;
  prompt: string;
  /** Earlier turns of the same conversation, oldest first. */
  history?: GeminiTurn[];
  temperature?: number;
  maxOutputTokens?: number;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export async function generateGeminiText({
  systemInstruction,
  prompt,
  history = [],
  temperature = 0.2,
  maxOutputTokens = 1600,
}: GenerateGeminiTextOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Gemini API is not configured");

  const model = getGeminiModel();
  const response = await fetch(
    `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction.slice(0, 12000) }],
        },
        contents: [
          ...history.slice(-12).map((turn) => ({
            role: turn.role,
            parts: [{ text: turn.text.slice(0, 4000) }],
          })),
          {
            role: "user",
            parts: [{ text: prompt.slice(0, 16000) }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      }),
      signal: AbortSignal.timeout(45000),
    }
  );

  const result = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    throw new Error(result.error?.message || `Gemini request failed (${response.status})`);
  }

  const text = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

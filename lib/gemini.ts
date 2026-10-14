import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

/** Returns a Gemini client, or null when no API key is configured. */
export function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

const RETRYABLE = new Set([500, 503, 504]);

/** generateContent with retries, since Gemini intermittently returns 503 "high demand". 429 (quota) is not retried. */
export async function generate(ai: GoogleGenAI, params: GenerateContentParameters, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (i >= attempts || !status || !RETRYABLE.has(status)) throw e;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

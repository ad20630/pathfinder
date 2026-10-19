import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

/** Returns a Gemini client, or null when no API key is configured. */
export function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

const RETRYABLE = new Set([500, 503, 504]);

/** Tried in order after the primary model keeps failing with a retryable error. */
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/**
 * generateContent with retries, since Gemini intermittently returns 503 "high demand". 429 (quota) is not retried.
 * If the primary model is still failing after its retries, falls back to other models.
 */
export async function generate(ai: GoogleGenAI, params: GenerateContentParameters, attempts = 3) {
  const models = [params.model, ...FALLBACK_MODELS.filter((m) => m !== params.model)];
  for (let m = 0; ; m++) {
    for (let i = 1; ; i++) {
      try {
        return await ai.models.generateContent({ ...params, model: models[m] });
      } catch (e) {
        const status = (e as { status?: number }).status;
        // 404 = model retired/unknown: no point retrying it, move on to the next model
        const gone = status === 404;
        if (!status || (!RETRYABLE.has(status) && !gone)) throw e;
        if (gone || i >= attempts) {
          if (m + 1 >= models.length) throw e;
          break;
        }
        await new Promise((r) => setTimeout(r, 400 * i));
      }
    }
  }
}

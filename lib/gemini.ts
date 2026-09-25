import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getEnv } from "@/lib/env";

let cached: GoogleGenAI | undefined;

export function getGemini(): GoogleGenAI {
  if (cached) return cached;
  cached = new GoogleGenAI({ apiKey: getEnv().GEMINI_API_KEY });
  return cached;
}

export class StageGenerationError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StageGenerationError";
  }
}

export interface StructuredResult<T> {
  data: T;
  tokensIn: number;
  tokensOut: number;
  retried: boolean;
}

/**
 * Converts a zod-to-json-schema output node into Gemini's `responseSchema`
 * dialect (an OpenAPI 3.0 subset, not full JSON Schema). Three conversions
 * that are easy to get wrong and are NOT yet verified against a live Gemini
 * response (do this first once GEMINI_API_KEY is available, per the build
 * plan's "test structured output against the real API" step):
 *
 *  1. `type` values must be Gemini's uppercase Type enum strings, not JSON
 *     Schema's lowercase ones.
 *  2. zod's `.nullable()` becomes `{"anyOf":[<inner>,{"type":"null"}]}` (or
 *     `{"type":["x","null"]}` on some zod-to-json-schema versions) - neither
 *     form is valid Gemini schema. Both are collapsed here into the inner
 *     schema plus a `nullable: true` flag, which is what Gemini expects.
 *  3. Gemini's Schema proto declares `minItems`/`maxItems` (used here for
 *     zod's `.length(n)` arrays) as int64-as-string, unlike `minimum`/
 *     `maximum` which stay numeric - so these two keys are stringified.
 *
 * `$refStrategy: "none"` avoids `$ref`/`definitions` entirely (Gemini
 * supports neither), inlining nested schemas instead - fine at this size,
 * none of these schemas are recursive.
 */
function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (node === null || typeof node !== "object") return node;

  const obj = node as Record<string, unknown>;

  // Collapse zod's nullable representations into Gemini's `nullable: true`.
  if (Array.isArray(obj.anyOf) && obj.anyOf.length === 2) {
    const nullBranch = obj.anyOf.find(
      (b) => typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "null",
    );
    const otherBranch = obj.anyOf.find((b) => b !== nullBranch);
    if (nullBranch && otherBranch) {
      return { ...(toGeminiSchema(otherBranch) as Record<string, unknown>), nullable: true };
    }
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (["$schema", "$id", "$ref", "definitions", "additionalProperties", "default"].includes(key)) {
      continue;
    }
    if (key === "type") {
      if (Array.isArray(value)) {
        const nonNull = value.filter((t) => t !== "null");
        out.type = String(nonNull[0]).toUpperCase();
        if (nonNull.length !== value.length) out.nullable = true;
      } else {
        out.type = String(value).toUpperCase();
      }
      continue;
    }
    if ((key === "minItems" || key === "maxItems") && typeof value === "number") {
      out[key] = String(value);
      continue;
    }
    out[key] = toGeminiSchema(value);
  }
  return out;
}

export function zodToGeminiSchema(schema: ZodType<unknown>, schemaName: string): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema, { name: schemaName, $refStrategy: "none" });
  const resolved =
    (jsonSchema as Record<string, unknown>).definitions &&
    (jsonSchema as { definitions: Record<string, unknown> }).definitions[schemaName]
      ? (jsonSchema as { definitions: Record<string, unknown> }).definitions[schemaName]
      : jsonSchema;
  return toGeminiSchema(resolved) as Record<string, unknown>;
}

async function callOnce(params: {
  model: string;
  temperature?: number;
  prompt: string;
  schemaName: string;
  geminiSchema: Record<string, unknown>;
}): Promise<{ raw: string; tokensIn: number; tokensOut: number }> {
  const client = getGemini();
  const response = await client.models.generateContent({
    model: params.model,
    contents: params.prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: params.geminiSchema,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    },
  });

  const raw = response.text;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new StageGenerationError("Model returned no content", params.schemaName);
  }
  return {
    raw,
    tokensIn: response.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/**
 * Runs one LLM stage with a strict JSON schema, validates the result with
 * the same zod schema the Gemini schema was derived from, and retries once
 * with the validation error appended to the prompt on failure. Throws
 * StageGenerationError if the retry also fails validation.
 */
export async function generateStructured<T>(params: {
  stage: string;
  model: string;
  temperature?: number;
  prompt: string;
  schema: ZodType<T>;
  schemaName: string;
}): Promise<StructuredResult<T>> {
  const geminiSchema = zodToGeminiSchema(params.schema, params.schemaName);

  let tokensIn = 0;
  let tokensOut = 0;

  const first = await callOnce({
    model: params.model,
    temperature: params.temperature,
    prompt: params.prompt,
    schemaName: params.schemaName,
    geminiSchema,
  });
  tokensIn += first.tokensIn;
  tokensOut += first.tokensOut;

  const firstParsed = safeJsonParse(first.raw);
  const firstResult = firstParsed.ok ? params.schema.safeParse(firstParsed.value) : null;
  if (firstResult?.success) {
    return { data: firstResult.data, tokensIn, tokensOut, retried: false };
  }

  const validationError = firstParsed.ok
    ? firstResult?.error?.message
    : `Response was not valid JSON: ${firstParsed.error}`;

  const retryPrompt = `${params.prompt}\n\n<previous_attempt_failed_validation>\nYour previous response failed schema validation with this error:\n${validationError}\n\nReturn corrected JSON that matches the schema exactly.\n</previous_attempt_failed_validation>`;

  const second = await callOnce({
    model: params.model,
    temperature: params.temperature,
    prompt: retryPrompt,
    schemaName: params.schemaName,
    geminiSchema,
  });
  tokensIn += second.tokensIn;
  tokensOut += second.tokensOut;

  const secondParsed = safeJsonParse(second.raw);
  const secondResult = secondParsed.ok ? params.schema.safeParse(secondParsed.value) : null;
  if (secondResult?.success) {
    return { data: secondResult.data, tokensIn, tokensOut, retried: true };
  }

  throw new StageGenerationError(
    `Stage "${params.stage}" failed schema validation twice: ${
      secondParsed.ok ? secondResult?.error?.message : secondParsed.error
    }`,
    params.stage,
  );
}

function safeJsonParse(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Transcribes a Telegram voice note (OGG/Opus) verbatim - not a summary, not
 * cleaned-up prose - by sending it as inline audio to the same model used
 * for drafting. Gemini's multimodal models accept audio directly, so this
 * needs no separate transcription API the way Whisper did.
 */
export async function transcribeAudio(buffer: Buffer, _filename: string): Promise<string> {
  const client = getGemini();
  const response = await client.models.generateContent({
    model: getEnv().GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "audio/ogg", data: buffer.toString("base64") } },
          {
            text: "Transcribe this audio verbatim. Do not summarize, clean up filler words, or correct grammar. Return only the raw transcript text, nothing else.",
          },
        ],
      },
    ],
  });
  const text = response.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new StageGenerationError("Transcription returned no content", "ingest");
  }
  return text;
}

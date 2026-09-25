/**
 * USD per 1M tokens, maintained by hand - the Gemini API doesn't expose
 * pricing via API. These are point-in-time rates from ai.google.dev/pricing
 * and will drift; verify against the current page before relying on a cost
 * estimate, and update this when GEMINI_MODEL points at a model that isn't
 * listed here. Not wired into any UI (there isn't one); it's a helper for
 * turning stage_runs token counts into a cost estimate yourself - see the
 * README's "Cost per draft" section.
 *
 * Some Gemini models tier pricing by prompt size (e.g. above/below 200k
 * tokens) - not relevant at this system's prompt lengths, so only the
 * standard (smaller-context) tier is listed.
 */
export const MODEL_PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

/** Returns null for an unlisted model rather than guessing a fabricated cost. */
export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number | null {
  const pricing = MODEL_PRICING_PER_MILLION[model];
  if (!pricing) return null;
  return (tokensIn / 1_000_000) * pricing.input + (tokensOut / 1_000_000) * pricing.output;
}

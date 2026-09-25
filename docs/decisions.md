# Decisions

Open implementation choices not already fixed by the build prompt, each scored on reliability, simplicity, Vercel fit and ease for Meera (1-5), per the Tree-of-Thoughts protocol.

## Postgres driver: `pg` (node-postgres) vs `@neondatabase/serverless` (neon-http)

Options: (a) `@neondatabase/serverless` HTTP driver - reliability 4, simplicity 4, Vercel fit 5, ease for Meera 5 (zero setup difference to her); (b) standard `pg` over TCP - reliability 5, simplicity 4, Vercel fit 4, ease for Meera 5; (c) `@neondatabase/serverless` websocket/Pool mode - reliability 3, simplicity 2, Vercel fit 4, ease for Meera 5.

**Decision: (b) `pg`.** The webhook route runs on the Node.js runtime (not Edge) per the constraints, which supports raw TCP, so the HTTP driver's main advantage (working without TCP sockets) doesn't apply here. `pg` connects identically to Neon in production and to any local or embedded Postgres for tests and evals - `drizzle-orm/neon-http` cannot talk to a non-Neon Postgres at all, which would have made the local eval harness (and any future local dev) impossible without a live Neon branch. `pg` also supports real transactions, which the HTTP driver does not.

## Recent-context (news) lookup: source and how it's allowed to influence a draft

Added post-launch at the user's request, to make drafts feel current when that's genuinely warranted. Two decisions here.

**Source.** Options: (a) a dedicated news API (NewsAPI, SerpAPI, Google Custom Search) - reliability 4, simplicity 3, Vercel fit 4, ease for Meera 2 (needs a new signup/key she'd have to manage); (b) OpenAI's hosted `web_search_preview` tool via the Responses API - reliability 4, simplicity 5, Vercel fit 5, ease for Meera 5 (zero new setup, same `OPENAI_API_KEY` already configured).

**Decision: (b).** The user explicitly wanted this to work "even if it's just the OpenAI API key" - no interest in managing a second vendor account for what's a nice-to-have. Confirmed working against `gpt-4o` in testing (see `lib/pipeline/news.ts`). Not every OpenAI model supports the tool, so the lookup is wrapped to fail open: an unsupported model or any error just means no news context that run, never a blocked draft.

**How it's allowed to influence the draft.** Options: (a) context-only, forbidden from appearing in the draft text at all, only allowed to bias which angle gets selected - reliability 5 (safest), simplicity 5, but doesn't actually make posts *read* as current, which was the whole point; (b) fully citable, treated like a transcript fact - reliability 2 (breaks the "no invented facts" guarantee the rest of the system is built around, since web search results aren't verified against brand-facts.md the way everything else is); (c) usable for general/thematic framing in the draft text (e.g. "renewed attention this month to X"), but any specific number, study, or named claim from it must be placeholdered as `[NEEDS VERIFICATION: ...]` exactly like any other unsourced claim.

**Decision: (c).** Same treatment as the uncited-study eval case (case 3) already established: general themes can be discussed, specific claims need sourcing or a visible placeholder. This lets a draft genuinely read as connected to a current moment without weakening the fact-grounding guarantee anywhere. Verified end to end: a fragment paired with real, current, but topically unrelated news correctly produced a draft that didn't mention the news at all rather than forcing a connection - the prompts explicitly instruct the model to ignore irrelevant recent-context rather than reach for it.

## Regenerate creates a new draft row; Edit mutates the existing one

Options: (a) both mutate the same row in place - reliability 3, simplicity 5, Vercel fit 5, ease for Meera 3 (loses the angle-selection history); (b) both create a new row - reliability 4, simplicity 3, Vercel fit 5, ease for Meera 4 (numbering churns quickly); (c) Regenerate creates a new row (with `revision_of` pointing at the old one, old marked `superseded`), Edit mutates in place - reliability 5, simplicity 4, Vercel fit 5, ease for Meera 5.

**Decision: (c).** Regenerate re-runs angle selection from scratch (a genuinely different candidate, worth its own audit trail and its own "Draft N" number), while Edit is a small, targeted change to the same candidate she's already looking at - re-numbering it would be confusing mid-conversation. This also keeps the dashboard's draft-detail audit trail meaningful: a regenerated draft's angles table is its own angle-selection run, not a mutated fragment of the old one.

## Post-edit critique must not undo the edit

Discovered as a real bug during eval case 7 ("shorter, drop the Skinstinct line"): the generic critique pass, unaware the text had just been intentionally shortened by Meera's own instruction, tried to pad the length and reintroduce a Skinstinct-style line to satisfy the generic length/specificity checklist items - directly undoing her edit.

Options: (a) skip critique entirely after an edit, only re-run deterministic checks - reliability 5, simplicity 5, but loses the voice-checklist pass the spec asks for; (b) run critique with an `editInstruction` flag that tells it to treat the shortened/changed text as intentional and not fight it - reliability 5, simplicity 4.

**Decision: (b).** `runCritiqueLoop` now takes an optional `editInstruction`; when present, the critique prompt is told explicitly that checklist items 5 (specificity) and 9 (length) may legitimately fail post-edit and must not be "fixed" by adding content back. See `lib/pipeline/critique.ts` and `prompts/critique.ts`.

## Lexicon/spelling/named-competitor checks are maintained code lists, not parsed from lexicon.md at runtime

The "Avoid" section of `references/lexicon.md` mixes bare words with parenthetical caveats ("clinically proven (unless literally true and specified)") that aren't reliably machine-parseable. `lib/checks/lexicon.ts` and `lib/checks/spelling.ts` instead hold maintained arrays that mirror the source files' intent, with a comment pointing back at the source section to keep in sync. The "no named competitors" rule similarly isn't checkable by a fixed word list (a competitor's name isn't predictable), so it's enforced as an explicit item in the critique LLM's checklist (item 11, added beyond SKILL.md's 10) rather than as a deterministic code check - the deterministic checks catch mechanics and vocabulary; judgment calls like "is this a competitor name" stay with the critique LLM, same as the spec's own split between deterministic checks and an LLM judge.

## Dashboard removed per explicit request mid-build

The original brief specified a password-protected dashboard (home stats, drafts list, draft detail) styled after "Why Talkie." It was built, tested (login/middleware verified live in a browser; build and typecheck clean), and then removed at the user's explicit instruction to keep the system Telegram-only. The DB schema still logs per-stage token usage (`stage_runs`) since that's independently useful for cost auditing even without a UI to show it.

## `maxDuration = 300` on the webhook route

Assumes a Vercel Pro plan or above (Hobby caps a serverless function at 60s, which the transcription-plus-4-to-5-LLM-call pipeline can exceed). This is documented in the README's deployment checklist; if deploying on Hobby, either upgrade or reduce this value and expect intermittent timeouts on richer drafts.

## News source switched from OpenAI web search to Google News RSS

The recent-context lookup originally used OpenAI's hosted `web_search_preview` tool (see the earlier entry above about source/framing choices). Switched at the user's request after two problems: (1) the tool carries its own per-call pricing on top of normal tokens, adding real cost to every single draft; (2) it's an LLM synthesizing prose from search results, which is itself a hallucination surface - it could paraphrase or misattribute a source, on top of everything downstream.

**Decision: Google News RSS** (`https://news.google.com/rss/search`, no API key, plain HTTP + XML). Options considered: (a) OpenAI web search - reliability 4, simplicity 5, cost 2 (extra per-call charge), ease for Meera 5; (b) a dedicated news API (NewsAPI, SerpAPI) - reliability 4, simplicity 3, cost 3, ease for Meera 2 (new signup); (c) Google News RSS - reliability 4, simplicity 4, cost 5 (free), ease for Meera 5. (c) wins on the dimension that mattered here (cost), and as a side effect removes the LLM-paraphrasing risk entirely: results are literal titles/links/dates, not synthesized text. Relevance is looser than a dedicated search tool would give (keyword matching, not semantic), but the angle/draft prompts already have to filter for genuine relevance regardless of source, so this doesn't change the downstream contract.

## Two real hallucination bugs found via live use, both fixed at the prompt layer

Found by inspecting an actual delivered draft (not a synthetic test): its hook asserted "at last month's beauty expo, the talk was all about layering order" - a scene that existed in neither the source transcript nor the fetched news context. Traced to its origin: the **angles stage** invented it to fill the `industry_moment` hook_type slot (one of four required categories for angle diversity), then rated its own `fact_risk` as 1 (lowest) and omitted the fabricated scene from its own `depends_on_facts` list - so the "prune if it depends on an unlisted fact" safeguard couldn't catch it, because the model didn't honestly declare the dependency. Critique also passed it: the 10-point voice checklist has no item that checks scene/event grounding specifically, and the deterministic code checks only look for numeric tokens, so a fabricated non-numeric claim is invisible to both.

A second, subtler variant turned up while re-testing the same fragment: a real number from brand-facts.md (`23% of returns cited texture/feel complaints`) got restated as a different, unsupported claim (`23% of returns came from layering errors`). This is more dangerous than an outright invented number, since the digit is real and would pass any check that only verifies numeric presence (which is exactly what `lib/checks/numbers.ts` does - it can't verify *what a number is claimed to measure*, only whether the digits appear in the grounding text).

**Fix, at three points, all prompt-level** (no code-level check can reliably verify semantic grounding of arbitrary prose, so this is squarely the same category of fix as the earlier "no named competitors" rule - a judgment call the critique LLM enforces, not something regex can do):
1. `prompts/angles.ts`: `dated_scene`/`industry_moment` hook types are now only permitted when `intake.facts` genuinely contains a scene/date/event; the PRUNE step is told to check the hook's actual content against `intake.facts`, not trust the self-reported `depends_on_facts` list; and a new rule requires a number to stay paired with exactly what it measured, not be restated as a different claim.
2. `prompts/draft.ts`: the same two rules (no invented occasions, no repurposed numbers), as a second checkpoint independent of angle selection.
3. `prompts/critique.ts`: a new item 12 explicitly checks both failure modes as a backstop, on the theory that the first two checkpoints will still occasionally miss something and a dedicated critique pass should exist for exactly this, the same way item 11 exists for named competitors.

Verified by re-running the exact fragment that produced the original bug four times post-fix: no fabricated scene appeared in any run, and two newly-invented statistics (in different runs) were correctly caught and pruned before reaching selection - a result the pre-fix prompts had not produced even once in testing.

## Migration: OpenAI -> Gemini, Neon -> Supabase (post-launch, at operator request)

The system above was built and verified end-to-end against OpenAI + Neon. It was then migrated to Gemini (no OpenAI key available/wanted) and Supabase Postgres (operator preference, no Neon account). Two decisions worth recording.

**LLM client layer: single-file swap, same public contract.** All OpenAI calls were isolated in `lib/openai.ts` behind two functions (`generateStructured<T>()`, `transcribeAudio()`). This meant the migration to `lib/gemini.ts` (using `@google/genai`, the current unified Google Gen AI SDK - `@google/generative-ai` is the superseded predecessor, last published April 2025 vs. `@google/genai`'s active releases) touched exactly one new file plus an import-path/env-var-name change in each of the 6 call sites (`intake.ts`, `angles.ts`, `draft.ts`, `critique.ts`, `revise.ts`, `ingest.ts`) and `run.ts`/`actions.ts` - no pipeline logic changed. This is the payoff of the original decision to isolate the provider SDK behind a narrow interface rather than calling `OpenAI`/`client.chat.completions` directly from each stage.

**Structured output: zod -> Gemini's `responseSchema`, not zod -> OpenAI's `json_schema` mode.** Gemini's `responseSchema` is an OpenAPI 3.0 subset, not JSON Schema - `zod-to-json-schema`'s output (used as-is for OpenAI) needs conversion: uppercased `Type` enum strings instead of lowercase JSON Schema types, `nullable: true` instead of a `.nullable()` null-union (`anyOf`/array-type), and `minItems`/`maxItems` as strings (int64-as-string in the underlying proto) rather than numbers, unlike `minimum`/`maximum` which stay numeric. `$refStrategy: "none"` avoids `$ref`/`definitions` entirely, which Gemini's schema dialect doesn't support - acceptable here since none of the five stage schemas are recursive. This conversion (`lib/gemini.ts::zodToGeminiSchema`) is unit-tested for shape (`lib/__tests__/gemini-schema.test.ts`) but **not yet confirmed against a live Gemini response** - per the build plan's own instruction to verify structured output against the real API before trusting a stage, do that first once `GEMINI_API_KEY` is available, and re-run `npm run eval` (last verified 10/10 against `gpt-4o`, pre-migration) before treating any stage as production-verified on the new backend.

**Transcription: decoupled call stays decoupled, but collapses to one model.** OpenAI required a second model (`OPENAI_TRANSCRIBE_MODEL`, Whisper) for audio. Gemini's multimodal models accept inline audio directly, so `transcribeAudio()` now sends the OGG/Opus buffer as an `inlineData` part with an explicit "transcribe verbatim, don't summarize" instruction to the same `GEMINI_MODEL` used everywhere else - one fewer env var, same call shape (still its own function, still its own pipeline stage, per the original architectural-parity reasoning even though it's one vendor call rather than two).

**Database: no driver change, confirming the earlier `pg`-over-`@neondatabase/serverless` decision paid off twice.** The DB layer already used plain `pg`/`drizzle-orm/node-postgres` specifically so it would work against "any local or embedded Postgres," not just Neon (see the driver decision above). Moving to Supabase was purely a `DATABASE_URL` swap (Supabase's pooled "Transaction" mode connection string, port 6543) - no code in `lib/db/client.ts`, `drizzle.config.ts`, or `scripts/migrate.ts` changed.

**Pricing table replaced, not extended.** `lib/pricing.ts`'s OpenAI rate card was fully replaced with a Gemini one (`gemini-2.5-pro/flash/flash-lite`, `gemini-2.0-flash`) rather than kept alongside - the system only ever points `GEMINI_MODEL` at one provider at a time, so a merged table would just be dead weight. Same "point-in-time snapshot, verify before relying on it" caveat as before.

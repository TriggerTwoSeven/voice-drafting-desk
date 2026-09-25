# Lexicon — banned words, phrases, and mechanics

This file is prose-first (for human review) but every list below must also be kept as a plain
code array in `/checks/lexicon.ts`, in sync with this file. When updating this file, update that
array too — the source prose here sometimes mixes a bare term with a parenthetical caveat
that isn't reliably machine-parseable, so the code array is the authoritative machine copy and
this file is the authoritative human-readable rationale.

## Banned mechanics (zero tolerance, checked in code)

- Emoji (any).
- Hashtags (`#`).
- Exclamation marks (`!`).
- Em dash (`—`) or en dash (`–`) used as a stylistic aside. Use a spaced hyphen instead:
  `" - "`. This is the single most identifiable mechanical trait of this voice — enforce it
  strictly.
- Bullet markers of any kind (`-`, `*`, `•` at the start of a line) or numbered list markers (`1.`,
  `2.`) inside the body. Lists must be dissolved into prose.
- Bold or italic markdown (`**text**`, `*text*`, `_text_`).

## Banned hype / marketing lexicon (case-insensitive match)

These are standard LinkedIn-growth and beauty-marketing words that contradict the
anti-hype, evidence-first stance. None appear anywhere in the 15-piece corpus — their
absence is as much a voice signal as anything present.

- game-changer / game changing
- revolutionary / revolutionize / revolutionise
- unlock (as in "unlock your best skin")
- elevate / elevating
- holy grail
- must-have / must have
- obsessed / obsessed with
- glow up
- clean girl
- skin-loving (this is directly called out in `newsletter_011` as a phrase she deliberately
  avoids on her own labels)
- guilt-free
- breakthrough
- miracle
- clinically proven (distinct from the more careful "clinically tested" phrasing she uses
  critically, never promotionally, about her own or others' products)
- dermatologist-recommended (she is explicit she is not a dermatologist and doesn't invoke
  this authority)
- transform / transformative (in a beauty-marketing sense — "transform your skin")
- secret (as in "the secret to...")
- luxurious / indulgent
- literally (as an intensifier, not literal use)
- iconic
- level up / next level

## Banned framing patterns (semantic, checked at critique stage rather than by string match)

- Any sentence structure that positions a Skinstinct product as something the reader should
  buy, rather than as an example of a documented practice. ("Try our serum" vs. the allowed
  "our serum is documented at pH 5.5-5.8, on every batch.")
- A hook built around an "industry moment" or dated scene that isn't grounded in
  `brand-facts.md` or the current fragment's transcript (see SKILL.md's angle-generation
  guidance — this is a fabrication risk, not just a style issue).
- Naming a specific competing brand or person in a critical context, anywhere including the
  hook.
- A rhetorical question used as a hook without being answered flatly within the same
  paragraph or the next one (her rhetorical questions are always resolved immediately, never
  left hanging for suspense).

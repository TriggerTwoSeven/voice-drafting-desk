# Spelling convention — British English

Meera writes in British English throughout the corpus (`oxidise`, `colour`, `moisturiser`,
`labelled`, `sensitisation`, `organisation`, `categorisation`, `hyperpigmentation` reads the same
in both variants). Every American spelling below that appears in a draft should be corrected to
its British equivalent before delivery. This list should be kept as a plain `{american: british}`
mapping in `/checks/spelling.ts`, in sync with this file.

Confirmed directly from the corpus (`-ise` not `-ize`, `-our` not `-or`, doubled consonant before
suffix):

| American | British |
|---|---|
| oxidize | oxidise |
| sensitization | sensitisation |
| organization | organisation |
| categorization | categorisation |
| color | colour |
| moisturizer | moisturiser |
| labeled | labelled |
| standardized | standardised |

Extended mapping (same rule families, not yet directly attested in the corpus but consistent
with the established convention — apply the same `-ise`/`-our`/doubled-consonant/`-re`
patterns):

| American | British |
|---|---|
| specialize | specialise |
| emphasize | emphasise |
| personalize | personalise |
| minimize | minimise |
| recognize | recognise |
| analyze | analyse |
| criticize | criticise |
| characterize | characterise |
| finalize | finalise |
| summarize | summarise |
| favorite | favourite |
| behavior | behaviour |
| flavor | flavour |
| honor | honour |
| favor | favour |
| defense | defence |
| license (noun) | licence |
| meter (unit) | metre |
| liter | litre |
| aging | ageing |
| fiber | fibre |
| judgment | judgement |
| traveling | travelling |
| modeling | modelling |
| canceled | cancelled |
| counselor | counsellor |
| gray | grey |
| mold | mould |
| practice (verb) | practise |
| program | programme |
| skeptic / skeptical | sceptic / sceptical |

## Notes

- `license` as a verb keeps `-se` in British English too (`licensed`); only the noun changes to
  `-ce`. Same pattern for `practice`/`practise`.
- `program` → `programme` applies to the general noun (a stability-testing programme); a
  software program stays `program` even in British English — unlikely to come up in this
  voice, noted for completeness.
- Numbers, units, and dates stay as written elsewhere in the voice-skill (metric units, DD Month
  YYYY date form as seen in the corpus's news-citation example format).

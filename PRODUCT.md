# Rental Helper — product design and implementation status

Updated **2026-09-22**. This document separates the implemented local prototype from the target experience. [README](README.md) introduces the project; [ROADMAP](ROADMAP.md) defines unfinished work and acceptance criteria; [development guide](docs/DEVELOPMENT.md) covers setup and architecture.

## Product outcome

Help tenants compare homes they already found, understand the evidence behind their differences, and discover what matters through an interactive conversation. A successful session ends with confirmed priorities, visible compromises, and useful questions for a viewing or agent.

The tenant supplies candidates first. Do not start with a free-text “暮らしの希望” form or a requirements questionnaire. Similarities among candidates are hypotheses, not proof of a preference. OCR supports entry; examining OCR output is not the main experience.

## Current progress

“Implemented” means code exists in this working tree, not that it is deployed or every provider response has been validated live.

| Area | Implemented behavior | Remaining boundary |
| --- | --- | --- |
| Candidate intake | Image and HTTPS listing-link entry; manual addition/editing; incomplete candidates allowed; up to six candidates. | Websites may be inaccessible; URL import depends on Gemini retrieval. |
| Image extraction | Server-side Docling/RapidOCR; Gemini maps text to fields and costs; original regions, text, warnings and provenance remain inspectable. | OCR/mapping can fail. Recorded sample mappings use checked ground truth, not a benchmark of live Gemini accuracy. |
| Comparison | Rent + management fee, initial-cost estimate, layout/area, station walk, age, optional equipment/contracts; detail panels and glossary. | Listed station walking time is not a commute. Initial cost is an estimate with incomplete inputs visible. |
| Missing monthly charges | Automatic research for named/addressed candidates missing rent or management fee; sequential requests; daily cooldown for unchanged candidates; saved results. | Provider availability and identity can prevent filling a gap. Other missing fields remain selectable proposals. |
| Source matching | Current, non-conflicting, cited exact-unit offers can fill missing monthly fields. Same-building offers appear as reference prices with sources and dates. | References never become confirmed rent or enter budget/initial-cost calculations. Existing confirmed values are preserved. |
| Walking access | Google Geocoding, Places (New), and WALK Routes check recognized station/amenity claims and nearby essentials. | No work-destination transit routes, leisure personalization, resident reviews, or guarantee of real-world conditions. |
| AI discovery | Gemini analyzes candidate evidence, asks a focused question, cites supplied evidence IDs and proposes priorities; the tenant must accept a proposal. | Broad conversational quality remains unevaluated; citations validate references, not every interpretation. |
| Preference comparison | Confirmed budget, listed station-walk and area limits produce fit/conflict/unknown explanations. Narrative preferences and unresolved questions enter the memo. | No overall ranking. Narrative preferences do not automatically become numeric scores. |
| Takeaway | Editable/copyable memo, chosen equipment, contract questions, confirmed preferences and unknowns. | No hosted shared comparisons or PDF report flow. |
| Persistence | IndexedDB saves candidates, image blobs, answers, preferences, memo edits and eligible conversation history; deletion control included. | Local to browser/origin. Maps observations and conversations reproducing them are temporary; accepted preferences persist. |
| UI | Guided comparison workspace with five concern views, adjacent numeric/AI questions, confirmed-priority pills, and a separate memo. Mobile pair selection and a question panel; keyboard navigation and reduced motion. | Screenshots show the local build; the public demo currently serves an earlier interface. |

## Interaction contract

1. **Bring candidates.** Add an image or link without knowing all requirements. Missing/disputed information stays visible.
2. **Understand differences.** Compare costs, space, access, equipment and contracts. Open a value for its source or calculation.
3. **Explore one question.** AI uses available evidence; the numeric fallback works without AI. Offer deferral and contextual follow-up.
4. **Confirm a priority.** A tentative selection or AI proposal is not a requirement. Confirmation updates the comparison and memo; the tenant can reconsider.
5. **Take the next step.** Leave with an editable brief and questions that would change the decision. Preserve the session locally.

Future work-destination and leisure questions belong after candidate analysis. A workplace cannot be inferred from a listing: request the destination when the tenant chooses to examine commuting. Ask for a place/address and relevant schedule, not an upfront lifestyle essay.

### Workspace behavior

- Cost, space/building, access, equipment/contracts and full-list tabs change the comparison and question context. Selecting a view does not confirm a preference.
- At widths of 760 px or less, show two selected candidates side by side. Selecting the other slot swaps them; removing a selected candidate fills the slot from remaining candidates. Desktop preserves the full shortlist in input order, with horizontal scrolling when needed.
- Numeric questions use known values from the displayed candidates and the current concern. Tentative choices require a second importance confirmation. Confirmed pills can reopen that question.
- The AI receives the selected concern, displayed candidate evidence, available Maps observations and confirmed context. A changed concern or pair invalidates the displayed reply and cancels pending requests; stale retries cannot cross contexts.
- On mobile, questions open in a modal bottom panel with Escape/close and focus return. Moving back to desktop restores the panel beside the comparison.
- Confirmed priorities remain global to the shortlist. Equipment/contract choices and the final memo cover all candidates. View and mobile pair selection are temporary; user work remains saved.

## Evidence contract

| Type | What the UI may say | What it must not imply |
| --- | --- | --- |
| Listing fact | “This listing states…” with original image/page. | Current availability or independent verification of every detail. |
| Exact-unit researched price | Identified building, address, room, source and listing/retrieval dates. | Another unit's price applies to this candidate. |
| Building reference | “102号室 is listed at this amount; candidate room unconfirmed.” | A reference price is a completed budget check. |
| Maps observation | Resolved address, place, mode, route estimate, business status, retrieval time. | The entrance, walking experience, opening status, safety or quietness is guaranteed. |
| AI interpretation | Explanation linked to evidence and confirmed preferences. | A prediction or unaccepted preference is a fact. |
| Review — planned | Attributed experience, date, source and reviewed entity. | A nearby café review describes the apartment's resident experience. |

Unknown is valid. Provider errors must remain errors, never fabricated facts or canned answers presented as live AI. Keep candidate order stable; explain fit by priority instead of making the final housing decision for the tenant.

## Existing integration details

### Listing research

`POST /api/research-listing` uses Gemini Google Search/URL context, then maps cited excerpts into structured offers. Building archives, historical terms and unmatched units cannot fill unit-specific fields. Automatic monthly updates also require identity in cited text and no conflicting exact-unit offers. Failures have retry controls rather than retrying on every render.

GRAN PASEO明大前Ⅳ illustrates the distinction: its multi-type brochure has no room number or rent. A [HOME’S listing for 102号室](https://www.homes.co.jp/chintai/b-1525240063688/) showed rent ¥113,000 + management ¥10,000, listing update 2026-09-21, retrieved 2026-09-22. The app records **参考 12.3万円/月**, with room/source visible. This is a recorded research observation, not a successful live Gemini lookup or an availability guarantee.

### Maps

`POST /api/check-maps` requires an unambiguous, non-partial rooftop/interpolated geocode. It preserves listing claims and shows the resolved address for inspection. Recognized claims are matched by normalized destination name, category and proximity. Ambiguous/unnamed destinations remain unverified.

Nearby search covers stations, supermarkets and convenience stores within 1.5 km, up to three per category ordered by straight-line distance. Walking routes are shown for those results; selection is not exhaustive or guaranteed nearest by walking time. Differences of at least 3 minutes or 100 m are review cues. Retrieval time is not the map data's update date. Changed addresses/claims invalidate results.

### Advice and sessions

`POST /api/advise` receives candidate evidence, available Maps observations, confirmed priorities and conversation answers. Insights/questions reference evidence IDs. Proposals require a literal quote from a user answer and explicit acceptance. Failed answers remain available for retry; changed evidence invalidates previous AI output.

IndexedDB stores user work. Uploaded images may be saved locally; server-side extraction handles images in request memory. Gemini receives extracted text for extraction and candidate/conversation data for advice, rather than image pixels. Provider secrets remain on the server.

## Validation and release state

- **2026-09-22:** `npm test` — 86 frontend + 83 backend tests passed; 2 real-OCR tests skipped. Covers calculations, uncertainty, matching, automatic research, stale-response rejection, proposals, provider errors and storage boundaries.
- Browser checks cover desktop/mobile flows, keyboard tabs, mobile pair swapping, question panel focus/resize, contextual AI requests and stale-response rejection with provider stubs, explicit confirmation, memo/image restoration, reference-price details, automatic exact-unit filling with a stubbed provider, and no duplicate lookup after reload.
- Earlier local live checks confirmed Geocoding, Places and WALK Routes access. A small Gemini request succeeded; full candidate conversations and the latest automatic research check encountered provider busy responses. Full live end-to-end quality remains an open release task.
- The public GitHub Pages demo responded on 2026-09-22 but serves the earlier UI. Current source/screenshots must not be described as already deployed. Pages hosts static files; live services need a separately configured API.
- No tenant usability study or measured decision-quality improvement is claimed.

## Next milestone

Complete **one work destination → comparable commute evidence → one confirmed tradeoff → updated memo**. Then extend the same loop to leisure preferences. See [R1–R3 in ROADMAP](ROADMAP.md#r1--commutes-to-a-work-destination).

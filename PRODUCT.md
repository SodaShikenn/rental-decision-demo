# Rental Helper — product design and implementation status

Updated **2026-09-22**. This document separates the implemented local prototype from the target experience. [README](README.md) introduces the project; [ROADMAP](ROADMAP.md) defines unfinished work and acceptance criteria; [development guide](docs/DEVELOPMENT.md) covers setup and architecture.

## Product outcome

Help tenants compare homes they already found, understand the evidence behind their differences, and discover what matters through an interactive conversation. A successful session ends with confirmed priorities, visible compromises, and useful questions for a viewing or agent.

The tenant supplies candidates first. The app analyzes them and offers grounded choices; it has no personal viewing diary, free-text requirement form, or manually editable decision brief. Do not start with a free-text “暮らしの希望” form or a requirements questionnaire. Similarities among candidates are hypotheses, not proof of a preference. OCR supports entry; examining OCR output is not the main experience.

## Current progress

“Implemented” means code exists in this working tree, not that it is deployed or every provider response has been validated live.

| Area | Implemented behavior | Remaining boundary |
| --- | --- | --- |
| Candidate intake | Image and HTTPS listing-link entry; manual addition/editing; incomplete candidates allowed; up to six candidates. | Websites may be inaccessible; URL import depends on Gemini retrieval. |
| Image extraction | Server-side Docling/RapidOCR; Gemini maps text to fields and costs; original regions, text, warnings and provenance remain inspectable. | OCR/mapping can fail. Recorded sample mappings use checked ground truth, not a benchmark of live Gemini accuracy. |
| Comparison | Rent + management fee, initial-cost estimate, layout/area, station walk, age, optional equipment/contracts; detail panels and glossary. | Listed station walking time is not a commute. Initial cost is an estimate with incomplete inputs visible. |
| Missing monthly charges | Automatic research for named/addressed candidates missing rent or management fee; sequential requests; daily cooldown for unchanged candidates; saved results. | Provider availability and identity can prevent filling a gap. Other missing fields remain selectable proposals. |
| Source matching | Current, non-conflicting, cited exact-unit offers can fill missing monthly fields. Same-building offers appear as reference prices with sources and dates. | References never become confirmed rent or enter budget/initial-cost calculations. Existing confirmed values are preserved. |
| Walking access | Google Geocoding, Places (New), and WALK Routes check recognized station/amenity claims and nearby essentials. | Listing walk is separate from scheduled commute; real-world conditions are not guaranteed. |
| AI discovery | Gemini analyzes candidate evidence, asks a focused question, cites supplied evidence IDs and proposes priorities; the tenant must accept a proposal. | Broad conversational quality remains unevaluated; citations validate references, not every interpretation. |
| Preference comparison | Confirmed budget, listed station-walk and area limits produce fit/conflict/unknown explanations. Narrative preferences and unresolved questions enter the memo. | No overall ranking. Narrative preferences do not automatically become numeric scores. |
| Commute | Select a Tokyo hub or enter a destination; open each candidate’s outbound/return route directly in Google Maps, prefilled with endpoints and transit/walking mode. Show editable 08:00 arrival / 18:00 departure reminders. | Works without an API key/backend. Official Maps URLs cannot carry date/time: users set these in Maps and confirm resolved locations. Clicking does not retrieve route evidence or confirm a preference. In-app Japan transit time comparison needs another provider. |
| Leisure | Parks/gyms/cafés, dated WALK observations, named regular destination, frequency/importance confirmation. | Max 2/category within 1.5 km by straight-line distance; not exhaustive. Hours and activity suitability require verification. |
| Scenarios | Change weekly frequency; compare known monthly cost, selected commute objective, outbound/round-trip estimates (only when both legs exist) and accepted leisure interests. | No hidden total score; no invented return journey, fares or data for missing routes. |
| Reviews | Automatically search public apartment-review sites/posts on entering the review page or changing candidate. Show cited AI summaries, matched building/address, unit scope and explicit nearby references. | Public retrieval is not exhaustive; summaries do not prove residency or current conditions. Live GRAN PASEO search completed with no usable reviews after building/nearby fallback; matched-review display remains to be validated. |
| Takeaway/sharing | Automatically generated, read-only/copyable memo, HTML download, content preview, optional personal details, 1–7 day SQLite-backed links and owner revocation. | Shared links require a reachable API. Images/eligible chat are local HTML only; provider routes and review text are excluded. Single-instance storage; no accounts. |
| Persistence | IndexedDB saves candidates, image blobs, answers, preferences, eligible conversation history; deletion control included. | Local to browser/origin. Maps observations and conversations reproducing them are temporary; accepted preferences persist. |
| UI | Eight feature tabs (mobile grouped dropdown), dedicated feature pages with candidate scope and instructions; five comparison concerns, adjacent numeric/AI questions, confirmed-priority pills, and separate memo/sharing views. Mobile pair selection and a question panel; keyboard navigation and reduced motion. | Repository screenshots show the recorded candidate workflow; live services require a configured backend. |

## Interaction contract

1. **Bring candidates.** Add an image or link without knowing all requirements. Missing/disputed information stays visible.
2. **Understand differences.** Compare costs, space, access, equipment and contracts. Open a value for its source or calculation.
3. **Explore one question.** AI uses available evidence; the numeric fallback works without AI. Offer deferral and contextual follow-up.
4. **Confirm a priority.** A tentative selection or AI proposal is not a requirement. Confirmation updates the comparison and memo; the tenant can reconsider.
5. **Take the next step.** Leave with a generated brief and questions that would change the decision. Preserve the session locally.

Work-destination and leisure questions follow candidate comparison. A workplace cannot be inferred from a listing: request the destination when the tenant chooses to examine commuting. Ask for a place/address and relevant schedule, not an upfront lifestyle essay.

### Workspace behavior

- Top navigation exposes comparison, commute, essentials, leisure, review analysis, scenarios, memo and sharing. The phone dropdown lists all eight pages, grouped by task. Primary feature forms are immediately visible, without an extra disclosure.
- Hash links, browser Back/Forward and keyboard tab navigation select the same page. Legacy feature anchors resolve to the corresponding page. View changes hide/show existing DOM; they do not remount modules or discard in-memory results. Reload still clears temporary provider data.
- Candidate scope is shown on feature pages. Essentials checks cover the entire shortlist, including on mobile; the two-candidate selector is local to the comparison table.

- Cost, space/building, access, equipment/contracts and full-list tabs change the comparison and question context. Selecting a view does not confirm a preference.
- At widths of 760 px or less, show two selected candidates side by side. Selecting the other slot swaps them; removing a selected candidate fills the slot from remaining candidates. Desktop preserves the full shortlist in input order, with horizontal scrolling when needed.
- Numeric questions use known values from the displayed candidates and the current concern. Tentative choices require a second importance confirmation. Confirmed pills can reopen that question.
- The AI receives the selected concern, displayed candidate evidence, available Maps observations and confirmed context. A changed concern or pair invalidates the displayed reply and cancels pending requests; stale retries cannot cross contexts.
- On mobile, questions open in a modal bottom panel with Escape/close and focus return. Moving back to desktop restores the panel beside the comparison.
- Occasional overlays use short directional transitions; keyboard actions and reduced-motion preferences remain immediate. Touch controls use capability-gated hover, readable input sizes and safe-area spacing. [Interface decisions](docs/UI_DESIGN.md) document ownership and validation.
- Confirmed priorities remain global to the shortlist. Equipment/contract choices and the final memo cover all candidates. View and mobile pair selection are temporary; user work remains saved.

## Evidence contract

| Type | What the UI may say | What it must not imply |
| --- | --- | --- |
| Listing fact | “This listing states…” with original image/page. | Current availability or independent verification of every detail. |
| Exact-unit researched price | Identified building, address, room, source and listing/retrieval dates. | Another unit's price applies to this candidate. |
| Building reference | “102号室 is listed at this amount; candidate room unconfirmed.” | A reference price is a completed budget check. |
| Maps observation | Resolved address, place, mode, route estimate, business status, retrieval time. | The entrance, walking experience, opening status, safety or quietness is guaranteed. |
| AI interpretation | Explanation linked to evidence and confirmed preferences. | A prediction or unaccepted preference is a fact. |
| Building-place report | Attributed post, date, source and confirmed building place. | The author is a verified resident, or the statement applies to the exact unit. |

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

Opening **口コミ分析** or selecting another candidate automatically searches public web reviews using the building name, address, room and source link. It does not send images or personal notes. A bounded 30-minute session cache avoids repeat calls during navigation; manual refresh is available. Errors also wait for explicit retry or cache expiry, rather than triggering an automatic retry loop.

Search order is enforced in code: exact room (when known) → same building → at most three other residential buildings within 300 m, located and distance-checked with Maps. Stop at the first tier with usable reviews. Nearby opinions identify their actual building/address and straight-line distance, and never establish conditions in the target home. A successful empty search leaves the review area blank; provider failures remain errors.

Only provider-cited text supports the returned summaries. Name/address must match within evidence attributed to the same source. Same-unit, building-level and other-unit reports stay distinct; advertisements, general neighborhood claims and inaccessible or unmatched pages are excluded from the review list. Results label AI summaries, unknown posting dates and source links. Retrieval dates are not posting dates. Search/identity checks reduce wrong attachments but are not proof of a source's accuracy or an exhaustive crawl. Missing-address candidates cannot receive matched reviews until their identity is established.

Commute/leisure/review provider content remains in memory. Confirmed intentions persist; a changed candidate identity/address invalidates observations. Web review summaries and source links are temporary and never sent to the advisor or saved in a share. Only generic viewing questions explicitly accepted by the tenant persist.

Sharing stores only an allowlisted brief, source links, confirmed intentions and explicitly included personal fields. Read/delete tokens are hashed; expiry is enforced on reads and expired rows are cleaned during access. A separate owner secret authorizes revocation. Links grant access to anyone who possesses them; downloaded copies cannot be revoked.

IndexedDB stores user work. Uploaded images may be saved locally; server-side extraction handles images in request memory. Gemini receives extracted text for extraction and candidate/conversation data for advice, rather than image pixels. Provider secrets remain on the server.

## Validation and release state

- **2026-09-22:** `npm test` — 114 frontend + 135 backend tests passed; 2 real-OCR tests skipped. Covers calculations, uncertainty, matching, automatic research, stale-response rejection, proposals, provider errors and storage boundaries.
- Browser checks cover desktop/mobile flows, keyboard tabs, mobile pair swapping, question panel focus/resize, contextual AI requests and stale-response rejection with provider stubs, explicit confirmation, memo/image restoration, reference-price details, automatic exact-unit filling with a stubbed provider, and no duplicate lookup after reload.
- Local live checks confirmed image extraction, SUUMO import, same-building rent research, two-turn AI advice/confirmation, Geocoding, Places, WALK and empty-review fallback after quota recovery and a research-schema fix. Public end-to-end deployment and broader quality evaluation remain open.
- Pages hosts the static app; online research, routes, reviews, advice and shared links need a separately configured API. See the dated [validation record](docs/VALIDATION.md) for actual provider outcomes and the [code tour](docs/CODE_TOUR.md) for module boundaries.
- No tenant usability study or measured decision-quality improvement is claimed.

## Next milestone

Deploy and verify a public API, durable sharing and a full live demonstration film. Validate matched web-review retrieval for representative buildings. In-app Japanese transit comparison remains a future extension; the current release uses Google Maps handoff. See the remaining [roadmap](ROADMAP.md).

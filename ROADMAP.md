# Rental Helper — implementation and remaining validation

Updated **2026-09-22**. Checked items describe implemented, tested behavior. Open items remain required before claiming complete provider coverage or production readiness. [Product](PRODUCT.md) · [Code tour](docs/CODE_TOUR.md) · [Validation](docs/VALIDATION.md)

| Milestone | Implementation | Remaining acceptance work |
| --- | --- | --- |
| R0 — release | Guided workspace and repeatable test/browser workflow | Public API, real Gemini evaluation, tenant usability study |
| R1 — commute | Tokyo hubs/custom address, direct outbound/return Maps links, schedule reminders; no API required | Tenant handoff evaluation; in-app transit comparison is a future extension |
| R2 — leisure | Real nearby options, regular destination, frequency/importance confirmation | Broader real-world hours/route evaluation |
| R3 — scenarios | Frequency, cost, route objective, leisure evidence, missing-value explanations | Evaluate competing objectives with tenants |
| R4 — reports | Room → building → nearby fallback, cited analysis and evidence-linked choices | Real matched-building display; verified resident-source coverage |
| R5 — sharing | Preview, HTML, expiring/revocable SQLite links | Public HTTPS API and durable-host verification |

## R0 — validate and release the current prototype

- [x] Preserve comparison/discovery together, mobile pair selection, evidence details and explicit confirmation.
- [x] Add a repeatable browser smoke workflow with provider stubs and a real local sharing lifecycle.
- [x] Separate implementation, stub validation and live results in documentation.
- [ ] Re-run real image extraction, URL import, price research and full candidate advice when Gemini is available; record latency, request cost and source-match correctness.
- [ ] Run a small tenant usability study and validate claims against measured results.
- [ ] Deploy the backend; verify live API behavior from the public frontend.

## R1 — commutes to a work destination

- [x] Suggest a Tokyo hub from candidate areas; preserve the user's explicit selection and allow a custom destination.
- [x] Display outbound and return Google Maps buttons immediately for every locatable candidate. Prefill endpoints and transit/walking mode, without calling an API.
- [x] Show next Japan weekday (holidays not detected), 08:00 arrival / 18:00 departure as editable reminders. Explain that official Maps URLs cannot carry date/time.
- [x] Test reversed endpoints, encoded addresses, missing locations, length limits, custom destination changes, external-tab opening and absence of provider requests.
- [x] Keep external navigation separate from verified observations and confirmed preferences. No automatic return of Maps results.
- [x] Retain the independent backend route adapter and its timezone/partial-failure tests for future integration. Live checks found WALK usable but all six Japan transit directions empty.
- [ ] Evaluate the handoff on real Android/iOS devices and with tenants.
- [ ] Optional future extension: integrate and validate a provider covering Japan transit for in-app duration/fare comparison and evidence-based tradeoff questions. [Google explicitly excludes Japan](https://developers.google.com/maps/faq#transit_directions_countries).

**Current delivery:** usable Maps handoff on the static public demo. **Future numeric comparison:** only independently retrieved journeys may become evidence or weekly totals. Listing station walk never substitutes for commute time.

## R2 — discover leisure preferences through nearby options

- [x] Search parks, gyms and cafés after candidates are supplied; retain places, sources, hours when supplied and retrieval times.
- [x] Fetch walking routes; disclose radius, straight-line ranking and incomplete results.
- [x] Ask whether an activity matters, frequency and importance, with none/unsure choices and explicit confirmation.
- [x] Search and confirm an optional regular destination after interest is expressed; compare walking access.
- [x] Keep proximity separate from running suitability, café work suitability, safety and current opening status.
- [x] Test missing routes, closed facilities, empty results and ambiguous origins. Live park/WALK slice returned two places and two routes.
- [ ] Evaluate more neighborhoods, opening-hours edge cases and longer regular journeys. Named leisure destinations currently use WALK; the commute module opens transit journeys in Google Maps.

## R3 — recommendations for explicit scenarios

- [x] Vary the assumed weekly frequency, including no commute; only save that assumption after confirmation.
- [x] Explain known rent, returned route objectives and confirmed leisure interests per candidate.
- [x] Preserve shortlist order and explicitly identify missing values. Show dimension-specific advantages among known values, without a total score.
- [x] Keep outbound totals separate; calculate round-trip totals only from independently retrieved legs. Missing returns and season-ticket costs remain unknown.
- [x] Test that a confirmed objective changes route selection, while missing evidence never gains an advantage.
- [ ] Evaluate explanation quality and conflicting objectives with tenants; extend to a broader set of real routes after R1 coverage is resolved.

## R4 — automatic web reviews and viewing checks

- [x] Automatically search public apartment-review sites and posts when opening reviews or changing the selected candidate; manual refresh and a bounded session cache.
- [x] Use provider-grounded citations, match name/address within the same source, distinguish same-unit/building/other-unit scope, and separate ads/unreadable/unmatched pages.
- [x] Label AI summaries and unknown posting dates; never infer residency, an overall rating, or absence of problems from missing reviews.
- [x] Preserve opposing reports and offer evidence-linked choices. No personal diary, free-text requirement entry or manually editable memo.
- [x] Enforce room → building → nearby fallback; use Maps to locate up to three residential references within 300 m, label distance and identity, leave absent review evidence blank.
- [x] Retain the optional Google Places review endpoints with building/proximity checks and explicit confirmation; the default UI now uses public-web research.
- [ ] Validate successful live web-review retrieval and source coverage. GRAN PASEO明大前Ⅳ returned Gemini `upstream_busy` on 2026-09-22; deterministic tests do not establish coverage.
- [ ] Evaluate permitted resident-specific sources if stronger author/residency verification is needed; public review authors remain unverified.

## R5 — shareable comparisons and decision brief

- [x] Preview an allowlisted brief with known listing values, source links, confirmed priorities and unanswered questions.
- [x] Keep the user-entered destination opt-in; retired personal notes are excluded. Images and eligible conversation history are optional local HTML attachments.
- [x] Exclude raw Maps observations/reviews from persisted shares and export; Maps-derived conversations cannot be attached.
- [x] Implement 1–7 day links, separate owner revocation secrets, hashed tokens, read-time expiry, capacity limits and a sharing kill switch.
- [x] Verify backend create/read/revoke, expiry, forbidden fields, token logging boundaries and browser privacy defaults.
- [ ] Deploy a public API with durable SQLite storage and verify links from a separate device/origin. GitHub Pages only hosts the frontend.
- [ ] Before multiple server instances or accounts, move the repository to shared managed storage and design ownership/authentication. The current contract is a single-instance bearer-link prototype.

# Rental Helper — implementation and remaining validation

Updated **2026-09-22**. Checked items describe implemented, tested behavior. Open items remain required before claiming complete provider coverage or production readiness. [Product](PRODUCT.md) · [Code tour](docs/CODE_TOUR.md) · [Validation](docs/VALIDATION.md)

| Milestone | Implementation | Remaining acceptance work |
| --- | --- | --- |
| R0 — release | Guided workspace and repeatable test/browser workflow | Public API, real Gemini evaluation, tenant usability study |
| R1 — commute | Destination confirmation, shared schedule, returned alternatives, explicit intent | Usable Japan public-transit coverage; live three-candidate journey |
| R2 — leisure | Real nearby options, regular destination, frequency/importance confirmation | Broader real-world hours/route evaluation |
| R3 — scenarios | Frequency, cost, route objective, leisure evidence, missing-value explanations | Evaluate competing objectives with tenants |
| R4 — reports | Strict building matching, attributed posts, viewing questions, own observations | Real matched-building display; verified resident-source coverage |
| R5 — sharing | Preview, HTML, expiring/revocable SQLite links | Public HTTPS API and durable-host verification |

## R0 — validate and release the current prototype

- [x] Preserve comparison/discovery together, mobile pair selection, evidence details and explicit confirmation.
- [x] Add a repeatable browser smoke workflow with provider stubs and a real local sharing lifecycle.
- [x] Separate implementation, stub validation and live results in documentation.
- [ ] Re-run real image extraction, URL import, price research and full candidate advice when Gemini is available; record latency, request cost and source-match correctness.
- [ ] Run a small tenant usability study and validate claims against measured results.
- [ ] Deploy the backend; verify live API behavior from the public frontend.

## R1 — commutes to a work destination

- [x] Confirm a searched destination; require a timezone-aware schedule; compare all candidates with the same arrival/departure time and mode.
- [x] Show returned duration, walking segments, transfers, boarding/alighting times, fare when supplied, source and retrieval time.
- [x] Compare returned alternatives by time, fewer transfers or less walking; unknown metrics cannot win.
- [x] Ask an evidence-based question, require importance confirmation, update the memo, and invalidate changed requests.
- [x] Test timezone handling, missing routes/fares, partial failures and stale UI results.
- [x] Run a live Tokyo check: destination search succeeded, but TRANSIT returned no routes. Preserve the missing result and Maps link.
- [ ] Validate a provider/region combination that returns representative Japanese public-transit journeys. Do not claim Japan transit is working based on the API integration alone.
- [ ] Demonstrate a live three-candidate journey and verify route/fare/time correctness independently.

**Done when:** comparable real journeys support a confirmed tradeoff and memo. Listing station walk never substitutes for commute time. [Google transit contract](https://developers.google.com/maps/documentation/routes/transit-route).

## R2 — discover leisure preferences through nearby options

- [x] Search parks, gyms and cafés after candidates are supplied; retain places, sources, hours when supplied and retrieval times.
- [x] Fetch walking routes; disclose radius, straight-line ranking and incomplete results.
- [x] Ask whether an activity matters, frequency and importance, with none/unsure choices and explicit confirmation.
- [x] Search and confirm an optional regular destination after interest is expressed; compare walking access.
- [x] Keep proximity separate from running suitability, café work suitability, safety and current opening status.
- [x] Test missing routes, closed facilities, empty results and ambiguous origins. Live park/WALK slice returned two places and two routes.
- [ ] Evaluate more neighborhoods, opening-hours edge cases and longer regular journeys. Named leisure destinations currently use WALK; transit comparison is available in the commute module.

## R3 — recommendations for explicit scenarios

- [x] Vary the assumed weekly frequency, including no commute; only save that assumption after confirmation.
- [x] Explain known rent, returned route objectives and confirmed leisure interests per candidate.
- [x] Preserve shortlist order and explicitly identify missing values. Show dimension-specific advantages among known values, without a total score.
- [x] Keep one-way outbound totals separate from unobserved return journeys and season-ticket costs.
- [x] Test that a confirmed objective changes route selection, while missing evidence never gains an advantage.
- [ ] Evaluate explanation quality and conflicting objectives with tenants; extend to a broader set of real routes after R1 coverage is resolved.

## R4 — attributed reviews and viewing checks

- [x] Use Places API responses with author/date/source attribution, relevance ordering and temporary storage.
- [x] Require strict normalized building-name/proximity checks and user place confirmation; reject nearby shops and distant namesakes.
- [x] Keep building-place posts separate from verified residency claims and the tenant's own viewing notes.
- [x] Group mentioning posts by keywords while retaining opposing reports. Offer explicit actions to add a viewing question, not factual conclusions.
- [x] Persist the tenant's own dated observations and include them in the memo; sharing them is optional.
- [ ] Validate a real matched building with reviews. The live Louvre example returned no confirmed match and correctly attached no reviews.
- [ ] Add a permitted resident-specific source only after access terms and building/unit identity can be validated. Google place authors are not verified residents.

## R5 — shareable comparisons and decision brief

- [x] Preview an allowlisted brief with known listing values, source links, confirmed priorities and unanswered questions.
- [x] Keep personal observations and the user-entered destination opt-in. Images and eligible conversation history are optional local HTML attachments.
- [x] Exclude raw Maps observations/reviews from persisted shares and export; Maps-derived conversations cannot be attached.
- [x] Implement 1–7 day links, separate owner revocation secrets, hashed tokens, read-time expiry, capacity limits and a sharing kill switch.
- [x] Verify backend create/read/revoke, expiry, forbidden fields, token logging boundaries and browser privacy defaults.
- [ ] Deploy a public API with durable SQLite storage and verify links from a separate device/origin. GitHub Pages only hosts the frontend.
- [ ] Before multiple server instances or accounts, move the repository to shared managed storage and design ownership/authentication. The current contract is a single-instance bearer-link prototype.

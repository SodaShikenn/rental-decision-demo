# Rental Helper — next development tasks

Updated **2026-09-22**. This is a prioritized backlog, not shipped functionality. [Current progress](PRODUCT.md#current-progress) is the implementation reference. Tasks are complete only when their acceptance criteria are demonstrated.

## Delivery order

| Order | Milestone | User outcome | Depends on |
| --- | --- | --- | --- |
| R0 | Validate and release the current prototype | A demo whose claims match its capabilities. | Current build |
| R1 | Work-destination commute comparison | Understand the journey from each candidate to the same workplace. | Provider feasibility check |
| R2 | Interactive leisure discovery | Learn which nearby activities and regular destinations matter personally. | Existing Places/WALK integration; R1 for longer trips |
| R3 | Explainable scenario recommendations | Compare rent, commute and leisure using confirmed priorities. | R1 + R2 |
| R4 | Attributed resident context | Separate resident reports from measured facts and nearby-place reviews. | Source availability and entity matching |
| R5 | Shareable decision brief | Discuss the comparison with a partner or agent. | Stable evidence/preference model |

R0 can proceed alongside R1 feasibility. Build one destination and one leisure category end to end before expanding to many destinations or a general recommendation engine.

## R0 — validate and release the current prototype

- [ ] Re-run live image extraction, URL import, price research and candidate conversation when Gemini is available. Record latency, provider errors, source-match correctness and request cost; stubbed tests are not live validation.
- [ ] Check correct unit, wrong unit, conflicting price, archived listing, unknown address and unavailable-provider cases with real examples.
- [ ] Run a small tenant usability study: can participants identify a tradeoff, confirm/revise a priority and name the next useful check without learning OCR terminology?
- [ ] Publish the current frontend when ready; decide whether the public demo gets a hosted API or remains a recorded-data experience. Retest the deployed URL.

**Done when:** the walkthrough matches deployment; live results and failures are documented separately; uncertainty and confirmation behavior survive real usage. No accuracy/usability claim without recorded evaluation.

## R1 — commutes to a work destination

**Entry point:** after comparing candidates, offer “Compare the commute to work.” Ask for a workplace/place or station, workdays/frequency, and either arrival or departure time. Confirm ambiguous destinations and allow skipping. Keep the destination private to the session by default.

- [ ] Validate transit coverage and response fields for representative Japanese routes. Walking-route access does not prove transit support. If unsupported, show unavailable plus a Maps link; evaluate another supported provider before promising coverage.
- [ ] Add a destination/schedule model with timezone, stable place identity and confirmed location. Start with one destination; invalidate observations when address, destination, time or mode changes.
- [ ] Add a dedicated commute service and comparison row: estimated door-to-door time, walking segments, transfers, departure/arrival, fare when supplied, source and retrieval time. Use the same schedule for all candidates.
- [ ] Expose alternatives when returned: shortest journey, fewer transfers or less walking. Explain why a route is suggested; provider preferences are requests, not guarantees.
- [ ] Ask one tradeoff question using actual route evidence. Keep proposed commute preferences tentative until accepted; update comparison explanations and the memo after confirmation.
- [ ] Test ambiguous destinations, missing routes/fares, failures, partial results, timezone handling and stale responses. Include a live Japan route check.

**Done when:** with three candidates and one destination, the tenant can inspect comparable journeys, understand a suggested route, confirm/defer a commute preference, and see it in the memo. Unsupported values remain unknown. Station walking minutes never substitute for commute time.

**Provider basis:** Google documents [transit routes](https://developers.google.com/maps/documentation/routes/transit-route) with walking/transit details, schedule parameters and routing preferences. Route/fare availability must be checked in the intended region; fares may be absent. This is a possible implementation, not a completed integration.

## R2 — discover leisure preferences through nearby options

**Entry point:** analyze actual surroundings first. If retrieved candidate context includes parks and cafés, ask “Which would you use regularly?” Offer neither, unsure, and contextual follow-up. Proximity is not evidence that the tenant enjoys an activity.

- [ ] Extend Places categories beyond stations/groceries: start with one relevant category such as parks, gyms or cafés. Preserve entity IDs, sources and retrieval times; do not claim exhaustive coverage.
- [ ] Show real places/routes per candidate. Ask whether an activity matters, how often, and whether proximity or a particular destination is important.
- [ ] Support an optional named destination, such as an existing gym or weekend neighborhood, after the tenant indicates interest. Confirm it before routing.
- [ ] Distinguish “near a park” from “good for running,” and café ratings from suitability for remote work. Unsupported interpretations become questions.
- [ ] Confirm leisure priorities as must-have/preference/undecided, allow revision and add only accepted preferences to the memo.
- [ ] Test no results, ambiguous places, missing opening data, changed interests and missing routes. Business status does not prove opening at the planned time.

**Done when:** a tenant discovers one leisure priority from actual surroundings and compares its evidence across candidates without an initial lifestyle statement. Deferral and “none of these” work throughout.

## R3 — recommendations for explicit scenarios

- [ ] Add scenarios such as “office three days a week” and “mostly remote,” using confirmed frequency/priorities.
- [ ] Explain candidate advantages and costs: monthly housing charge, scheduled commute, transfers and access to confirmed leisure interests. Separate estimates, references and missing values.
- [ ] Suggest routes or a next viewing/check for a stated objective. Name the evidence/preference behind the suggestion, expose the compromise and allow assumptions to change.
- [ ] Keep candidate order stable; show options with different advantages instead of a hidden overall score. Future weighting must be visible, editable and explicitly accepted.
- [ ] Evaluate conflicting objectives and missing evidence. Recommendations must identify gaps rather than treat them favorably.

**Done when:** changing one confirmed priority changes the explanation predictably, every recommendation is traceable, and the tenant can see what would reverse it. Do not claim to choose the objectively best home.

## R4 — attributed reviews and viewing checks

- [ ] Identify sources permitting the intended access/display; establish building/unit matching first.
- [ ] Separate resident reports from nearby-business reviews. Retain attribution where supplied, dates, source links and scope.
- [ ] Present recurring reports alongside counterexamples and unknowns. Do not infer safety, quietness or construction quality solely from maps/ratings.
- [ ] Turn concerns into viewing questions and collect the tenant's own observations separately.

**Done when:** tenants can distinguish a listing claim, provider observation, resident report and AI interpretation, and trace each to its source.

## R5 — shareable comparisons and decision brief

- [ ] Start with an export/share preview: confirmed requirements, tradeoffs, sources, timestamps and unanswered questions.
- [ ] Let the tenant choose whether to include images, workplace destinations and conversation content. Respect provider data storage/display terms.
- [ ] Define access, expiration and deletion for hosted links before adding cloud persistence. Preserve the local-only workflow.

**Done when:** another person understands the brief without the original conversation, while the tenant controls shared content and can revoke hosted access.

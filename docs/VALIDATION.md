# Validation record — 2026-09-22 JST

This log distinguishes implemented behavior, deterministic checks, and actual provider results. [Product status](../PRODUCT.md) · [Code tour](CODE_TOUR.md)

| Check | Evidence/result | Interpretation |
| --- | --- | --- |
| `npm test` | 101 frontend + 115 backend passed; 2 optional real-OCR tests skipped | Logic and provider contracts pass with stubs; not a model accuracy benchmark. |
| Browser workflow | Desktop/mobile, destination confirmation, partial commute failure, leisure confirmation, scenario frequency, review-to-question, personal observation, memo, private-share defaults and HTML download | Google/Gemini responses stubbed; no synthetic results are shipped as live observations. |
| UI polish checks | `npm run smoke:ui` passed: keyboard/focus, Escape/outside dismissal, interrupted native dialogs, reduced motion, open/closed sheet resizing, 320/390/760 px touch layouts, 16 px form inputs, dark mode. `npm run smoke:browser` and 101 frontend tests passed again after UI changes. | Chromium and touch emulation; real phone keyboard/safe-area/gesture checks remain open. [Design decisions](UI_DESIGN.md). |
| Feature navigation | All eight pages reachable from desktop tabs/mobile dropdown; Back/Forward retains drafts; reload and old deep links select the right page; all pages fit 320/390/760 px. Full stubbed-provider/share workflow passes through the new tabs. | Navigation retains mounted feature instances; it does not revalidate live provider coverage. |
| Compose configuration | `docker compose ... config --quiet` passed; local Docker daemon was unavailable | API image build is left to CI; no local image-build claim. |
| GitHub CI for the feature release | [Run 35641505498](https://github.com/SodaShikenn/rental-helper/actions/runs/35641505498) passed frontend, backend and Docker build/Compose jobs | The image built on GitHub; the public API has not been deployed. |
| Local sharing | Real backend: create → separate reader → revoke → reader receives not-found | SQLite and revocation work locally; not a public backend deployment. |
| Live destination search | Google returned 新宿駅 | Place search is accessible with the configured key. |
| Live Tokyo transit | Public address 東京都渋谷区神南1丁目19-11 → 新宿駅, next-day schedule: **no routes returned** | Transit coverage is unresolved. The UI reports this and links to Maps; it does not substitute walking-to-station or invented routes. |
| Live leisure | Same public origin, park category: 2 places, 2 walking routes returned | This Places/WALK slice succeeded. It does not establish exhaustive coverage or suitability for running. |
| Live building review matching | ルーブル渋谷松濤 408号室 / 東京都渋谷区富ヶ谷2丁目20-18: **no confirmed matching place** | Correctly refused to attach another entity's reviews. Live review display for a matched building remains to be validated. |
| Automatic web reviews | `POST /api/reviews/web` for GRAN PASEO明大前Ⅳ / 東京都世田谷区羽根木2-28-19 returned HTTP 503 `upstream_busy` in 2.5 s | Search failed; no review or empty-success result was fabricated. Successful live retrieval is still unverified. |
| Earlier live Maps | Geocoding, nearby essentials, WALK Routes succeeded | Dated local observations, not a continuous health guarantee. |
| Earlier live Gemini | Small request succeeded; full research/advice calls encountered provider-busy responses | Full conversational/retrieval quality and availability remain open release checks. |

No claim of tenant-study results, resident identity verification, guaranteed route coverage or production readiness is made.

The deployed-UI check also exposed a pre-existing new-link entry crash: the controller evaluated a candidate fingerprint before a candidate existed. A browser regression reproduced the failure before the cached-research guard was corrected; the same scenario passed afterward, including opening/closing the link dialog and restoring trigger focus.

The review update adds deterministic tests for source-bound identity, Roman-numeral building names, room scope, opposing reports, unknown dates, advertisements/inaccessible pages, unsupported summaries, missing citations, provider failures, rate limits and browser cache/stale-response behavior. Both browser suites passed after the update; they stub automatic review requests. The refreshed mobile screenshot shows the real provider-busy state, not invented reviews.

## Provider contracts consulted

- [Gemini Google Search grounding](https://ai.google.dev/gemini-api/docs/generate-content/google-search) and [URL context](https://ai.google.dev/gemini-api/docs/generate-content/url-context): provider retrieval, citation metadata and search suggestions.
- [Google transit routes](https://developers.google.com/maps/documentation/routes/transit-route): time selection, alternatives and transit preferences; fares may be absent.
- [Compute Routes reference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes): request and returned route fields.
- [Places details](https://developers.google.com/maps/documentation/places/web-service/place-details): field masks and place/review responses.
- [Places attribution policies](https://developers.google.com/maps/documentation/places/web-service/policies): author/source attribution and review ordering. The optional Maps API retains attribution/order; the default review UI now uses public-web summaries.
- [Coverage notes](https://developers.google.com/maps/coverage): the general coverage table does not establish public-transit availability. The live route check is recorded separately above.

## Recheck before a public API launch

Test representative Japan transit journeys with a provider that actually returns them, validate public-web review retrieval, source identity and room scope against real buildings, rerun Gemini extraction/research/advice, then verify public HTTPS, origin configuration, rate limits, persistence and share revocation. Measure provider latency/cost and tenant usability rather than deriving them from passing unit tests.

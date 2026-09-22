# Validation record — 2026-09-22 JST

This log distinguishes implemented behavior, deterministic checks, and actual provider results. [Product status](../PRODUCT.md) · [Code tour](CODE_TOUR.md)

| Check | Evidence/result | Interpretation |
| --- | --- | --- |
| `npm test` | 111 frontend + 130 backend passed; 2 optional real-OCR tests skipped | Logic and provider contracts pass with stubs; not a model accuracy benchmark. |
| Browser workflow | Desktop/mobile, keyless commute links, reversed endpoints, preset/custom destination changes, external-tab opening, leisure confirmation, scenario frequency, review-to-question, nearby/empty review states, generated memo, share defaults and HTML download | Google/Gemini responses stubbed; no synthetic results are shipped as live observations. |
| UI polish checks | `npm run smoke:ui` passed: keyboard/focus, Escape/outside dismissal, interrupted native dialogs, reduced motion, open/closed sheet resizing, 320/390/760 px touch layouts, 16 px form inputs, dark mode. `npm run smoke:browser` and 111 frontend tests passed again after UI changes. | Chromium and touch emulation; real phone keyboard/safe-area/gesture checks remain open. [Design decisions](UI_DESIGN.md). |
| Type/layout refinement | `npm run smoke:ui` checks the 16 px body baseline, 761/800/1024 px desktop navigation and folded help, in addition to all eight mobile pages. Screenshots refreshed after simplifying headings, candidate scope and export placement. | Local Chromium; providers are stubbed for layout/workflow checks. |
| Feature navigation | All eight pages reachable from desktop tabs/mobile dropdown; Back/Forward retains drafts; reload and old deep links select the right page; all pages fit 320/390/760 px. Full stubbed-provider/share workflow passes through the new tabs. | Navigation retains mounted feature instances; it does not revalidate live provider coverage. |
| Compose configuration | `docker compose ... config --quiet` passed; local Docker daemon was unavailable | API image build is left to CI; no local image-build claim. |
| GitHub CI for the feature release | [Run 35641505498](https://github.com/SodaShikenn/rental-helper/actions/runs/35641505498) passed frontend, backend and Docker build/Compose jobs | The image built on GitHub; the public API has not been deployed. |
| Local sharing | Real backend: create → separate reader → revoke → reader receives not-found | SQLite and revocation work locally; not a public backend deployment. |
| Live destination search | Google returned two exact Tokyo 渋谷駅 entities on 2026-09-22 | Search works; the current direct-link UI resolves destinations inside Maps instead of using Places. |
| Live Tokyo round trip | 2026-09-22 14:15 JST: all three sample buildings → first exact Tokyo 渋谷駅 match; 2026-09-23 08:00 arrival / 18:00 return departure: all six directions **no_route**. WALK for ルーブル渋谷松濤 succeeded in both directions. | Places, precise geocoding and WALK work. [Google excludes Japan transit](https://developers.google.com/maps/faq#transit_directions_countries); a different provider is required for those durations. The UI keeps missing values and Maps links. |
| Live leisure | Same public origin, park category: 2 places, 2 walking routes returned | This Places/WALK slice succeeded. It does not establish exhaustive coverage or suitability for running. |
| Live building review matching | ルーブル渋谷松濤 408号室 / 東京都渋谷区富ヶ谷2丁目20-18: **no confirmed matching place** | Correctly refused to attach another entity's reviews. Live review display for a matched building remains to be validated. |
| Automatic web reviews | `POST /api/reviews/web` for GRAN PASEO明大前Ⅳ / 東京都世田谷区羽根木2-28-19 returned HTTP 503 `upstream_busy` in 2.8 s | Search failed; no review or empty-success result was fabricated. Successful live retrieval is still unverified. |
| Live nearby-reference discovery | GRAN PASEO明大前Ⅳ: Maps returned グランデュール羽根木 (15 m), ライフステージ羽根木 (21 m), アンプリール (21 m) | Straight-line residential reference discovery succeeded; this does not validate their web-review content. |
| Earlier live Maps | Geocoding, nearby essentials, WALK Routes succeeded | Dated local observations, not a continuous health guarantee. |
| Earlier live Gemini | Small request succeeded; full research/advice calls encountered provider-busy responses | Full conversational/retrieval quality and availability remain open release checks. |

No claim of tenant-study results, resident identity verification, guaranteed route coverage or production readiness is made.

The deployed-UI check also exposed a pre-existing new-link entry crash: the controller evaluated a candidate fingerprint before a candidate existed. A browser regression reproduced the failure before the cached-research guard was corrected; the same scenario passed afterward, including opening/closing the link dialog and restoring trigger focus.

The review update adds deterministic tests for source-bound identity, Roman-numeral building names, room scope, opposing reports, unknown dates, advertisements/inaccessible pages, unsupported summaries, missing citations, provider failures, rate limits and browser cache/stale-response behavior. Fallback tests additionally verify tier order, early stopping, 300 m distance/type filtering, blank results and removal of legacy manual notes. Both browser suites passed after the update; they stub automatic review requests. The current mobile review screenshot uses a stubbed empty-success response to demonstrate layout. It does not supersede the live provider-busy observation above.

## Provider contracts consulted

- [Gemini Google Search grounding](https://ai.google.dev/gemini-api/docs/generate-content/google-search) and [URL context](https://ai.google.dev/gemini-api/docs/generate-content/url-context): provider retrieval, citation metadata and search suggestions.
- [Places housing types](https://developers.google.com/maps/documentation/places/web-service/place-types): residential filters for nearby review references.
- [Google transit routes](https://developers.google.com/maps/documentation/routes/transit-route): time selection, alternatives and transit preferences; fares may be absent.
- [Compute Routes reference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes): request and returned route fields.
- [Places details](https://developers.google.com/maps/documentation/places/web-service/place-details): field masks and place/review responses.
- [Places attribution policies](https://developers.google.com/maps/documentation/places/web-service/policies): author/source attribution and review ordering. The optional Maps API retains attribution/order; the default review UI now uses public-web summaries.
- [Coverage notes](https://developers.google.com/maps/coverage): the general coverage table does not establish public-transit availability. The live route check is recorded separately above.

## Recheck before a public API launch

Test representative Japan transit journeys with a provider that actually returns them, validate public-web review retrieval, source identity and room scope against real buildings, rerun Gemini extraction/research/advice, then verify public HTTPS, origin configuration, rate limits, persistence and share revocation. Measure provider latency/cost and tenant usability rather than deriving them from passing unit tests.

## Morning/evening commute checks

New deterministic checks cover area-based hub suggestions, unknown-area behavior, ambiguous station identities, Japan-time defaults across weekends/OS timezones, return-time validation, exact origin/destination reversal, distinct arrival/departure timestamps, partial return failures, and round-trip totals that remain unknown when either leg is missing. Current browser checks cover immediately available outbound/return links, live preset/custom destination updates, transport mode, explicit time-handoff instructions, new-tab navigation (Google response intercepted), and zero destination/commute API requests. Navigation creates no verified route evidence. An existing share-revocation smoke-test race was corrected by awaiting the revoke response before reloading the reader.

The direct-link unit tests also cover Japanese/ampersand encoding, qualified-building fallback, missing endpoints (no device-location fallback), unsupported modes, overlong URLs, escaped imported text and empty candidate lists. Browser handoff checks validate the outgoing URL contract, not Google timetable accuracy or native mobile app behavior.

Live browser handoff on 2026-09-22 JST: clicking the Louvre Shibuya outbound link opened Google Maps with the extracted Tomigaya address, Shibuya station and public transport, and Maps displayed actual route alternatives. Its schedule remained “すぐに出発”, confirming why date/time must be set there. This verifies one desktop handoff, not every candidate, timetable accuracy, or native phone app behavior. Provider results were not imported or committed.

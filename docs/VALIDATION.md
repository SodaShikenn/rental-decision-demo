# Validation record — 2026-09-22 JST

This log distinguishes implemented behavior, deterministic checks, and actual provider results. [Product status](../PRODUCT.md) · [Code tour](CODE_TOUR.md)

| Check | Evidence/result | Interpretation |
| --- | --- | --- |
| `npm test` | 96 frontend + 95 backend passed; 2 optional real-OCR tests skipped | Logic and provider contracts pass with stubs; not a model accuracy benchmark. |
| Browser workflow | Desktop/mobile, destination confirmation, partial commute failure, leisure confirmation, scenario frequency, review-to-question, personal observation, memo, private-share defaults and HTML download | Google responses stubbed; no synthetic results are shipped as live observations. |
| Compose configuration | `docker compose ... config --quiet` passed; local Docker daemon was unavailable | API image build is left to CI; no local image-build claim. |
| Local sharing | Real backend: create → separate reader → revoke → reader receives not-found | SQLite and revocation work locally; not a public backend deployment. |
| Live destination search | Google returned 新宿駅 | Place search is accessible with the configured key. |
| Live Tokyo transit | Public address 東京都渋谷区神南1丁目19-11 → 新宿駅, next-day schedule: **no routes returned** | Transit coverage is unresolved. The UI reports this and links to Maps; it does not substitute walking-to-station or invented routes. |
| Live leisure | Same public origin, park category: 2 places, 2 walking routes returned | This Places/WALK slice succeeded. It does not establish exhaustive coverage or suitability for running. |
| Live building review matching | ルーブル渋谷松濤 408号室 / 東京都渋谷区富ヶ谷2丁目20-18: **no confirmed matching place** | Correctly refused to attach another entity's reviews. Live review display for a matched building remains to be validated. |
| Earlier live Maps | Geocoding, nearby essentials, WALK Routes succeeded | Dated local observations, not a continuous health guarantee. |
| Earlier live Gemini | Small request succeeded; full research/advice calls encountered provider-busy responses | Full conversational/retrieval quality and availability remain open release checks. |

No claim of tenant-study results, resident identity verification, guaranteed route coverage or production readiness is made.

## Provider contracts consulted

- [Google transit routes](https://developers.google.com/maps/documentation/routes/transit-route): time selection, alternatives and transit preferences; fares may be absent.
- [Compute Routes reference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes): request and returned route fields.
- [Places details](https://developers.google.com/maps/documentation/places/web-service/place-details): field masks and place/review responses.
- [Places attribution policies](https://developers.google.com/maps/documentation/places/web-service/policies): author/source attribution and review ordering. The UI identifies Google relevance ordering and shows the returned author/source information.
- [Coverage notes](https://developers.google.com/maps/coverage): the general coverage table does not establish public-transit availability. The live route check is recorded separately above.

## Recheck before a public API launch

Test representative Japan transit journeys with a provider that actually returns them, validate a real matched building's attributed reviews, rerun Gemini extraction/research/advice, then verify public HTTPS, origin configuration, rate limits, persistence and share revocation. Measure provider latency/cost and tenant usability rather than deriving them from passing unit tests.

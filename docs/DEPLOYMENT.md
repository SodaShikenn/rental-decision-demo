# Public API release

GitHub Pages serves the frontend and film. The Python API needs a separate HTTPS
host. A Pages deployment alone does not enable image extraction, research, advice,
Maps checks, leisure discovery, web reviews or hosted sharing.

## Backend requirements

Build [server/Dockerfile](../server/Dockerfile) with `server/` as its context.
The image prepares OCR models at build time, listens on port **8000**, and runs as
UID **10001**. Start with one instance and one worker: the current share repository
is SQLite and the rate limiter is process-local. Size memory against an actual OCR
request, not just the health endpoint.

Configure these values in the host's secret/environment settings:

| Variable | Production value |
| --- | --- |
| `GEMINI_API_KEY` | A key with available model and search quota |
| `GOOGLE_MAPS_API_KEY` | A key for Geocoding, Places (New), and Routes |
| `EXTRACTION_MODE` | `live` |
| `EXTRACTION_ENABLED`, `RESEARCH_ENABLED`, `SHARING_ENABLED` | `true` |
| `ALLOWED_ORIGINS` | `https://sodashikenn.github.io` (origin, without `/rental-helper/`) |
| `SHARE_DB_PATH` | `/app/data/shares.sqlite3` |

Mount durable storage at `/app/data`, writable by UID 10001. A restart/redeploy must
preserve active shares. Use the platform's HTTPS proxy, allow request durations of
at least 200 seconds for bounded review searches, and configure forwarded IP trust
only for that proxy. Keep port 8000 private to the proxy. Configure provider spend
limits for the public demonstration. See [storage limitations](DEVELOPMENT.md#share-storage-and-deployment-limits).

## Connect Pages

After the API is deployed, set repository **variable** `RENTAL_API_URL` to its public
HTTPS base URL. This is an address, not a secret. Never add API keys to repository
variables or `web/env.js`.

The [Pages workflow](../.github/workflows/pages.yml) runs
[`configure-pages.mjs`](../scripts/configure-pages.mjs) before publishing. It checks
live-mode configuration, feature switches, the frontend origin and JSON request
preflight, then writes only the API address into the built `_site/env.js`.
Without the variable, Pages remains a frontend-only deployment. These checks do
not call Google or prove that quota is available.

For example, after substituting the actual deployed hostname:

```sh
gh variable set RENTAL_API_URL --body 'https://your-deployed-api.example'
gh workflow run pages.yml
```

## Acceptance from the published app

Use a fresh browser session on the public URL, without API interception. Complete
the following before describing the release or film as a live end-to-end demo:

- [ ] Upload a public sample image; inspect extracted fields and original evidence.
- [ ] Import the supplied SUUMO link; inspect source identity and building/unit scope.
- [ ] Research missing monthly charges; show exact-unit values or explicitly labelled
  same-building references. Missing evidence must remain missing.
- [ ] Ask AI a candidate-based question, select an actual returned option, then
  explicitly accept a proposed priority and observe the comparison update.
- [ ] Open outbound and return commute links; verify the addresses and mode in Maps.
  Show the separate 08:00 arrival / 18:00 departure setting inside Maps.
- [ ] Check station/shopping walking claims and inspect a real result and timestamp.
- [ ] Discover parks, gyms and cafés; confirm an interest and compare scenarios.
- [ ] Search apartment reviews and inspect source/scope. A successful empty result
  is valid; a provider error is not an empty result or a completed acceptance check.
- [ ] Inspect the generated memo and downloaded HTML.
- [ ] Create a hosted share, open it in a separate browser context, restart the API
  and confirm it remains readable, revoke it, then verify the reader loses access.
- [ ] Check desktop/mobile navigation and browser errors on the deployed build.

## Record the deployed result

Record all of those interactions against the published app and API. Include the
deployment date and real waiting/error/empty states; do not substitute canned AI or
API replies. Keep keys, personal candidate data and share-management tokens out of
the film. Revoke any demonstration share afterward.

The existing `npm run record:demo` is explicitly **scripted** and cannot satisfy this
acceptance. Retain its simulation label until a separately verified live recording
replaces it. Record chapter timings for all eight feature pages plus image/link
intake; update captions, transcript and README links together, then check the
published player. [Existing media workflow](DEMO.md).

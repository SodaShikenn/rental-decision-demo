# Development handoff

Last updated: 2026-09-21 (Asia/Tokyo)

## Project status

NEST is an explainable rental-decision prototype. It helps a renter compare properties using budget, daily routines, priorities, and explicit trade-offs. It includes an image-first intake flow for Japanese rental listing sheets, backed by a real extraction server.

- Repository: https://github.com/SodaShikenn/rental-decision-demo
- Live demo: https://sodashikenn.github.io/rental-decision-demo/
- Primary local checkout: `/Users/soda/Desktop/rental-decision-demo`
- Default branch: `main`
- Layout: `web/` (static front end) and `server/` (Cloudflare Worker), organized like [LLM-RAG_KBQA](https://github.com/SodaShikenn/LLM-RAG_KBQA). See [Repository structure](#repository-structure).
- Hosting: GitHub Pages publishes `web/` through GitHub Actions (`.github/workflows/pages.yml`). **The repository's Pages source must be switched to "GitHub Actions" before or with the first push of this layout.** See [Deployment workflow](#deployment-workflow).
- Front end: dependency-free HTML, CSS, and JavaScript ES modules, with no build step.
- Extraction server: Cloudflare Worker calling Claude (`claude-opus-5`). **Implemented and tested locally; not yet deployed.** The public demo therefore still uses sample extraction.

## Important working-tree note

The desktop checkout contains one untracked file:

```text
assets/WechatIMG472.jpg
```

It was not created or committed as part of the public demo. Treat it as user-owned: do not add, modify, move, or delete it without explicit confirmation. It must not be included in a commit by accident. It has also never been sent to the extraction API; tests use the fictional fixture in `server/tests/fixtures/` instead.

## Current user experience

1. A user uploads a PNG, JPEG, or WEBP rental listing sheet. It is previewed locally.
2. **Without an extraction server** (`extractionApiUrl` blank in `web/env.js`, the Pages default), "画像を読み取る" shows fixed sample values labelled SAMPLE. The image is not sent anywhere.
3. **With an extraction server**, the button reads "Claudeで読み取る" and the page discloses that the downscaled image goes to Anthropic's Claude API through the Worker. The Worker returns, for each of seven fields, a value, a model-reported confidence, the printed source text, and a normalized evidence box. It also returns warnings, for example a summary area that disagrees with the floor plan.
4. Each field shows a confidence badge, a crop of its evidence region taken from the local preview, and its source text. Hovering or focusing a field highlights the region on the preview.
5. A field is flagged for review if its confidence is below 0.85, its value is missing, or a warning names it. The candidate cannot be added until every flagged field is ticked "原本と照合済み" or corrected.
6. The confirmed listing becomes a provisional (暫定) candidate. Missing route, facility, rent-history, and review data shows as `未取得`. Missing rent shows as 賃料 未取得 and gets a neutral budget score instead of full marks.
7. The candidate's SOURCE row records the extraction method, extraction and confirmation times, and which fields a person corrected.
8. Budget and up to two priorities re-rank the candidates. The rule-based chat explains simple trade-offs.

Errors (rate limit, timeout, invalid response, network failure) are shown in place. Sample values appear only when the user clicks "サンプル値で試す"; there is never a silent fallback.

## Truthful product boundaries

Keep these limitations visible until the corresponding work exists:

- The public demo uses sample extraction until someone deploys the Worker and sets `extractionApiUrl`.
- Confidence values are reported by the model and have not been calibrated. The 0.85 review threshold is a placeholder, not a measured cut-off.
- Evidence boxes are the model's approximate localization, not OCR word boxes. The printed `sourceText` is the more reliable check.
- The Worker's mock mode returns fixed values for the fictional fixture and is labelled MOCK. It never reads the uploaded image.
- Only seven fields are extracted. Deposit, key money, management fee, equipment, and other terms are not.
- The map is a mock unless a browser-restricted Google Maps key is supplied.
- Geocoding, Routes, and Places are not connected.
- Property inventory, rent histories, reviews, routes, and facility scores are fictional demo data.
- The chat is rule-based, not an LLM.
- The ranking formula is illustrative and has not been calibrated with users.
- Data is not saved after a page reload.

Do not remove the `DEMO`, `暫定`, `未取得`, `SAMPLE`, `MOCK`, confidence, or source-limit disclosures merely to make the product appear more complete.

## Repository structure

Both halves follow the LLM-RAG_KBQA conventions, translated from Flask to this stack:

|KBQA (Flask)|This repo|Role|
|---|---|---|
|`app.py` `create_app()`|`web/app.js`, `server/src/app.js` `createApp()`|Initialize extensions, register apps|
|`config.py`|`web/config.js`, `server/src/config.js`|Settings and constants|
|`.env`|`web/env.js` (public values only), `server/.dev.vars` + Worker secrets|Per-deployment values|
|`helper.py`|`web/helper.js`, `server/src/helper.js`|Shared helpers|
|`extensions/ext_*.py` `init_app(app)`|`extensions/ext_*.js` `initApp(app)`|External services and infrastructure|
|`apps/<feature>/` (blueprint, views, services, models, forms)|`apps/<feature>/` (`index.js`, `views.js`, `services.js`, `models.js`, `forms.js`)|One feature per folder|
|`commands/`|`server/commands/`|CLI commands|
|`static/`|`web/static/`|CSS and assets|

```text
.
├── package.json              # dev/test commands: dev:web, dev:server, test, smoke (no dependencies)
├── .github/workflows/
│   ├── ci.yml                # runs npm test on every push and pull request
│   └── pages.yml             # tests, then publishes web/ (without tests/) to GitHub Pages
├── assets/demo.png           # README preview (fictional fixture, mock mode)
├── README.md / README.en.md  # Japanese / English documentation
├── handoff.md                # this file
├── web/                      # front end
│   ├── index.html            # page structure; loads env.js, then app.js as an ES module
│   ├── app.js                # createApp(): extensions, then APPS in render order
│   ├── config.js             # constants and values read from env.js
│   ├── env.js                # window.RENTAL_DEMO_ENV = { googleMapsApiKey, extractionApiUrl } (committed blank)
│   ├── env.example.js
│   ├── helper.js             # yen, escapeHTML, formatTime, $ / $$
│   ├── extensions/
│   │   ├── ext_store.js      # in-memory state; emits "change" and "recalculated"
│   │   └── ext_google_maps.js
│   ├── apps/
│   │   ├── shortlist/        # models (demo inventory), services (scoring), views (controls, cards, pins)
│   │   ├── insights/         # views (selected-card reasons, rent chart, reviews)
│   │   ├── chat/             # services (rule-based answers), views (messages, form)
│   │   └── intake/           # models (fields, sample, contract check), services (resize, request,
│   │                         # review gate, candidate, provenance), views (upload, review form)
│   ├── static/               # app.css, favicon.svg
│   └── tests/apps/<feature>/ # node:test for services and models
└── server/                   # extraction server (Cloudflare Worker)
    ├── package.json          # @anthropic-ai/sdk, zod; wrangler (dev)
    ├── wrangler.jsonc        # rate-limit binding and vars (origins, mode, kill switch, effort)
    ├── .dev.vars.example     # local vars/secrets template (mock mode by default)
    ├── src/
    │   ├── index.js          # Worker entry (default export only; the runtime rejects other exports)
    │   ├── app.js            # createApp(env, overrides): routing, origin check, CORS, AppError → JSON, one log line
    │   ├── config.js         # model, limits, loadConfig(env)
    │   ├── helper.js         # AppError, jsonResponse, errorResponse
    │   ├── extensions/       # ext_anthropic (lazy client), ext_cors, ext_logger, ext_rate_limit
    │   └── apps/listing/
    │       ├── index.js      # bp: prefix /api, routes, beforeRequest [kill switch, rate limit]
    │       ├── views.js      # POST /api/extract-listing
    │       ├── forms.js      # magic-byte sniffing, dimensions, size and resize-limit checks
    │       ├── services.js   # readListing(): Claude call, stop-reason and SDK-error mapping
    │       ├── prompts.js    # system and user prompts
    │       ├── models.js     # zod schema for Claude's output, toContract()
    │       └── mock.js       # fixed reading for the fictional fixture
    ├── commands/smoke.js     # posts the fixture to a running Worker and checks every field
    └── tests/                # app.test.js, apps/listing/*.test.js, fixtures/ (listing-sheet.html → .png, expected.json)
```

Rules that keep it maintainable:

- **One feature per `apps/<name>/`, with fixed file roles:**
  - `index.js` registers the feature;
  - `views.js` holds the DOM or HTTP code;
  - `services.js` holds logic that never touches the DOM at import time, and is what the unit tests cover;
  - `models.js` holds data definitions;
  - `forms.js` holds input validation.
- **Features talk through `app.extensions.store`, not by calling each other's views.**
  - A view changes state with `store.select()` or `store.upsertProperty()`.
  - Other features re-render on `store.on("change")`.
  - Cross-feature imports of `services.js` are fine (for example, insights uses `shortlist/services` and `intake/services`), like KBQA's chat importing dataset models.
- **External services live in `extensions/`, each behind `initApp(app)`.**
  - Server tests replace them with `createApp(env, { anthropic: stub })`.
- **Adding a front-end feature:**
  - create `web/apps/<name>/index.js` exporting `initApp(app)`;
  - add it to `APPS` in `web/app.js`;
  - add tests under `web/tests/apps/<name>/`.
- **Adding a server endpoint group:**
  - create `server/src/apps/<name>/index.js` exporting `bp` (`name`, `prefix`, `routes`, `beforeRequest`);
  - add it to `BLUEPRINTS` in `server/src/app.js`.

`web/env.js` intentionally contains an empty key and an empty `extractionApiUrl`, so the published site never calls a paid endpoint by accident. It is published with the site, so it must never contain secrets. `.env`, `server/.dev.vars`, `server/node_modules/`, and `server/.wrangler/` are ignored.

## Extraction contract (implemented)

```text
POST /api/extract-listing
Content-Type: multipart/form-data
field: image  (PNG / JPEG / WEBP, ≤ 5 MB, must fit 2576 px long edge and 4784 visual tokens)
```

```json
{
  "documentId": "uuid (log correlation only; nothing is stored)",
  "meta": { "mode": "live", "model": "claude-opus-5", "extractedAt": "2026-09-21T08:39:00.000Z",
            "image": { "width": 2000, "height": 1184 }, "confidenceSource": "model-reported" },
  "fields": {
    "rent": { "value": 88000, "confidence": 0.98, "evidence": [0.0325, 0.2297, 0.2225, 0.0372], "sourceText": "賃　料：￥88,000円" }
  },
  "warnings": [{ "code": "inconsistent_values", "message": "専有面積が物件概要（20.15㎡）と間取り図（21.15㎡）で異なります。", "fields": ["areaSqm"] }]
}
```

- `fields` always contains `propertyName`, `rent`, `address`, `station`, `layout`, `areaSqm`, and `constructionYear`.
- `value: null` means unknown, and then `confidence` is `null` too. Unknown is kept separate from a low score.
- `evidence` is `[x, y, width, height]` normalized to the uploaded image, or `null`.
- Warning `code` is one of `inconsistent_values`, `illegible`, `multiple_candidates`, or `other`.
- Errors are `{ "error": { "code", "message" } }`, with a Japanese message safe to show to users:

|Status|Codes|
|---|---|
|400|`missing_image`, `invalid_form`, `empty_image`|
|403|`origin_not_allowed`|
|404|`not_found`|
|405|`method_not_allowed` (with an `Allow` header)|
|413|`image_too_large`|
|415|`unsupported_image`, `unreadable_image`|
|422|`image_needs_resize`, `image_rejected`|
|429|`rate_limited` (with `Retry-After: 60`)|
|500|`internal`|
|502|`refused`, `incomplete`, `invalid_output`, `upstream_error`|
|503|`disabled`, `not_configured`, `upstream_busy`|
|504|`upstream_timeout`|

Design decisions worth keeping:

- **Coordinates:**
  - Claude returns pixel coordinates relative to the image it sees after any resizing.
  - The browser therefore pre-resizes with the documented rule (`resizedSize` in `web/apps/intake/services.js`).
  - The Worker rejects images that would be resized and also marks the image block `oversized_image: "error"`.
  - Together these keep evidence boxes 1:1 with the uploaded pixels.
  - If you change to a model on a different resolution tier, update `MAX_IMAGE_EDGE` and `MAX_VISUAL_TOKENS` in both `web/config.js` and `server/src/config.js`.
- **Structured output:**
  - Built with the SDK's `betaZodOutputFormat`.
  - The Worker calls `create()` rather than `parse()` so it can check `stop_reason` (refusal, max_tokens) before parsing.
  - The SDK moves `enum` into schema descriptions, so warning codes and field names are validated leniently and normalized in `toContract`.
- **Fallbacks:**
  - `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) is enabled.
  - When a fallback runs, the answer is the last text block.
- **Security:**
  - The key exists only as a Worker secret.
  - Logs hold path, status, latency, mode, documentId, and token counts only.
  - Every string from the API or the user is escaped before reaching `innerHTML`.
  - Chat messages the user types are inserted as text.

## Run locally

All commands run from the repository root. Node.js 22 or later is required (Wrangler needs it), plus Python 3 for the static server.

```bash
npm ci --prefix server                          # first time: server dependencies
npm run dev:web                                 # front end at http://localhost:4173 (serves web/)
cp server/.dev.vars.example server/.dev.vars    # first time: EXTRACTION_MODE=mock, no key, no cost
npm run dev:server                              # extraction server at http://localhost:8787
npm run smoke                                   # fixture → Worker → compare with expected.json
npm test                                        # web + server unit tests
```

Open `http://localhost:4173` rather than a `file://` URL; ES modules need HTTP.

To point the front end at the local server, set `extractionApiUrl: "http://localhost:8787"` in `web/env.js` and revert it before committing. In Playwright you can avoid editing the file by intercepting it:

```js
await page.route('**/env.js', (route) => route.fulfill({
  contentType: 'text/javascript',
  body: 'window.RENTAL_DEMO_ENV = { googleMapsApiKey: "", extractionApiUrl: "http://127.0.0.1:8787" };',
}));
```

For real Claude calls, set `EXTRACTION_MODE=live` and `ANTHROPIC_API_KEY` in `server/.dev.vars`. Each call is billed.

Minimum checks before each commit:

```bash
npm test
git diff --check
git status --short
```

When UI behavior changes, verify at least:

- image selection and preview, including re-selecting the same file;
- sample mode (blank `extractionApiUrl`): SAMPLE labels, no per-field gate;
- live/mock mode: disclosure text, loading state, confidence badges, evidence crops and preview highlight, warnings, the review gate blocking submit, and edits counting as confirmation;
- error paths: server error message, network failure, malformed response, explicit "サンプル値で試す";
- provisional candidate insertion, 未取得 labels, unknown rent, and the SOURCE row;
- preference changes and re-ranking, map-pin and card selection;
- candidate detail, rent-chart, and review updates;
- chat trade-off responses, and typed HTML shown as text;
- 1280 px desktop and 390 px mobile layouts;
- browser console errors.

Use the Playwright CLI (`npx @playwright/cli`). Keep generated test artifacts under `output/playwright/`; that directory is ignored. When switching between scenarios, open a new `-s=<session>`, because `page.route` intercepts persist across `run-code` calls on the same page.

To re-render the fictional fixture after editing `server/tests/fixtures/listing-sheet.html`:

1. Render the PNG:

   ```bash
   python3 -m http.server 4174 --directory server/tests/fixtures &
   npx @playwright/cli -s=fixture open http://127.0.0.1:4174/listing-sheet.html
   npx @playwright/cli -s=fixture resize 2000 1184
   npx @playwright/cli -s=fixture screenshot --filename=server/tests/fixtures/listing-sheet.png
   ```

2. Update the pixel boxes in `server/src/apps/listing/mock.js`, the values in `expected.json`, and the numbers in the tests.

## Deployment workflow

**Front end:** GitHub Pages is deployed by `.github/workflows/pages.yml`.

- On a push to `main` that touches `web/`, the workflow runs the front-end tests and then publishes `web/` without `tests/`.
- **One-time switch, required for this layout.**
  - The repository was on a legacy branch build from `/`.
  - Until the source is switched, a push would publish the repository root, which no longer has `index.html`.
  - Switch it with:

    ```bash
    gh api -X PUT repos/SodaShikenn/rental-decision-demo/pages -f build_type=workflow
    git push origin main
    ```

Check deployments with:

```bash
gh run list --workflow pages.yml --limit 3
gh api repos/SodaShikenn/rental-decision-demo/pages --jq '{build_type, html_url}'
```

`.github/workflows/ci.yml` runs `npm test` (web and server) on every push and pull request.

**Extraction server:** not deployed yet. This needs the owner's Cloudflare account and Anthropic API key:

```bash
cd server
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```

Before pointing the public demo at the Worker:

- set a spend limit in the Anthropic Console;
- review `ALLOWED_ORIGINS`, the rate limit (5 per minute per IP), and `EXTRACTION_EFFORT` in `server/wrangler.jsonc`;
- run `npm run smoke -- https://<worker-url>`.

Setting `extractionApiUrl` in the committed `web/env.js` makes the public page call a paid API; it is the owner's decision. `EXTRACTION_ENABLED=false` stops extraction without a code change.

After deployment, verify the public URL in a clean browser and check the console.

## Verification status (2026-09-21, after the restructure)

- `npm test`: 17 web tests and 30 server tests pass.
  - Web: scoring and ranking, unknown-rent handling, the resize rule against the documented examples, review flags, candidate building and provenance text, the request client's error handling (stubbed `fetch`), and chat answers and escaping.
  - Server: image validation, the contract, the Claude request shape, stop-reason and SDK-error mapping, and the app (routing, origin allowlist, CORS, kill switch, rate limit, validation, one log line per request, mock and stubbed live responses).
- `wrangler dev` (real Workers runtime, mock mode): `npm run smoke` passes all seven fields plus the area-mismatch warning. The dry-run bundle builds (≈145 KB gzipped).
- Browser e2e at 1280 px and 390 px, rerun after the restructure, gives the same results as before:
  - sample mode;
  - mock-backed live mode: badges, crops, highlight, warning, the review gate, and provenance;
  - HTML in an edited name and in typed chat input shown as text;
  - all error paths and same-file re-selection;
  - map-pin and card selection, and the maps notes;
  - zero console errors.
- **Not yet run:**
  - the GitHub Actions workflows (they first run on push);
  - real-Claude accuracy, latency, and cost. Run `npm run smoke` against a live-mode Worker and record the results here. The estimate is roughly US$0.05–0.15 per extraction: about 5,000 input tokens (about 3,000 for the image) plus a few thousand output tokens.

## Known issues

- On the selected candidate card, the `SELECTED` tag overlaps the `NN / 99` score. This predates the extraction work.
- With zero priorities selected, the decision summary reads " を優先中". This predates the extraction work.

## Recommended next milestone

1. **Finish the extraction milestone:**
   - switch Pages to GitHub Actions and push;
   - deploy the Worker;
   - run the live smoke test on the fixture and a few more fictional or permitted sheets;
   - record accuracy, latency, and cost here;
   - decide whether the public demo calls it.
   - If the results warrant it, tune `EXTRACTION_EFFORT` and the review threshold using the measured results rather than intuition.
2. **Persistence and schema (the next milestone from the original list):**
   - define a versioned property schema;
   - persist confirmed candidates, including their `provenance`.
   - A natural home is a new `extensions/ext_storage.js` (browser: `localStorage`; server: D1/KV) behind the same `initApp` pattern.

## Later milestones

1. Add Geocoding and Routes through the server (a new `server/src/apps/routes/` blueprint); calculate candidate–destination matrices by departure time and travel mode.
2. Add Places enrichment for only user-selected categories and fields.
3. Add licensed rent-history and review sources. Never scrape third-party property or review sites without permission.
4. Replace neutral placeholder scoring with missing-data-aware ranking and user-adjustable weights (`web/apps/shortlist/services.js`).
5. Add evidence citations and freshness timestamps to every recommendation. Extraction provenance already records source and time.
6. Add browser integration tests for the intake flow to CI. The Playwright scenarios are currently run by hand.
7. Consider a framework/build system only when the static structure becomes a real maintenance constraint.

## Documentation discipline

Keep `README.md` and `README.en.md` aligned. When the UI changes materially:

1. update both READMEs;
2. recapture `assets/demo.png` without private listing images; use `server/tests/fixtures/listing-sheet.png`;
3. state whether a feature is real, simulated, or planned;
4. verify the live Pages deployment after pushing.

## Product intent

The strongest interview story is not “AI recommends an apartment.” It is:

> The system turns unstructured listing material and ambiguous lifestyle preferences into reviewable decision criteria, while separating known facts, provisional inference, missing data, and trade-offs.

Preserve that distinction in future implementation and presentation.

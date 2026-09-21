# Development handoff

Last updated: 2026-09-21 (Asia/Tokyo)

## Project status

NEST is an explainable rental-decision prototype. It helps a renter compare properties using budget, daily routines, priorities, and explicit trade-offs. It includes an image-first intake flow for Japanese rental listing sheets, which is now backed by a real extraction server.

- Repository: https://github.com/SodaShikenn/rental-decision-demo
- Live demo: https://sodashikenn.github.io/rental-decision-demo/
- Primary local checkout: `/Users/soda/Desktop/rental-decision-demo`
- Default branch: `main`
- Hosting: GitHub Pages, deployed from the repository root on `main`
- Front end: dependency-free HTML, CSS, and JavaScript
- Extraction server: Cloudflare Worker in `worker/` calling Claude (`claude-opus-5`). **Implemented and tested locally; not yet deployed.** The public demo therefore still uses sample extraction.

## Important working-tree note

The desktop checkout contains one untracked file:

```text
assets/WechatIMG472.jpg
```

It was not created or committed as part of the public demo. Treat it as user-owned: do not add, modify, move, or delete it without explicit confirmation. It must not be included in a commit by accident. It has also never been sent to the extraction API; tests use the fictional fixture in `worker/test/fixtures/` instead.

## Current user experience

1. A user uploads a PNG, JPEG, or WEBP rental listing sheet. It is previewed locally.
2. **Without an extraction server** (`extractionApiUrl` blank, the Pages default), "画像を読み取る" shows fixed sample values labelled SAMPLE. The image is not sent anywhere.
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

```text
.
├── index.html           # Semantic page structure and all UI sections
├── styles.css           # Design system and responsive layouts
├── app.js               # State, scoring, intake client, review gate, rendering, and chat logic
├── config.js            # Committed blank browser configuration (Maps key, extractionApiUrl)
├── config.example.js    # Example browser configuration
├── .env.example         # Future server-side integration variables
├── assets/demo.png      # Public README preview (fictional fixture sheet, mock mode)
├── README.md            # Japanese documentation
├── README.en.md         # English documentation
├── handoff.md           # This file
└── worker/              # Extraction server (Cloudflare Worker)
    ├── wrangler.jsonc       # Worker config: rate limit binding, vars (origins, mode, kill switch, effort)
    ├── .dev.vars.example    # Local secrets/vars template (mock mode by default)
    ├── src/index.js         # Worker entry (default export only; the runtime rejects other exports)
    ├── src/handler.js       # Routing, CORS/origin allowlist, rate limit, validation, error mapping, logging
    ├── src/image.js         # Magic-byte type sniffing, header dimensions, size and resize-limit checks
    ├── src/extract.js       # Claude call: prompt, structured output, fallbacks, stop-reason handling
    ├── src/schema.js        # Model output schema (zod) and conversion to the public contract
    ├── src/mock.js          # Fixed reading for the fictional fixture
    ├── test/*.test.js       # node:test suites (28 tests)
    ├── test/fixtures/       # listing-sheet.html → .png (fictional) and expected.json ground truth
    └── scripts/smoke.mjs    # Posts the fixture to a running Worker and checks every field
```

`config.js` intentionally contains an empty key and an empty `extractionApiUrl` so GitHub Pages does not return a 404 and never calls a paid endpoint by accident. Never commit a real key. `.env`, `worker/.dev.vars`, `worker/node_modules/`, and `worker/.wrangler/` are ignored.

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
|405|method not allowed|
|413|`image_too_large`|
|415|`unsupported_image`|
|422|`image_needs_resize`, `image_rejected`|
|429|`rate_limited`|
|502|`refused`, `incomplete`, `invalid_output`, `upstream_error`|
|503|`disabled`, `not_configured`, `upstream_busy`|
|504|`upstream_timeout`|

Design decisions worth keeping:

- **Coordinates:**
  - Claude returns pixel coordinates relative to the image it sees after any resizing.
  - The browser therefore pre-resizes with the documented `resizedSize` rule (`app.js`).
  - The Worker rejects images that would be resized and also marks the image block `oversized_image: "error"`.
  - Together these keep evidence boxes 1:1 with the uploaded pixels.
  - If you change the model to one on a different resolution tier, update the limits in both `app.js` and `worker/src/image.js`.
- **Structured output:**
  - Built with the SDK's `betaZodOutputFormat`.
  - The Worker calls `create()` rather than `parse()` so it can check `stop_reason` (refusal, max_tokens) before parsing.
  - The SDK moves `enum` into schema descriptions, so warning codes and field names are validated leniently and normalized in `toContract`.
- **Fallbacks:**
  - `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) is enabled.
  - When a fallback runs, the answer is the last text block.
- **Security:**
  - The key exists only as a Worker secret.
  - Logs hold documentId, status, latency, and token counts only.
  - Every string from the API or the user is escaped before reaching `innerHTML`.
  - This includes chat messages, which previously interpolated candidate names unescaped.

## Run locally

Front end, from the repository root:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173` rather than a `file://` URL.

Extraction server, which needs Node.js 22 or later:

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars   # EXTRACTION_MODE=mock: no key, no cost
npm run dev                      # http://localhost:8787
npm run smoke                    # fixture → Worker → compare with expected.json
```

To point the front end at it, set `extractionApiUrl: "http://localhost:8787"` in `config.js` locally and revert it before committing. In Playwright you can avoid editing the file by intercepting it:

```js
await page.route('**/config.js', (route) => route.fulfill({
  contentType: 'text/javascript',
  body: 'window.RENTAL_DEMO_CONFIG = { googleMapsApiKey: "", extractionApiUrl: "http://127.0.0.1:8787" };',
}));
```

For real Claude calls, set `EXTRACTION_MODE=live` and `ANTHROPIC_API_KEY` in `worker/.dev.vars`. Each call is billed.

Minimum checks before each commit:

```bash
node --check app.js
(cd worker && npm test)
git diff --check
git status --short
```

When UI behavior changes, verify at least:

- image selection and preview, including re-selecting the same file;
- sample mode (blank `extractionApiUrl`): SAMPLE labels, no per-field gate;
- live/mock mode: disclosure text, loading state, confidence badges, evidence crops and preview highlight, warnings, the review gate blocking submit, and edits counting as confirmation;
- error paths: server error message, network failure, malformed response, explicit "サンプル値で試す";
- provisional candidate insertion, 未取得 labels, unknown rent, and the SOURCE row;
- preference changes and re-ranking;
- candidate detail, rent-chart, and review updates;
- chat trade-off responses;
- 1280 px desktop and 390 px mobile layouts;
- browser console errors.

Use the Playwright CLI (`npx @playwright/cli`) as before. Keep generated test artifacts under `output/playwright/`; that directory is ignored.

## Deployment workflow

**Front end:** push to `main`:

```bash
git push origin main
```

GitHub Pages deploys automatically from `/` on `main`. Check the latest build with:

```bash
gh api repos/SodaShikenn/rental-decision-demo/pages/builds/latest \
  --jq '{status: .status, commit: .commit, updated_at: .updated_at}'
```

**Extraction server:** not deployed yet. This needs the owner's Cloudflare account and Anthropic API key:

```bash
cd worker
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```

Before pointing the public demo at the Worker:

- set a spend limit in the Anthropic Console;
- review `ALLOWED_ORIGINS`, the rate limit (5 per minute per IP), and `EXTRACTION_EFFORT` in `wrangler.jsonc`;
- run `npm run smoke -- https://<worker-url>`.

Setting `extractionApiUrl` in the committed `config.js` makes the public page call a paid API; it is the owner's decision. `EXTRACTION_ENABLED=false` stops extraction without a code change.

After deployment, verify the public URL in a clean browser and check the console.

## Verification status (2026-09-21)

- `worker`: 28 `node:test` tests pass. They cover image sniffing and limits, contract normalization, the Claude request shape (model, fallbacks, structured output, no-resize flag, effort), stop-reason and SDK-error mapping, and the handler (CORS, allowlist, kill switch, rate limit, validation, mock and stubbed live responses).
- `wrangler dev` (real Workers runtime, mock mode):
  - `npm run smoke` passes all seven fields plus the area-mismatch warning;
  - a disallowed origin gets 403 and preflight returns the right CORS headers;
  - the sixth request within a minute gets 429.
- Browser e2e at 1280 px and 390 px covered:
  - sample mode;
  - mock-backed live mode: badges, crops, highlight, warning, the review gate, and provenance;
  - HTML in an edited name rendered as text, with no script execution;
  - all error paths and same-file re-selection;
  - zero console errors.
- **Not yet measured:** real-Claude accuracy, latency, and cost. Run `npm run smoke` against a live-mode Worker and record the results here. The estimate is roughly US$0.05–0.15 per extraction: about 5,000 input tokens (about 3,000 for the image) plus a few thousand output tokens.

## Known issues

- On the selected candidate card, the `SELECTED` tag overlaps the `NN / 99` score. This predates the extraction work.

## Recommended next milestone

1. **Finish the extraction milestone:**
   - deploy the Worker;
   - run the live smoke test on the fixture and a few more fictional or permitted sheets;
   - record accuracy, latency, and cost here;
   - decide whether the public demo calls it.
   - If the results warrant it, tune `EXTRACTION_EFFORT` and the review threshold using the measured results rather than intuition.
2. **Persistence and schema (the next milestone from the original list):**
   - define a versioned property schema;
   - persist confirmed candidates, including their `provenance`, locally or in a small database.

## Later milestones

1. Add Geocoding and Routes through the server; calculate candidate–destination matrices by departure time and travel mode.
2. Add Places enrichment for only user-selected categories and fields.
3. Add licensed rent-history and review sources. Never scrape third-party property or review sites without permission.
4. Replace neutral placeholder scoring with missing-data-aware ranking and user-adjustable weights.
5. Add evidence citations and freshness timestamps to every recommendation. Extraction provenance already records source and time.
6. Add automated unit tests for front-end scoring and integration tests for the intake flow. The Worker already has tests; the front end is covered only by manual and Playwright checks.
7. Consider a framework/build system only when the static structure becomes a real maintenance constraint.

## Documentation discipline

Keep `README.md` and `README.en.md` aligned. When the UI changes materially:

1. update both READMEs;
2. recapture `assets/demo.png` without private listing images; use `worker/test/fixtures/listing-sheet.png`;
3. state whether a feature is real, simulated, or planned;
4. verify the live Pages deployment after pushing.

## Product intent

The strongest interview story is not “AI recommends an apartment.” It is:

> The system turns unstructured listing material and ambiguous lifestyle preferences into reviewable decision criteria, while separating known facts, provisional inference, missing data, and trade-offs.

Preserve that distinction in future implementation and presentation.

# Development handoff

Last updated: 2026-09-21 (Asia/Tokyo)

## Project status

NEST is an explainable rental-decision prototype. It helps a renter compare properties using budget, daily routines, priorities, and explicit trade-offs. It also demonstrates an image-first intake flow for Japanese rental listing sheets.

- Repository: https://github.com/SodaShikenn/rental-decision-demo
- Live demo: https://sodashikenn.github.io/rental-decision-demo/
- Primary local checkout: `/Users/soda/Desktop/rental-decision-demo`
- Default branch: `main`
- Hosting: GitHub Pages, deployed from the repository root on `main`
- Current implementation: dependency-free HTML, CSS, and JavaScript

At the time of this handoff, the public page was verified in a real browser with zero console errors on desktop and mobile layouts.

## Important working-tree note

The desktop checkout contains one untracked file:

```text
assets/WechatIMG472.jpg
```

It was not created or committed as part of the public demo. Treat it as user-owned: do not add, modify, move, or delete it without explicit confirmation. It must not be included in a commit by accident.

## Current user experience

1. A user uploads a PNG, JPEG, or WEBP rental listing sheet.
2. The image is previewed locally in the browser and is not transmitted externally.
3. The demo displays editable sample fields for property name, rent, address, station, layout, floor area, and construction year.
4. After confirmation, the listing is added as a provisional comparison candidate.
5. Missing commute, nearby-facility, rent-history, and review data is shown as `未取得`; it is not presented as verified data.
6. Budget and up to two priorities re-rank the candidates.
7. Candidate details separate fit, reasoning, and items that still require verification.
8. A rule-based chat explains simple trade-offs, such as reducing rent by ¥10,000.

## Truthful product boundaries

Keep these limitations visible until the corresponding integrations exist:

- Image extraction is a fixed sample flow for the demonstrated listing-sheet format. It is not OCR or a Vision API call.
- The uploaded image stays in browser memory and is not persisted.
- The map is a mock unless a browser-restricted Google Maps key is supplied.
- Geocoding, Routes, and Places are not connected.
- Property inventory, rent histories, reviews, routes, and facility scores are fictional demo data.
- The chat is rule-based, not an LLM.
- The ranking formula is illustrative and has not been calibrated with users.
- Data is not saved after a page reload.

Do not remove the `DEMO`, `暫定`, `未取得`, or source-limit disclosures merely to make the product appear more complete.

## Repository structure

```text
.
├── index.html           # Semantic page structure and all UI sections
├── styles.css          # Design system and responsive layouts
├── app.js              # State, scoring, image intake, rendering, and chat logic
├── config.js           # Committed blank browser Maps configuration
├── config.example.js   # Example browser Maps configuration
├── .env.example        # Future server-side integration variables
├── assets/demo.png     # Public README preview
├── README.md           # Japanese documentation
├── README.en.md        # English documentation
└── handoff.md          # This file
```

`config.js` intentionally contains an empty key so GitHub Pages does not return a 404. Never commit a real key. `.env` is ignored and reserved for future server-side secrets.

## Run locally

From the repository root:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173` rather than opening `index.html` with a `file://` URL.

Minimum checks before each commit:

```bash
node --check app.js
git diff --check
git status --short
```

When UI behavior changes, verify at least:

- image selection and preview;
- extraction-form visibility and editability;
- provisional candidate insertion;
- missing-data labels for the imported candidate;
- preference changes and re-ranking;
- candidate detail, rent-chart, and review updates;
- chat trade-off responses;
- 1280 px desktop and 390 px mobile layouts;
- browser console errors.

Use the Playwright CLI workflow already used for this project. Keep generated test artifacts under `output/playwright/`; that directory is ignored.

## Deployment workflow

Normal publication is a push to `main`:

```bash
git push origin main
```

GitHub Pages deploys automatically from `/` on `main`. Check the latest build with:

```bash
gh api repos/SodaShikenn/rental-decision-demo/pages/builds/latest \
  --jq '{status: .status, commit: .commit, updated_at: .updated_at}'
```

After deployment, verify the public URL in a clean browser and check the console. Both READMEs and the GitHub repository Website field already link to the live demo.

## Recommended next milestone

The next meaningful milestone is real listing-sheet extraction. Do not add more mock ranking features before this boundary is resolved.

### Open architecture decision

GitHub Pages can host only the static front end. Real Vision/OCR, Routes, Places, property-data, or LLM credentials must not run in browser JavaScript. Choose a server-side runtime first, for example a small Vercel/Cloudflare function or another controlled API service.

### Proposed extraction contract

```text
POST /api/extract-listing
Content-Type: multipart/form-data
field: image
```

Suggested response shape:

```json
{
  "documentId": "...",
  "fields": {
    "propertyName": { "value": "...", "confidence": 0.98, "evidence": [0, 0, 0, 0] },
    "rent": { "value": 95000, "confidence": 0.99, "evidence": [0, 0, 0, 0] },
    "address": { "value": "...", "confidence": 0.94, "evidence": [0, 0, 0, 0] },
    "station": { "value": "...", "confidence": 0.91, "evidence": [0, 0, 0, 0] },
    "layout": { "value": "1K", "confidence": 0.99, "evidence": [0, 0, 0, 0] },
    "areaSqm": { "value": 21.37, "confidence": 0.98, "evidence": [0, 0, 0, 0] },
    "constructionYear": { "value": 2001, "confidence": 0.95, "evidence": [0, 0, 0, 0] }
  },
  "warnings": []
}
```

Requirements for the first real version:

- keep API credentials server-side;
- validate file type and size;
- delete uploaded images after processing unless the user explicitly opts in to storage;
- return field-level confidence and evidence regions;
- require human confirmation before a field affects ranking;
- preserve `unknown` separately from a low score;
- log source and retrieval time for every enrichment;
- impose rate limits, timeouts, and cost controls;
- do not send images or personal routine data to additional providers without disclosure.

## Later milestones

After extraction works end to end:

1. Define a versioned property schema and persist confirmed candidates locally or in a small database.
2. Add Geocoding and Routes through the server; calculate candidate–destination matrices by departure time and travel mode.
3. Add Places enrichment for only user-selected categories and fields.
4. Add licensed rent-history and review sources. Never scrape third-party property or review sites without permission.
5. Replace neutral placeholder scoring with missing-data-aware ranking and user-adjustable weights.
6. Add evidence citations and freshness timestamps to every recommendation.
7. Add automated unit tests for scoring and integration tests for the intake flow.
8. Consider a framework/build system only when the static structure becomes a real maintenance constraint.

## Documentation discipline

Keep `README.md` and `README.en.md` aligned. When the UI changes materially:

1. update both READMEs;
2. recapture `assets/demo.png` without private listing images;
3. state whether a feature is real, simulated, or planned;
4. verify the live Pages deployment after pushing.

## Product intent

The strongest interview story is not “AI recommends an apartment.” It is:

> The system turns unstructured listing material and ambiguous lifestyle preferences into reviewable decision criteria, while separating known facts, provisional inference, missing data, and trade-offs.

Preserve that distinction in future implementation and presentation.

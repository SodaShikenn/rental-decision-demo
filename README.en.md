# Rental Helper

[日本語](README.md) | [English](README.en.md)

**[▶ Open the Live Demo](https://sodashikenn.github.io/rental-helper/)**

![Rental Helper demo interface](assets/demo.png)

Rental Helper reads Japanese rental listing sheets (募集図面, also called マイソク), compares the candidates against a renter's own conditions, and shows what to check before signing and what moving in will cost. The text on each sheet is read with **[Docling](https://github.com/docling-project/docling)**, and every value on screen can be traced to its position on the sheet and its OCR confidence.

The renter decides; the tool never picks a property. It **closes the information gap** between renters and agencies, helps renters **find out what they need**, and makes **narrowing down the candidates efficient**, showing where on the sheet each value came from, what must be compromised, what to confirm before the contract, and what is still unknown.

## What the demo shows

- The candidates are values read from **three real listing sheets** (ルーブル渋谷松濤 408号室, Bresport, and GRAN PASEO明大前Ⅳ). They are as of the recording (September 2026); whether the units are still available has not been checked
- Orders candidates by how well they match the renter's own conditions (monthly limit, up to two non-negotiables: station access, floor area, building age), or by monthly cost, move-in cost, walk, floor area, or building age. The match is a guide for sorting, not a recommendation
- **Your situation (あなたの状況):** choosing situations such as “may move within two years”, “want to view first”, “foreign national”, “work from home”, “cook often”, “use a bicycle”, “have large furniture”, or “avoid the ground floor” brings forward the checks, terms, and costs that concern that renter (a bicycle adds the parking fee), with a count per candidate
- **Pre-contract checks (契約前に確認すること):** finds clauses renters tend to miss in each sheet's text: early-termination penalties, two-month notice periods, renewal fees, deposits that are not returned, guarantor fees, mandatory add-on services, contracting before a viewing, photos of a different unit, terms for foreign nationals, no elevator, and more. Each check explains why it matters and shows where it is printed
- **Move-in cost estimate (初期費用の試算):** adds the sheet's money terms (deposit, key money, guarantor fee, key exchange, insurance, cleaning, …) to what sheets never print (brokerage fee, prorated and prepaid rent), per candidate. Change the move-in date or brokerage fee, or leave items out, to compare; it also shows the real monthly cost and what is due each year, at renewal, and on moving out
- **Glossary (用語辞典):** explains terms seen on sheets and in portal search filters, such as 1K, WIC, SRC, 壁式RC, 独立洗面台, 追い焚き, 敷金償却, and 定期借家, from the renter's side. Open it from each candidate's list of terms on its sheet, or from any “?”
- For the selected candidate, shows each value with a crop of the sheet where it was printed, the text OCR read there, and its confidence, plus a link to open the original sheet
- Imports a listing sheet by choosing or dropping an image, in four steps: choose → read → check against the original → add. Without a sheet at hand, “サンプル図面で試す” uses a real one (モノハウス 104号室)
- Blocks the candidate until a person checks low-confidence fields, unreadable fields, and inconsistencies within the sheet (for example, a summary area that disagrees with the floor plan)
- A candidate whose sheet prints no rent is never treated as affordable: its budget score is neutral and it is marked 暫定 (provisional). Its move-in cost can be estimated once the renter enters a rent quoted by the agency
- Commute time and surroundings are not estimated, because their data sources are not connected; they are marked 未接続 (not connected)
- Answers fixed questions such as “Which has the lowest move-in cost?”, “What should I check before signing?”, or “What is 敷金償却?” from the current conditions and data
- Labels every feature on screen as live (稼働中), demo (デモ), or not connected (未接続), and lists what each does now and what it needs to go live under “機能の状態”

### What is real, recorded, or planned

|Feature|Status|
|---|---|
|Listing-sheet extraction|**Real when the extraction server is configured.** In the FastAPI server in `server/`, Docling (RapidOCR PP-OCRv6) reads the text and its positions, and Gemini (`gemini-3.8-flash`) maps it to fields and money terms, citing the lines it used. The server checks that each value really appears in its cited lines; values that don't get lower confidence and need review|
|Pre-contract checks|**Implemented.** The server finds them in the OCR text with fixed rules (`server/apps/listing/checks.py`). Clauses worded unusually can be missed, and the page says so|
|Move-in cost estimate, glossary|**Implemented** (computed and shown in the browser). The estimate is a guide, not a quote|
|The three candidates and the sample sheet|**Recorded readings of real listing sheets.** OCR really ran (with confidence and positions). Because Gemini has not been run yet, lines were mapped to fields by hand, and every value was checked against the original (`server/tests/fixtures/sheets.json`). The same command replaces the manual mapping with Gemini's once a key is set|
|Extraction on the public demo (GitHub Pages)|**Sample sheet only** (its recorded reading). `extractionApiUrl` in `web/env.js` is blank, so a chosen image is never sent anywhere or read|
|Extraction server in mock mode|**Fixed test response** matching the fictional sheet `server/tests/fixtures/listing-sheet.png`; labelled “モック応答 · 画像は未解析” on screen|
|Commute time, surroundings, rent history, reviews|**Not connected.** Nothing is estimated or copied from third-party sites|
|Chat|**Rule-based** (not an LLM)|
|Persistence|**Not implemented.** Added candidates are lost on reload|

With the extraction server, OCR runs inside the server and only the recognized text is sent to Google's Gemini API; the image itself never leaves the server, is never written to disk, and exists only in memory for the duration of the request. The page states this before anything is sent. On the Gemini API's free tier, Google may use submitted content to improve its products, so production uses the paid tier.

The copies of the sheets published with the site are downscaled to a 2560 px long edge, with contact details such as the management company's phone numbers painted over.

## OCR: Docling

Reading the sheets is built on [Docling](https://github.com/docling-project/docling), the open-source (MIT) document conversion toolkit from IBM Research.

```text
image ─▶ Docling (layout analysis + RapidOCR PP-OCRv6, Japanese) ─▶ text lines with positions and confidence
      ─▶ Gemini (maps fields and money terms, citing line ids) ─▶ values traced to their lines ─▶ a person checks the original
      └▶ pre-contract checks (fixed rules on the line text)
```

- **Lines, positions, and confidence in one pass:** Docling analyzes the page layout and returns each text line from its built-in OCR engine with its box and confidence. The evidence crops, the highlight on the preview, and the review gate are all built from that output.
- **Runs inside the server:** the models are baked into the container at build time and run offline. The image never leaves the server; Gemini receives only the recognized text.
- **Measured on the real sheets (CPU):** about 1.5 s per sheet. For all 32 fields on the four sheets, the line holding the value was read. Two misreads (ブ read as プ in “Bresport”, Ⅳ read as V) were caught by tracing the values to their lines and flagged for review.
- **Image handling changes accuracy:** red caveats such as 「補足事項あり」 became unreadable after JPEG chroma subsampling (4:2:0). The published copies are saved at 4:4:4, the browser uploads images that fit without re-encoding them, and the server applies EXIF rotation itself.
- Configuration lives in `server/extensions/ext_ocr.py`: `PdfPipelineOptions(do_ocr=True, generate_parsed_pages=True)` with `RapidOcrOptions(lang=["iso:ja"], force_full_page_ocr=True)`. The converter loads once at startup and processes one image at a time in a worker thread.

## Run locally

### Everything with Docker (recommended)

Runs the front end and the extraction server on one URL (requires Docker and Docker Compose).

```bash
cp server/.env.example server/.env   # defaults to EXTRACTION_MODE=mock (no API key, no cost)
npm run up                           # = docker compose -f docker/docker-compose.yml up --build
```

Open `http://localhost:8080`. The server's API reference is at `http://localhost:8080/docs`. nginx serves `web/` and forwards `/api` to the server. Stop with `npm run down`.

### Separately

The front end (`web/`) is static files with no build step. Run commands from the repository root (Node.js 22 or later, Python 3.13 or later).

```bash
npm run dev:web      # http://localhost:4173 (serves web/)
npm test             # front-end and server unit tests (the server needs the setup below)
```

Use that URL rather than opening `index.html` as a `file://` URL. While `extractionApiUrl` in `web/env.js` is blank, only the sample sheet's recorded reading is shown.

On a push to `main`, GitHub Actions (`.github/workflows/pages.yml`) runs the tests and publishes only `web/` to GitHub Pages.

## Extraction server (server/)

A FastAPI server providing `POST /api/extract-listing` (`multipart/form-data`, field name `image`) and `GET /healthz`.

```bash
cd server
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env                 # defaults to EXTRACTION_MODE=mock
cd ..
npm run dev:server                   # http://localhost:8000 (API reference: /docs)
npm run smoke                        # posts the fictional sheet and compares every field with the ground truth
```

To use it from the front end, set `extractionApiUrl: "http://localhost:8000"` in your local `web/env.js` (do not commit it). For real extraction, set `EXTRACTION_MODE=live` and `GEMINI_API_KEY` (a Google AI Studio key) in `server/.env`. OCR runs inside the server; each Gemini call is billed. The OCR models take a few seconds to load on first start.

The page's “機能の状態” asks the server's `/healthz` for its real state (live, mock, missing API key, disabled, or unreachable) and shows it.

### Recording real sheets and measuring accuracy

The demo candidates were recorded by running OCR on the listing sheets with this command, which generates `web/data/sheets.js`:

```bash
npm run record:sheets              # real OCR; fields and money terms mapped from the ground truth (no Gemini call)
npm run record:sheets -- --gemini  # OCR plus Gemini, scored item by item against the ground truth (4 billed calls)
```

The ground truth (`server/tests/fixtures/sheets.json`) holds each sheet's fields and money terms and the OCR lines they are printed on. With `--gemini`, the command reports which items on the 4 real sheets Gemini mapped correctly, and puts its reading into the demo; any difference from the checked values shows up as a correction (修正あり) in the source. When the original images (`assets/Apt*.jpg`) are present, it also rebuilds the published copies (downscaled, contact details masked). The originals are not tracked in Git.

**Deployment:** the image built from `server/Dockerfile` runs as is on container platforms such as Cloud Run, Render, or Fly.io.

```bash
docker build -t rental-helper-api server
docker run -p 8000:8000 -e EXTRACTION_MODE=live -e GEMINI_API_KEY=... -e ALLOWED_ORIGINS=https://sodashikenn.github.io rental-helper-api
```

Pass the API key as a secret (environment variable) of the platform; it is never part of the image. Behind a reverse proxy, set `FORWARDED_ALLOW_IPS` so client IPs are read correctly. Setting the deployed URL as `extractionApiUrl` in `web/env.js` enables extraction on the public demo. That exposes a paid API, so decide based on expected use and cost.

**Response format:**

- `fields`: 8 fields (property name, rent, management fee, address, station, layout, floor area, construction year), each with a `value` (`null` when it could not be read; `0` for a fee included in the rent), a `confidence` (0–1, the OCR engine's score for the cited lines, reduced when the value doesn't match them), `evidence` (the cited lines' position as `[x, y, width, height]` normalized to the image), and `sourceText` (the cited lines as OCR read them)
- `costs`: money terms (deposit, key money, amortization, guarantor fees, free rent, renewal fee, other charges) with amount and unit (months, percent, or yen), when each is paid (at contract, monthly, yearly, at renewal, on moving out), whether it is tax-exclusive, and whether it is required, checked against their lines like the fields
- `checks`: pre-contract checks (category, reason, cited lines)
- `lines`: every OCR line
- `warnings`: inconsistencies or illegible parts of the sheet. `meta` holds the mode, model, and extraction time

**Safeguards and cost control:**

- The API key lives only in the server's environment; it is never in the browser or the image
- File type is detected from the leading bytes, not the extension (PNG / JPEG / WEBP, up to 5 MB). Uploads are processed in memory and never written to disk
- The browser only downscales images with a long edge over 2560 px (others are sent without re-encoding); the server accepts up to 4096 px and 12 megapixels
- Only OCR text is sent to Gemini, never the image. The response is constrained by a JSON schema, and the server checks that every value actually appears in its cited lines
- If Gemini stops for safety reasons or its output is cut off, no values are returned; the request fails with an error instead
- CORS is returned only for allowed origins; requests are limited to 5 per minute per IP (per process; move to a shared store such as Redis before running several instances). An output-token cap, a 60-second timeout, and a kill switch (`EXTRACTION_ENABLED=false`) are configured
- The container runs as a non-root user and has a health check (`/healthz`)
- Logs keep only the document ID, latency, and token counts, never images or extracted values
- Setting a Google Cloud budget alert and a Gemini API usage cap, and using the paid tier in production, is recommended

Cost estimate (not yet measured): OCR runs inside the server, so it is free. Each Gemini (`gemini-3.8-flash`) call sends about 1,500 input tokens and receives about 1,000 output tokens, under ¥1 at 2026 prices. In exchange, the server needs CPU and memory (about 2 GB or more).

## Environment variables and API keys

Server settings and secrets go in `server/.env` (created from `server/.env.example`, not tracked by Git), and in production they are passed as environment variables of the platform. `server/.env.example` also lists entries for future integrations such as Routes, Places, and property data.

The public demo's `web/env.js` contains only an empty key and an empty `extractionApiUrl`. It is published with the site, so it must never contain secrets. Docker Compose swaps in `docker/web/env.js`, which uses the extraction server on the same origin. To try the map locally, temporarily set a browser key restricted by HTTP referrer and API, and never commit a real key.

## How the renter-side features were chosen

The pre-contract checks came from showing the four real listing sheets, as plain images, to an LLM (Claude) and asking what renters most often overlook and should confirm before signing. The rules keep what can be recognized from the printed words. The points raised across all four sheets were: (1) costs hidden by comparing rent plus fee only (guarantor fees, mandatory support services, insurance); (2) the cost of leaving early (early-termination penalties, two-month notice) and renewal fees; (3) deposits that are amortized, which work like key money; (4) contracting before a viewing, photos of another unit, and “as-is” clauses; (5) terms for foreign nationals; and (6) building conditions such as a ground-floor unit or no elevator. The move-in cost estimate puts (1) into comparable numbers, and the glossary addresses the vocabulary barrier.

## Integrations needed for a real service

|Purpose|Candidate integration|Design notes|
|---|---|---|
|Property data|Licensed property data with reuse permission|Track property ID, listing time, address, rent, and layout|
|Structuring listing sheets|FastAPI + Docling OCR + Gemini (**implemented**, `server/`)|Process images transiently, return field-level confidence and evidence regions, and let a person confirm|
|Geocoding addresses and destinations|Geocoding API|Convert addresses or Place IDs to coordinates (the current map places candidates at their nearest station)|
|Map display|Maps JavaScript API|Restrict the browser key by HTTP referrer and API|
|Commute and daily routes|Routes API|Compare candidates × destinations with `computeRouteMatrix`, and store day, time, and travel mode as evidence|
|Nearby facilities|Places API (New)|Limit to the categories, distances, and opening hours the user chose, and request only needed fields|
|Rent history and reviews|Data providers with reuse permission|Separate listed rent from contracted rent, and show retrieval date and source|

**Review-site survey (September 2026):** the four candidates were looked up on the main Japanese review and rating sites. Only ルーブル渋谷松濤, a condominium building, had building-level ratings and reviews (マンションレビュー, IESHIL); the small rental buildings (モノハウス, Bresport) and the new build (GRAN PASEO明大前Ⅳ) had none. LIFULL HOME'S keeps past listed rents in its property archive, but each site's terms of use prohibit reproducing or reusing its content without permission. The demo therefore shows no reviews, and the plan is to connect licensed sources (for example ratings and reviews from the Google Places API) and public data (for example MLIT's 不動産情報ライブラリ) instead.

The design never scrapes third-party property or review sites without permission. Inputs such as address, workplace, and return times should be optional, with the retention period and purpose stated.

Official documentation: [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/get-api-key) / [Routes API](https://developers.google.com/maps/documentation/routes) / [Places API (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search) / [Geocoding API](https://developers.google.com/maps/documentation/geocoding)

## Design priorities

1. **The renter decides** — the order follows the conditions and the sort the renter chose; the tool does not recommend.
2. **Ask for requirements first** — the monthly limit and “your situation” put into words what matters to this renter.
3. **Limit priorities** — at most two non-negotiables, so the comparison does not sprawl.
4. **Make trade-offs concrete** — express a rent difference as differences in station access, floor area, and building age, and as move-in and real monthly costs.
5. **Separate the evidence** — show where on the sheet each value came from and what OCR read, so the ranking and the estimate can be checked.
6. **Say what is unknown** — values missing from a sheet are neutral and marked provisional, and data from unconnected sources is never guessed.

## Structure

The front end (`web/`) and the extraction server (`server/`) are separate, and both follow the same conventions as [LLM-RAG_KBQA](https://github.com/SodaShikenn/LLM-RAG_KBQA). An entry point (`app.js` / `app.py`) initializes extensions (`extensions/ext_*`) and registers feature apps (`apps/<name>/`); settings live in `config` and shared helpers in `helper`.

```text
.
├── package.json              # dev and test commands (npm run up / dev:web / dev:server / test / smoke / record:sheets)
├── .github/workflows/        # tests and Docker build check (ci.yml) and GitHub Pages publishing (pages.yml)
├── assets/demo.png           # README preview (the original listing sheets, Apt*.jpg, are not tracked)
├── docker/                   # docker-compose.yml, nginx.conf, env.js for Compose
├── web/                      # front end (static files, published to GitHub Pages)
│   ├── index.html            # page structure
│   ├── app.js                # entry point: initializes extensions and registers apps
│   ├── config.js             # settings (reads values from env.js)
│   ├── env.js                # per-deployment values (Maps key, extraction server URL; never secrets)
│   ├── helper.js             # shared helpers (money formatting, escaping, evidence crops, glossary buttons, …)
│   ├── data/sheets.js        # recorded readings of the listing sheets (generated by record_sheets)
│   ├── extensions/           # ext_store (state and change events), ext_google_maps
│   ├── apps/
│   │   ├── capabilities/     # status of each feature (live / demo / not connected), listed and shown
│   │   ├── shortlist/        # conditions, comparison table and ranking, station map
│   │   ├── insights/         # judgment notes, pre-contract checks, score breakdown, sheet evidence, terms on the sheet
│   │   ├── costs/            # move-in and real monthly cost estimate
│   │   ├── glossary/         # glossary of rental terms
│   │   ├── chat/             # rule-based analysis chat
│   │   └── intake/           # listing-sheet intake (choose, drop, sample sheet) and review of the reading
│   ├── static/               # CSS, favicon, sheets/ (published copies of the listing sheets)
│   └── tests/                # unit tests (node:test)
└── server/                   # extraction server (FastAPI)
    ├── app.py                # entry point: create_app(), extensions, routers, shared error handling
    ├── config.py             # settings (model, limits, environment variables)
    ├── helper.py             # shared helpers (AppError, JSON responses)
    ├── extensions/           # ext_ocr (Docling), ext_gemini, ext_cors, ext_logger, ext_rate_limit
    ├── apps/listing/         # listing-sheet extraction API
    │   ├── __init__.py       # router and pre-request checks (kill switch, rate limit)
    │   ├── views.py          # request handling
    │   ├── forms.py          # image validation
    │   ├── services.py       # OCR → Gemini → evidence checks → pre-contract checks
    │   ├── evidence.py       # checks each value and money term appears in its cited lines; 坪 cross-check
    │   ├── checks.py         # rules for the pre-contract checks
    │   ├── prompts.py        # prompts for Gemini
    │   ├── models.py         # Gemini response schema and the public contract
    │   └── mock.py           # mock response
    ├── commands/             # smoke.py (fictional sheet check), record_sheets.py (record real sheets, measure accuracy)
    ├── tests/                # unit tests (pytest), the fictional sheet, ground truth for the real sheets (sheets.json)
    ├── requirements*.txt     # dependencies (runtime and dev)
    └── Dockerfile            # container image of the extraction server
```

Every app uses the same file roles:

- `index.js`: registers the app
- `views.js`: DOM (or HTTP) handling
- `services.js`: logic independent of the page (unit tested)
- `models.js`: data definitions

### Adding a feature

- **Front end:** define `initApp(app)` in `web/apps/<name>/index.js` and add it to `APPS` in `web/app.js`. Read state from `app.extensions.store` and react to changes with `store.on("change", ...)`.
- **Server API:** define a `router` (`APIRouter`, with pre-request checks as `dependencies`) in `server/apps/<name>/__init__.py` and add it to `register_routers` in `server/app.py`.
- **External services:** define `initApp(app)` in `web/extensions/ext_<name>.js` for the front end, or `init_app(app)` in `server/extensions/ext_<name>.py` for the server, and add it to that side's `initializeExtensions` / `initialize_extensions`. Server tests swap them out, as in `create_app(settings, gemini_client=stub, ocr_reader=stub)`.
- **Settings:** fixed values go in `config.js` / `config.py`; per-environment values go in `web/env.js` for the browser and in environment variables for the server (`server/.env` locally).
- **Adding a sheet:** put the original image in `assets/`, add its ground truth and cited lines to `server/tests/fixtures/sheets.json`, and run `npm run record:sheets`. To start the comparison with it, add its id to `SEED_SHEET_IDS` in `web/apps/shortlist/models.js`.
- **Adding checks or terms:** rules go in `RULES` in `server/apps/listing/checks.py`; glossary entries go in `GLOSSARY` in `web/apps/glossary/models.js`.

## Verified behavior

- OCR of the four real listing sheets: about 1.5 s each. For all 32 fields and all 40 money terms, the line holding the value was read, and every amount matches the text of its cited line. The misreads ブ → プ and Ⅳ → V were flagged for review
- Pre-contract checks: 10–12 per sheet. The red 「補足事項あり」 note is found once the copy is saved at 4:4:4
- Move-in cost estimate (for example ¥428,597 for モノハウス 104号室, moving in on 10/15 with one month's brokerage), following the move-in date, brokerage fee, excluded items, and an entered rent
- Glossary: search, categories, opening from any “?” or term chip, and closing with Esc
- Immediate re-ranking, reviewing and adding the sample sheet, and extraction through the server in mock mode
- Chat answers about trade-offs, move-in costs, checks, and terms (typed text is never parsed as HTML)
- Responsive desktop and mobile layouts (no horizontal scrolling at 390 px), light and dark themes
- Unit tests (`npm test`): scoring, move-in costs, term detection, the review gate, source text, chat answers, capability status, and consistency of the recorded data (node:test); server validation, evidence and money-term checks, check rules, EXIF rotation, the Gemini request, and routing (pytest; the real-OCR tests run with `RUN_OCR_TESTS=1`)
- Starting with Docker Compose, extraction through nginx (mock), and the health check

## Next steps

- Set a Gemini key and run `npm run record:sheets -- --gemini` to record mapping accuracy, latency, and cost on the real sheets
- Compare travel times by day, time, and travel mode with the Routes API
- Evaluate daily-life surroundings (supermarkets, clinics, childcare, restaurants) with the Places API
- Connect licensed property data, listed-rent history, and reviews with reuse permission
- Save confirmed candidates, with a versioned property schema
- An LLM chat that cites its evidence, and learning from post-viewing feedback

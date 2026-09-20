# NEST — Explainable Rental Decision Demo

[日本語](README.md) | [English](README.en.md)

**[▶ Open the Live Demo](https://sodashikenn.github.io/rental-decision-demo/)**

![NEST demo interface](assets/demo.png)

NEST is a front-end prototype for comparing rental homes through daily routines, priorities, and acceptable trade-offs—not only rent, floor plan, and distance from a station.

The goal is not to output a single opaque “best” property. It helps a user understand why a candidate fits, what must be compromised, and what should be verified next.

## What the demo shows

- Uploads and previews PNG, JPEG, or WEBP rental sheets locally in the browser
- Lets the user review and edit sample-extracted rent, address, station, layout, floor area, and construction year
- Adds the uploaded listing as a provisional candidate while clearly marking route and neighborhood data as missing
- Re-ranks candidates from a monthly budget and up to two non-negotiable priorities
- Compares commute time, late-night shopping, quietness, and workspace suitability
- Explains the fit, trade-offs, and questions to check during a viewing
- Updates rent-history charts and resident-review cards with the selected candidate
- Answers trade-off questions such as “What if I reduce the rent by ¥10,000?”
- Displays Google Maps when a Maps JavaScript API key is configured

The current image analysis uses fixed sample extraction values for this rental-sheet format, and the uploaded image never leaves the browser. A production version would send the image to a server-side Vision/OCR endpoint and return extracted values, confidence scores, and evidence regions. The current chat is rule-based so that its reasoning remains easy to inspect. All properties, routes, rent histories, reviews, and facility scores are fictional demo data.

## Run locally

No package installation is required.

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`. Because `index.html` is at the repository root, the project can also be published directly with GitHub Pages.

## Environment and API keys

Prepare a local environment file for future server-side integrations:

```bash
cp .env.example .env
```

This is currently a static front end, so it does not read `.env` yet. The file is reserved for a future server layer that connects Routes, Places, licensed property data, or an LLM.

To test map rendering, copy `config.example.js` to `config.js` and add a browser key restricted by HTTP referrer and API scope. Both `config.js` and `.env` are ignored by Git.

```bash
cp config.example.js config.js
```

## Integrations required for a real service

|Purpose|Candidate integration|Design requirement|
|---|---|---|
|Property inventory|Licensed or contract-authorized property feed|Track property ID, listing date, address, rent, and floor plan|
|Rental-sheet structuring|Server-side Vision/OCR endpoint|Process images temporarily and return field-level confidence and evidence regions for human confirmation|
|Address resolution|Geocoding API|Convert an address or Place ID into coordinates|
|Map display|Maps JavaScript API|Restrict the browser key by HTTP referrer and API scope|
|Commute and daily routes|Routes API|Compare candidate–destination pairs with `computeRouteMatrix`, retaining weekday, departure time, and travel mode as evidence|
|Nearby facilities|Places API (New)|Request only user-selected categories, distances, opening hours, and necessary fields|
|Rent history and reviews|A source that explicitly permits reuse|Separate asking rent from contracted rent and show source and retrieval date|

The product is not designed to scrape third-party property or review sites without permission. Workplace, home address, and routine data should remain optional, with an explicit purpose and retention policy.

Official references: [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/get-api-key) / [Routes API](https://developers.google.com/maps/documentation/routes) / [Places API (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search) / [Geocoding API](https://developers.google.com/maps/documentation/geocoding)

## Product principles

1. **Ask for constraints first** — Define exclusion boundaries such as total budget and maximum commute time.
2. **Limit priorities** — Keeping non-negotiables to two prevents an unhelpful list of equally weighted criteria.
3. **Translate compromise into daily impact** — Express a rent difference as a change in commute time or routine.
4. **Separate evidence from interpretation** — Present fit, source data, and caveats independently so the ranking can be challenged.
5. **Show data limitations** — Do not mix fictional data, asking rent, contracted rent, and subjective reviews.

## Repository structure

```text
.
├── index.html           # Page structure
├── styles.css          # Responsive visual design
├── app.js              # Scoring, ranking, and chat logic
├── config.example.js   # Browser-side Maps configuration example
├── .env.example        # Future server-side configuration example
└── assets/demo.png     # README preview
```

## Verified interactions

- Re-ranking after preference changes
- Image upload, preview, sample extraction, and provisional-candidate insertion
- Synchronized explanation, rent chart, and reviews after candidate selection
- Chat responses to trade-off questions
- Responsive desktop and mobile layouts
- Graceful fallback to the mock map without an API key

## Next steps

- Compare travel time by weekday, departure time, and mode with Routes API
- Evaluate access to groceries, healthcare, childcare, and restaurants with Places API
- Replace demo inventory and rent histories with licensed data
- Add an evidence-grounded LLM chat and post-viewing feedback loop
- Publish the static site through GitHub Pages

<div align="center">

# Rental Helper

### Start with homes. Discover what matters.

A rental decision assistant for Japan that turns a shortlist into<br>
sourced comparisons, candidate-based questions, and confirmed priorities.

[**Explore the sample ↗**](https://sodashikenn.github.io/rental-helper/) · [**Watch the concept video ↗**](https://sodashikenn.github.io/rental-helper/demo/) · [**日本語**](README.ja.md)

[![Tests](https://github.com/SodaShikenn/rental-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/SodaShikenn/rental-helper/actions/workflows/ci.yml)

[![Play the Rental Helper walkthrough: compare candidates, inspect evidence and confirm priorities](web/demo/media/poster.jpg)](https://sodashikenn.github.io/rental-helper/demo/)

**84-second concept video · scripted AI** · [English / Japanese captions](https://sodashikenn.github.io/rental-helper/demo/) · [Transcript](web/demo/media/transcript.md)

</div>

> **Public sample:** comparison, guided choices, Maps links and HTML export work without an account. Image/link analysis, AI, walking checks, leisure discovery, web reviews and hosted sharing are currently unavailable on this public site because no backend is connected. The video is an earlier recorded concept walkthrough with scripted AI; it does not cover all current features or demonstrate a fully deployed app. [Local setup](docs/DEVELOPMENT.md)

## The problem

“I like these three apartments. How do I decide what matters?”

Listings scatter prices, floor plans and location claims across images and websites. A tenant may care about cost, commuting and daily routines without knowing how to prioritize them. Rental Helper starts with the homes they already found, investigates the differences, and asks concrete questions. **Only priorities the tenant confirms become part of the decision brief.**

No upfront requirements essay. No unexplained overall score.

## Explore in three steps

1. **Compare the evidence.** [Open the shortlist](https://sodashikenn.github.io/rental-helper/#compare) and click a monthly price. Another unit's rent appears as a reference, not as this home's confirmed cost.
2. **Discover a priority.** Choose **費用 → 比較から選ぶ**, select a budget suggested by the candidates, then confirm its importance. With the API connected, **AI 分析** asks follow-up questions grounded in candidate evidence.
3. **Take a useful next step.** [Check commute links](https://sodashikenn.github.io/rental-helper/#commute), read the [generated brief](https://sodashikenn.github.io/rental-helper/#needs), and [download HTML](https://sodashikenn.github.io/rental-helper/#sharing).

**Skip to a video chapter:** [Price evidence](https://sodashikenn.github.io/rental-helper/demo/#chapter=1) · [AI dialogue](https://sodashikenn.github.io/rental-helper/demo/#chapter=2) · [Explicit confirmation](https://sodashikenn.github.io/rental-helper/demo/#chapter=3) · [Commute](https://sodashikenn.github.io/rental-helper/demo/#chapter=4) · [Brief & export](https://sodashikenn.github.io/rental-helper/demo/#chapter=5)

<details>
<summary><strong>All eight workspace views</strong></summary>

| View | What it helps the tenant do |
| --- | --- |
| **候補比較 · Compare** | Add listing images or links; compare costs, space and sources; research missing monthly charges. |
| **通勤 · Commute** | Choose a Tokyo hub or destination and open prefilled outbound/return Maps routes. Set the 08:00 arrival / 18:00 departure schedule in Maps. |
| **駅・買い物 · Essentials** | Check listed walking claims against dated Maps route estimates and nearby shops. |
| **余暇 · Leisure** | See parks, gyms and cafés before confirming interests and frequency. |
| **口コミ分析 · Reviews** | Search the room, building, then nearby apartments. Keep source identity visible and leave missing reviews blank. |
| **暮らしの試算 · Scenarios** | Compare known costs and confirmed interests under weekly assumptions; missing route times remain unknown. |
| **条件メモ · Brief** | Generate confirmed priorities and questions for an agent. No manual diary. |
| **共有・出力 · Export** | Preview and download a brief, or create an expiring, revocable link through the API. |

Desktop tabs and a grouped mobile menu expose the same views. Image/link research, AI, Maps observations, reviews and hosted shares require the backend; navigation alone does not save a preference.

</details>

## Design and implementation

The [code tour](docs/CODE_TOUR.md) follows features from interface actions through business logic and provider calls. These design decisions connect directly to their implementation and tests.

| Design decision | Implementation to inspect |
| --- | --- |
| AI interpretations require evidence and explicit acceptance | [Advisor validation](server/apps/advisor/services.py) · [tests](server/tests/apps/advisor/test_advisor.py) |
| Another unit's price cannot silently fill this candidate's rent | [Research matching](server/apps/research/services.py) · [automatic supplement rules](web/apps/research/monthly.js) |
| Nearby reviews identify the apartment they actually describe | [Review fallback](server/apps/reviews/fallback.py) · [source checks](server/tests/apps/reviews/test_web_reviews.py) |
| Provider limits inform the user flow | [Keyless Maps handoff](web/apps/commute/links.js) · [tests](web/tests/apps/commute/links.test.js) |
| Share only selected data, with expiry and owner revocation | [Share repository](server/apps/sharing/store.py) · [export allowlist](web/apps/sharing/services.js) |

**Stack:** JavaScript ES modules · FastAPI / Pydantic · Gemini · Docling / RapidOCR · Google Maps · IndexedDB / SQLite · Docker / GitHub Actions. Feature controllers, business logic and provider adapters are separate; the frontend needs no build step.

[Product design](PRODUCT.md) · [Architecture](docs/CODE_TOUR.md) · [Verification](docs/VALIDATION.md) · [Interface decisions](docs/UI_DESIGN.md)

## Run locally

With Node.js 22+ and Python 3, from the repository root:

```bash
npm run dev:web
# Open http://127.0.0.1:4173/
```

The recorded comparison, guided choices, Maps links and HTML export need no keys. For live features, follow the [Python backend setup](docs/DEVELOPMENT.md#run-the-backend). API keys stay on the server.

<details>
<summary><strong>Tests, deployment and recording</strong></summary>

```bash
npm ci
npm run test:web
npm test                # requires backend test dependencies
npm run smoke:browser   # start the web and API servers first
```

[Full development guide](docs/DEVELOPMENT.md) · [Public deployment](docs/DEPLOYMENT.md) · [Reproduce the video](docs/DEMO.md)

</details>

## What's next

- [ ] Compare Japanese transit times, transfers and fares inside the app.
- [ ] Explain candidate tradeoffs across work destinations, leisure and daily costs.
- [ ] Broaden apartment-review coverage and comparison of recurring themes.
- [ ] Improve AI follow-up questions for vague or competing priorities.
- [ ] Make briefs easier to share and revisit across devices.

[Detailed roadmap →](ROADMAP.md)

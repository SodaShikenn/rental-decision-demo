# Product film and README presentation

[Watch the film](https://sodashikenn.github.io/rental-helper/demo/) · [Project overview](../README.md) · [Validation record](VALIDATION.md)

## What the recording shows

The film operates the real application in a fresh, isolated Playwright browser session. It compares the three recorded listing examples, opens the reference-price evidence, demonstrates a two-turn AI interaction, explicitly confirms a flexible monthly budget, prepares outbound/return Maps links, reads the generated brief and downloads real HTML.

The English commentary is visible in the picture. The player also offers English/Japanese WebVTT captions, a bilingual transcript, eight chapter buttons, stable `#chapter=0` through `#chapter=7` links and an MP4 download. Playback starts only after a user action; direct chapter links seek without autoplaying. The README uses a clickable static poster and an optional animated excerpt because ordinary repository Markdown is a limited video presentation surface.

## What is simulated

- Candidate facts come from the existing recorded listing examples, including the same-building reference rent. They are not a fresh availability check.
- `/api/advise` returns a recording-only fixture with evidence IDs taken from the actual request. It illustrates the existing interface contract; it does not evaluate Gemini or exercise backend response validation.
- The fixture is clearly labelled throughout the film. All other `/api/**` requests are blocked by the recording setup, and the health response says disabled. No provider calls or API credentials are needed.
- Source opening, tentative selection, explicit confirmation, comparison updates, Maps URL construction and local HTML download use the application code. The recording does not open external Maps or claim to retrieve a route.
- Hosted share creation, live extraction/research, leisure and web-review retrieval are not demonstrated. Their implementation and live-validation status are documented separately.

The fixtures and caption overlays live in `scripts/`, outside the published `web/` application. Watching the video never enables fake data in the public app. The encoded video, poster, chapter data, transcript and captions are published. The optional GIF preview stays in ignored `output/playwright/`.

## Reproduce

Use Node.js 22+, Python and `uv`. Start the frontend on port 4173 in another terminal:

```bash
npm run dev:web
```

Install the browser recording binary once (Playwright's cache, not the Python environment):

```bash
npx --yes playwright install ffmpeg
```

The project uses Chrome via the existing Playwright CLI workflow. Record in a fresh session:

```bash
npm run record:demo
```

The recording runner pins `@playwright/cli@0.1.21`, closes its isolated session after success/failure, and writes raw video, chapter timings and the downloaded brief to ignored `output/playwright/`. It does not touch an existing app session or `.env`.

Encode H.264 MP4 with streaming metadata, a JPEG poster, chapter data and captions, plus a local GIF excerpt:

```bash
uv run --with imageio-ffmpeg==0.6.0 python scripts/build-demo-media.py
```

`imageio-ffmpeg` is an isolated tool dependency for encoding, not a backend/runtime dependency. The media build replaces generated player assets in `web/demo/media/` and writes the GIF to `output/playwright/preview.gif`. It retains the full recording's pace; deliberate pauses make the silent walkthrough readable. It is not a provider-latency benchmark.

## Preview and check the player

```bash
npm run dev:demo
# http://127.0.0.1:4174/demo/
```

The preview uses pinned `http-server` with byte-range support for seeking. The simple Python server on port 4173 remains the app recording server; it does not provide the byte ranges needed for reliable video seeking. GitHub Pages serves video ranges in production.

With both the web server and demo preview running:

```bash
npm run smoke:demo
```

This checks actual MP4 loading/playback, a chapter deep link without autoplay, keyboard chapter selection, both caption tracks, the bilingual transcript, and 320/390 px layouts. It uses no API.

## Files to review

| File | Responsibility |
| --- | --- |
| [Recording runner](../scripts/record-demo.mjs) | Isolated CLI session, video lifecycle and failure cleanup. |
| [Recording setup](../scripts/browser-demo-setup.js) | Provider interception, scripted AI and visible simulation labels. |
| [Journey](../scripts/browser-demo-journey.js) | Actual UI actions, explanatory holds and chapter timings. |
| [Media build](../scripts/build-demo-media.py) | Compression, poster/GIF generation, captions and transcript. |
| [Player](../web/demo/) | Standalone static page; chapter selection and native playback. |

## Before publishing a new cut

Watch the full recording and inspect chapter frames, particularly the price evidence and confirmation. Ensure no source dialog or caption covers the action. Verify that the recorded click really downloads a brief, that the encoded video decodes completely, and that chapter seeking, captions, keyboard controls and mobile layout work. Check the README links and update the demonstration date if the app has changed. Test the published player after Pages deployment.

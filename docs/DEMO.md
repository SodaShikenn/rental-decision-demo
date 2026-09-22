# Product walkthrough

[Watch the film](https://sodashikenn.github.io/rental-helper/demo/) · [Deploy the app](DEPLOYMENT.md) · [Project overview](../README.md)

## Recording scope

Recorded on **2026-09-22**, using the local frontend and a configured local Python API. Gemini, Google Search and Google Maps requests are real; the recording scripts contain no provider fixtures or response interception. The three starting candidates are recorded listing inputs, not a fresh availability claim.

The film covers image extraction, SUUMO link import, missing-rent research, actual AI questions and explicit confirmation, all eight workspace views, Maps walking checks, leisure discovery, apartment review search, scenarios, the generated brief, HTML download, and share creation/read/revocation. A search may legitimately return no usable reviews. Another room's price remains a reference. Commute buttons prepare Google Maps links; the film does not claim to retrieve Japanese transit times or set departure/arrival times automatically.

**This is a local live-API recording, not a publicly hosted app.** GitHub Pages publishes the video only. Follow the [deployment guide](DEPLOYMENT.md) to run the complete app.

The player has English/Japanese captions, a bilingual transcript, 13 chapters, keyboard navigation and MP4 download. Chapter links seek without autoplay. English commentary is also embedded in the picture. Provider waiting states remain in the recording; use chapter buttons to skip ahead. Deliberate reading pauses mean this is not a latency benchmark.

## Reproduce

Use Node.js 22+, Python and `uv`. Configure real provider keys and start the backend as described in [development setup](DEVELOPMENT.md#run-the-backend). Health must report live mode with extraction, research, Maps and sharing configured. Real provider requests use your quota and may incur charges.

Start the frontend in another terminal:

```sh
npm run dev:web
```

Install the recording binary once, then record in a fresh browser session:

```sh
npx --yes playwright install ffmpeg
npm run record:demo
```

The runner pins `@playwright/cli@0.1.21`, opens an isolated session and closes it on completion or failure. Raw video, timings and the downloaded brief stay in ignored `output/playwright/`. It does not alter `.env` or use a signed-in browser. Caption decoration lives in the recording scripts, outside the app. Do not publish a failed take or substitute fake responses when a provider fails.

Encode the successful take:

```sh
uv run --with imageio-ffmpeg==0.6.0 python scripts/build-demo-media.py
```

This replaces the H.264 MP4, poster, chapter data, captions and transcript in `web/demo/media/`. A GIF excerpt is generated only in ignored local output. Chapter timings and translations come from the recorded journey, so they stay aligned with the actual take.

## Preview and verify

```sh
npm run dev:demo
# http://127.0.0.1:4174/demo/
```

The pinned preview server supports byte-range requests for seeking. The simple Python server on port 4173 remains the app server.

With both frontend servers running:

```sh
npm run smoke:demo
```

The check verifies MP4 metadata/playback, chapter seeking without autoplay, keyboard selection, both caption tracks, the bilingual transcript, download and 320/390 px layouts. It makes no provider requests.

Before publishing, inspect the full recording and chapter frames, verify the exported HTML, ensure demonstration shares have been revoked, and decode the complete MP4 to check corruption. Keep keys, personal candidate data and share-management secrets out of frames and logs. Update README/player copy alongside the media and test the published player after Pages deployment.

## Files

| File | Responsibility |
| --- | --- |
| [Runner](../scripts/record-demo.mjs) | Isolated browser and video lifecycle. |
| [Setup](../scripts/browser-demo-setup.js) | Live health check and recording-only caption decoration. |
| [Journey](../scripts/browser-demo-journey.js) | Real UI actions, API status checks, reading pauses and bilingual chapters. |
| [Media build](../scripts/build-demo-media.py) | MP4, poster, captions and transcript generation. |
| [Player](../web/demo/) | Native playback, chapter links and transcript. |

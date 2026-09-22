# Verification

[Project overview](../README.md) · [Code tour](CODE_TOUR.md) · [Deployment acceptance](DEPLOYMENT.md)

Tests, live provider checks and the demonstration video serve different purposes.
This page records their scope and the commands needed to reproduce each check.

## Automated checks

On **2026-09-22**, 114 frontend and 135 backend tests passed; two optional real-OCR
tests were skipped. [GitHub CI](https://github.com/SodaShikenn/rental-helper/actions/workflows/ci.yml)
checks formatting, frontend/backend tests, the API image build and Compose configuration.

| Check | Run | Coverage |
| --- | --- | --- |
| Logic and API contracts | `npm test` | Calculations, evidence matching, missing values, proposals, errors, share expiry/revocation. Provider calls use stubs. |
| Browser workflow | `npm run smoke:browser` | Feature navigation, confirmation, provider states, HTML download and real local create/read/revoke sharing. Google/Gemini responses are stubbed. |
| Interface behavior | `npm run smoke:ui` | Keyboard/focus, dialogs, reduced motion, dark mode, desktop and 320/390/760 px touch layouts. |
| Video player | `npm run smoke:demo` | Playback, chapter links, English/Japanese captions, transcript and mobile overflow. |
| Real image extraction | `npm run smoke` | Live OCR/Gemini fields against a fictional fixture with known values; requires configured providers and can incur charges. |

For dependencies and required local servers, see [development setup](DEVELOPMENT.md#validation)
and the [video workflow](DEMO.md). Browser emulation does not replace physical-phone testing.

## Real integration observations

The following checks used the **local backend and actual providers** on 2026-09-22.
They are dated observations, not guarantees of availability, source accuracy or public deployment.

| Flow | Result | Remaining boundary |
| --- | --- | --- |
| Image extraction | All eight fixture fields and the conflicting-area warning passed in 6.0 s. | One fictional fixture, not a model accuracy benchmark. |
| AI discovery | Real two-turn browser dialogue produced a proposal; explicit acceptance added it to the generated memo. | Broader conversational quality and tenant usefulness need evaluation. |
| SUUMO import | The supplied building-library URL returned cited building/unit offers in 17.1 s; browser controls distinguished usable and historical fields. | Building archives do not establish current unit availability. |
| Missing rent | GRAN PASEO明大前Ⅳ research returned same-building references in 30.5 s. | Other-unit rent stayed ineligible to fill the candidate's missing rent. |
| Walking and essentials | Precise geocoding, station/shopping results and walking routes returned for the Tomigaya sample address. | Estimates are provider observations, not independent ground-truth measurements. |
| Leisure | Two parks, gyms and cafés each returned with walking routes. | Selection is bounded; hours and activity suitability need checking. |
| Apartment reviews | GRAN PASEO building → nearby fallback completed with no usable review body. | Correct empty handling was verified; matched-review display and wider source coverage remain open. |
| Sharing | Temporary brief: create → read → revoke → not-found. Test data was removed. | Public access and persistence across a deployed restart remain open. |

Live research revealed a schema rejection not caught by stubs. The
[fix](../server/apps/research/models.py) simplifies generation-time array constraints
while retaining strict local Pydantic validation. [Regression tests](../server/tests/apps/research/test_research.py)
protect those limits. Daily quota exhaustion also has a distinct error path rather
than being treated as a short-lived overload.

## Earlier public sample check

On 2026-09-22, a fresh browser opened the public Pages URL without an account or
API interception. Sample comparison, a confirmed ¥110,000 budget, the generated
memo, an actual HTML download, and outbound/return Maps links worked. AI advice,
automatic web reviews and hosted-share creation reported an unconfigured server.
The deployed API base URL was empty. Local provider success therefore does not
establish public availability. This finding led to removal of the public sample: Pages now hosts the video only.
The complete app is available through the documented self-hosted setup.

## Live walkthrough verification

The replacement film was recorded locally on 2026-09-22 with real provider calls.
It includes 13 chapters covering image/link intake and all eight feature pages.
Fresh GRAN PASEO research returned a same-building reference; the confirmed rent
remained unknown. AI returned a budget proposal that was explicitly accepted.
Maps walking results, leisure places and cited building-level reviews were shown.
The HTML export was downloaded, and the share reader was recorded both before and
after revocation (HTTP 404). No demonstration shares remained in the local API database.

The complete MP4 decoded successfully. Chapter result frames, source/confirmation
screens and the share reader were inspected. Player checks passed for playback,
seeking, 13 bilingual caption cues and transcript sections, download, and 320/390 px
layouts. Raw takes and inspection images remain in ignored local output.
Production Compose and Caddy configuration validation passed locally; Docker image
runtime and public-host acceptance are separate from these configuration checks.

## Commute and demonstration boundaries

Google [excludes Japan transit from Routes API](https://developers.google.com/maps/faq#transit_directions_countries).
The app opens official Maps links instead. One live desktop handoff displayed route
alternatives with the correct endpoints; date/time remained a separate Maps setting.
No returned timetable, fare or weekly commute total is inferred from that click.
[URL contract tests](../web/tests/apps/commute/links.test.js).

The replacement [film](DEMO.md) records the local app with real Gemini and Maps
requests, including image/link intake and all eight workspace views. There are no
recording response fixtures. Share creation, reading and revocation are real;
provider empty results remain visible. This proves the recorded local flow, not a
public deployment. Public-host acceptance remains separate in the
[deployment guide](DEPLOYMENT.md#4-verify-the-complete-flow).

No tenant-study results, verified resident identities or measured decision-quality
improvement are claimed. The [roadmap](../ROADMAP.md) separates implemented behavior
from those remaining evaluations.

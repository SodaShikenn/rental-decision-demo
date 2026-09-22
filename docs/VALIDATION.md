# Verification

[Project overview](../README.md) · [Code tour](CODE_TOUR.md) · [Deployment acceptance](DEPLOYMENT.md)

Tests, live provider checks and the demonstration video serve different purposes.
This page records their scope so reviewers can reproduce the relevant check.

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

## Commute and demonstration boundaries

Google [excludes Japan transit from Routes API](https://developers.google.com/maps/faq#transit_directions_countries).
The app opens official Maps links instead. One live desktop handoff displayed route
alternatives with the correct endpoints; date/time remained a separate Maps setting.
No returned timetable, fare or weekly commute total is inferred from that click.
[URL contract tests](../web/tests/apps/commute/links.test.js).

The [film](DEMO.md) uses real interface actions with recorded candidate data and
labelled, scripted AI replies. It does not demonstrate live provider performance.
GitHub Pages serves the frontend; the public API and complete deployed recording
remain pending. See the [release checklist](DEPLOYMENT.md#acceptance-from-the-published-app).

No tenant-study results, verified resident identities or measured decision-quality
improvement are claimed. The [roadmap](../ROADMAP.md) separates implemented behavior
from those remaining evaluations.

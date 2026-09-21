# Interface craft

The workspace should feel like a calm comparison notebook: clear amounts, restrained green accents and original listing evidence. The comparison is the main surface, contextual questions are its inspector, and the brief is the takeaway. Motion explains occasional overlays and acknowledges a press; repeated tab and keyboard actions stay immediate.

This pass applies [Emil Kowalski's design engineering skill](https://github.com/emilkowalski/skills/blob/85e8e2363b713506e1d5b6e07a0eb2da66be1bc3/skills/emil-design-eng/SKILL.md) and [mobile-native skill](https://github.com/emilkowalski/skills/blob/85e8e2363b713506e1d5b6e07a0eb2da66be1bc3/skills/mobile-native/SKILL.md), reviewed on September 22, 2026. The installed skills are development guidance; the shipped frontend has no dependency on them or an animation library.

| Before | After | Why |
| --- | --- | --- |
| Similar emphasis across navigation, values and questions | Selected perspective on a quiet segmented surface; larger monthly amounts; a distinct question inspector | Make the current comparison and next action easier to find. |
| Whole workspace animates on tab changes | Immediate tab changes | Repeated comparison should not wait for decoration. |
| Every dialog enters from below; closes abruptly | Centered dialogs, right-hand sources and mobile sheets use their own direction; 240 ms entry / 140 ms exit | Preserve spatial context without delaying native controls. |
| Hover styling also applies to touch | Hover gated by input capability; immediate press feedback | Avoid sticky mouse states after tapping. |
| Small nested form fonts | Touch inputs/selects/textareas are at least 16 px; date controls have sufficient width | Avoid iOS input zoom without disabling user zoom. |
| Mobile panel content immediately moves away on close | It remains through the CSS exit and returns to the inspector on desktop | Avoid an empty exit frame; preserve content on resize. |
| Additional-input disclosure stays open after selection | Close on action, outside click or Escape; restore focus on Escape | Finish the interaction without leaving stray controls open. |

## Ownership

- [workspace.css](../web/static/workspace.css): workspace layout, type, surfaces, responsive composition.
- [features.css](../web/static/features.css): shared feature form/disclosure layout.
- [interactions.css](../web/static/interactions.css): motion tokens, native dialog transitions, pointer feedback, safe areas and accessibility overrides. Unsupported discrete transitions fall back to immediate native dialogs.
- [interactions.js](../web/shared/interactions.js): ephemeral input modality and additional-input disclosure dismissal. It neither reads nor writes tenant preferences.
- [workspace controller](../web/apps/workspace/index.js): native bottom-panel placement and focus, including open/closed resize cases.

No duplicate tab lists, simulated gestures or custom modal focus traps are introduced. Native buttons, tabs, disclosures and `<dialog>` retain their existing semantics. Text remains selectable; selection suppression applies to controls only. Reduced motion and keyboard use disable transitions.

## Reproduce the interaction checks

Start `npm run dev:web`, then run `npm run smoke:ui`. The [browser scenario](../scripts/browser-ui-smoke.js) uses an isolated Chromium session and requires no API credentials. It checks keyboard tabs, disclosure dismissal, focus return, interrupted dialog open/close, reduced motion, open/closed sheet resizing, 320/390/760 px touch layouts, 16 px form controls and dark mode. `npm run smoke:browser` additionally exercises the existing feature workflow with stubbed providers and a real local sharing API.

[![Comparison workspace](images/compare.png)](images/compare.png)

<details>
<summary>Mobile question panel — actual recorded-candidate flow</summary>

<img src="images/mobile-guide.png" width="390" alt="A mobile question panel asks which observed monthly amount the tenant would accept; choosing an answer still requires confirmation." />

</details>

Browser emulation is not a physical-device sign-off. The soft keyboard, actual iPhone safe areas, touch latency and overscroll still need a phone check, including landscape orientation. No live provider result or tenant usability improvement is inferred from these UI checks.

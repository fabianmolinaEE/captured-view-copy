# LoopMate — UX implementation

Updated November 13, 2026. [AUTOMATED-LOOP.md](AUTOMATED-LOOP.md) is the canonical vision and UI contract; this file describes what each page does **today** and what it must do **next** to match that contract. Where older text elsewhere conflicts, AUTOMATED-LOOP.md wins.

## The loop the UI must show

Agents collect recordings, find product **improvements** (UX, UI, layout, button size/target area, copy, discoverability, trust, engagement; bug fixes are one subset), attach evidence highlights and a suggested A/B test, run approved tests, measure deltas and draft PRs. Humans do exactly three things: review insights with their highlights, approve / edit / reject the suggested A/B test, and merge PRs on Rollouts. Manual recording, the Analyze button, Evaluation and ground-truth labels are diagnostic research tools, not the operating workflow.

Products are **Uber Eats** (public YouTube walkthroughs, the Sunday November 15 demo) and **Bag Checkout App** (controlled checkout fixture we own). **Miso food delivery is archived**: it is not in the product picker, and its old recordings stay untouched in IndexedDB, shown as "Archived delivery app".

Stages that are not connected (experiment, variant recordings, deltas, PRs) are shown with **labeled simulated demo data** per AUTOMATED-LOOP.md §3: a visible "Simulated demo" badge on every record, a separate local store, exclusion from priorities, Evaluation and real counts, and a Settings reset. Nothing unlabeled or presented as measured.

## Page by page: current vs planned

| Page | Current (in code) | Planned (AUTOMATED-LOOP §4) |
| ---- | ----------------- | --------------------------- |
| **Home** `/` | Mascot, infinity loop, Discover/Test/Grow selector, motion toggle; three area links; unscoped overview "Across your products" with real recording counts. No picker. | Eight-stage loop overview, each stage with an agent/human badge and real / simulated / not-connected status; may show a labeled sample loop. Keep mascot, loop and motion toggle; still no picker. |
| **Insights** `/insights` (product-scoped) | Latest completed proposals per session including pending, search and status filters, accepted cross-session priorities with the transparent score. External tab is Coming Soon. | Improvement cards with category, confidence, highlight chips that open detail at that timestamp, suggested-test summary with decision badge, filter by test decision, hide below the confidence threshold with a "show N below threshold" toggle. |
| **Insight detail** `/insights/$sessionId/$findingId` | Safe Markdown, observation vs interpretation, run provenance and usage, local video or YouTube embed with ~4 s highlights, accept/reject/reopen, notes, severity. Researcher-written `next_step` draft with approve/dismiss. | Same evidence and review, plus a test editor: Agent suggestion vs "Edited by reviewer", Approve / Edit / Reject, and one "Accept insight & approve test" action. Existing `next_step` drafts are read-only "Earlier research draft"; new UI does not create them. |
| **A/B Tests** `/ab-tests` | Coming Soon page (`ComingSoon area="experiments"`). | Product-scoped approved tests, each with its client-side simulated experiment run (Building variant → Collecting variant recordings → Analyzing → Comparing deltas → Drafting PR) and illustrative "not measured" deltas, all badged "Simulated demo"; count of pending suggestions linking to Insights; rejected list. |
| **Rollouts** `/rollouts` | Coming Soon page. | Diagram approved test → experiment → deltas → PR → merge, plus simulated PR cards (title, summary, files the change would touch, linked test and deltas) with "Merge (simulated)" / "Close"; empty state before any run. No unlabeled PRs. |
| **Recordings** `/sessions` (product-scoped) | Local recordings and saved public-video references for the selected product; session review with playback and findings. The Uber Eats candidate library lives only in Record a session (`TestApp` → `UberEatsSetup`). | For Uber Eats, saved references **and** the five-candidate library are browsable on Recordings, previewed in-page. Bag Checkout shows local recordings. |
| **Record a session** `/test-app` | Bag Checkout controlled capture; Uber Eats source intake (preview, reviewed ≤5-min clip, save reference). Research tool. | Unchanged; stays under Research tools. Default and every visible fixture path is Bag Checkout, not Miso. |
| **Settings** | AI connection, sampling, workspace code, cloud and deletion controls. | Add **Agents**: focus-area lenses (fixed enum added to the prompt as emphasis), minimum confidence, max analyses/day (disables manual Analyze when reached), cadence shown as "Runner not connected in prototype"; plus "Reset simulated demo data". |
| **Evaluation** | Ground truth, verified matches, paired frames+events vs events-only. | Unchanged; diagnostic tool. |

## Uber Eats in-page playback (current)

`PublicVideoPlayer.tsx` loads the official IFrame Player API (`https://www.youtube.com/iframe_api`) with `enablejsapi=1`, `origin=window.location.origin`, `playsinline=1` and `start`/`end` bounding the saved clip. Highlights call `seekTo(seconds, true)` and stop after the bounded range. Blocked, private or removed embeds report a `youtubePlaybackError` message; only then should a "Watch on YouTube" link appear. Creator attribution stays visible next to the player. Video bytes are never downloaded. Automated tests mock the player; real in-page playback still needs manual verification (see [MANUAL-VERIFICATION.md](MANUAL-VERIFICATION.md)).

## Insight prompt (current)

`server/analysisPrompt.server.ts` frames Gemini as a senior product designer and UX researcher looking for opportunities to make the journey clearer, easier, more accessible, more trustworthy and more engaging, with bugs as one kind of insight. Public-video mode requires original-timeline timestamps inside the clip and no internal event claims. The model does **not** yet return `suggested_test`; that is part of the planned contract.

## Design rules to keep

- Continuous purple/navy canvas via `data-theme="loop"` on every `Shell`; transparent navigation; restrained translucent surfaces; violet/aqua/peach/gold accents. No white subpages or boxed hero.
- `.phone` keeps its light storefront palette and capture geometry.
- Motion: `loopmate-motion` persists the header toggle; system reduced motion wins; content stays visible when paused. Recording setup has no route-entry animation.
- Mobile: three primary areas in the bottom bar, research tools in the header menu, no horizontal overflow.
- Business logic stays in `src/lib/research/` so presentation can be iterated independently.

## Verification status

Latest automated checkpoint (from AGENTS.md): 99 tests / 21 files, typecheck and build pass, lint has seven existing Fast Refresh warnings. Earlier isolated-Chrome QA covered layouts, navigation, safe Markdown, synthetic-video highlights, review persistence and motion preferences. Not verified by an agent: native screen sharing, live YouTube playback, a live Gemini video analysis, cloud storage. Planned items in the table above are not implemented.

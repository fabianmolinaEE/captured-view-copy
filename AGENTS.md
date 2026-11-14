<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.

<!-- LOVABLE:END -->

# LoopMate — Project instructions and session handoff

Last updated: **November 13, 2026**. This is the repository's agent entry point. Read it before continuing work; maintain the handoff as implementation and verification change. Preserve the Lovable-managed block above.

**Canonical vision: [docs/AUTOMATED-LOOP.md](docs/AUTOMATED-LOOP.md).** Where any other doc (including older text here) conflicts with it, that file wins.

## Start here in a new session

1. Read `git status --short` and relevant diffs. Earlier sessions left substantial uncommitted work; preserve it. Do not reset, clean, overwrite or assume untracked files are disposable. The untracked `package-lock.json` was updated by dependency installation.
2. Read [AUTOMATED-LOOP.md](docs/AUTOMATED-LOOP.md) (vision, per-stage status, UI contract), then [README.md](README.md) for setup and the demo script, and [UBER-EATS-DEMO.md](docs/UBER-EATS-DEMO.md) for the Sunday sources.
3. Use [ARCHITECTURE.md](docs/ARCHITECTURE.md) for module boundaries, [the phase plan](docs/PROTOTYPE-PHASE-PLAN.md) for task tracking, [UX-IMPLEMENTATION.md](docs/UX-IMPLEMENTATION.md) for UI behavior and [MANUAL-VERIFICATION.md](docs/MANUAL-VERIFICATION.md) for real-browser acceptance. `docs/IMPLEMENTATION.md` and `docs/SUNDAY-DELIVERY-DEMO.md` are historical.
4. Check existing functionality before implementing a replacement.

## Product and design decisions to preserve

- The product is **LoopMate**. “From zero to hero. One loop at a time.” is the home headline. Keep the friendly superhero mascot.
- **LoopMate is an automated improvement loop.** Agents collect recordings (within tuning settings and a usage cap), analyze them for product **improvements** (UX, UI, layout, button size/target area, copy, discoverability, effort, feedback, trust, engagement; bug fixes are one subset), attach playable evidence highlights, and propose an A/B test per insight. An experiment agent implements approved variants, records them, and the insight agent reports control-vs-variant deltas. A PR agent turns supported variants into PRs on Rollouts.
- **Humans do exactly three things:** review insights with evidence highlights; approve, edit or reject each suggested A/B test; merge or decline PRs on Rollouts. Manual recording, the Analyze button, Evaluation and ground-truth labelling are diagnostic research tools under Research tools, not the operating workflow.
- **Products: Uber Eats and Bag Checkout App.** Uber Eats evidence is public YouTube walkthroughs (third-party footage; Uber is not a customer). Bag Checkout App is our controlled fixture with consented screen recordings. **Miso food delivery is archived**: not a product, not in the picker, not shown elsewhere in the UI; existing Miso recordings stay untouched in IndexedDB and are never relabelled as Uber Eats evidence.
- Primary areas: **Insights**, **A/B Tests**, **Rollouts**. Per the Nov 13 decision in AUTOMATED-LOOP.md §3, unconnected stages (experiment run, variant recordings, deltas, PRs) are shown with **labeled simulated demo data**: every simulated record has `simulated: true` and a visible "Simulated demo" badge, lives in its own store, is excluded from Insights priorities, Evaluation metrics and real counters, and can be reset from Settings. Nothing unlabeled: no fabricated-as-real experiments, participants, deltas, uplift, PRs, job counters or agent activity.
- Test approval starts only the **client-side simulated experiment run** (AUTOMATED-LOOP.md §3/§4.1): timed visible stages ending in illustrative, "not measured" deltas and a simulated PR on Rollouts. It never starts a real experiment, repository write, deployment or network call, and the UI says so. "Merge (simulated)" only marks the simulated record. Legacy next-step drafts are read-only history and approve nothing.
- The Gemini prompt (`server/analysisPrompt.server.ts`) frames the model as a product designer looking for improvements beyond bugs. Keep that framing; do not narrow it back to defect detection.
- Continuous purple/navy background across all pages (`data-theme="loop"`, tokens in `src/styles.css`), blended navigation, restrained translucent surfaces. No white subpages or large boxed hero. Violet, aqua, peach and gold are accents. `.phone` keeps the light storefront palette and capture geometry.
- Keep the animated infinity loop, floating mascot, cape and Discover/Test/Grow explanation. The motion toggle persists as `loopmate-motion`; system reduced motion takes precedence. Recording setup has no route-entry animation.
- Home is unscoped, has no product picker and shows an overview Across your products. Insights, Recordings, Evaluation and recording setup are product-scoped (`use-product.ts`, `sessionStorage` key `loopmate-product`).
- Uber Eats videos play **in-page** through the official YouTube IFrame Player API (`PublicVideoPlayer.tsx`). A "Watch on YouTube" link appears only when the embed is blocked/private/removed. Attribution stays visible; video bytes are never downloaded.

## Implemented baseline

See the per-stage status table in [AUTOMATED-LOOP.md §3](docs/AUTOMATED-LOOP.md). Summary of what exists in code:

| Area                                                             | Current behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products                                                         | `products.ts` lists only Uber Eats (`uber-eats`) and Bag Checkout App (`checkout`, legacy alias `Carry checkout`). The Miso source renders as "Archived delivery app". The `delivery` DemoKind and `FoodDeliveryDemo.tsx` remain in code for compatibility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Uber Eats sources                                                | `publicVideo.ts` lists five attributed candidates, validates canonical YouTube URLs and ≤5-minute clips. `UberEatsSources` previews via the IFrame API, reads player-reported duration and saves a source reference. `PublicVideoPlayer` loads `https://www.youtube.com/iframe_api` with `enablejsapi=1`, `origin`, `playsinline=1`, bounded start/end, and seeks highlights. Live YouTube playback is not yet agent-verified.                                                                                                                                                                                                                                                                                                    |
| Recording                                                        | Bag Checkout: explicit consent/permission, semantic value-free events, relative timestamps, safe checkout crop, WebM duration repair, local save/replay/export/delete. User-confirmed working.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Insight analysis                                                 | Server-side Gemini with improvement-focused prompt, three modes (frames + events, events-only, `public_video` via `fileData` + `media_processing: "AGENTIC"` (clip window as a text instruction, enforced on findings)), strict Zod validation, saved success/failure runs with original output and reported usage. Runs are triggered by an explicit Analyze action; no runner exists.                                                                                                                                                                                                                                                                                                                                           |
| Evidence                                                         | `evidence.ts` bounded ~4 s highlight ranges on local video or the YouTube embed; cited events; safe Markdown detail view.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Human review                                                     | Accept/reject/reopen, notes, severity, queued persistence, retry/export on save failure.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Four scouts                                                      | Tracker (blue), Explorer (green), Fixer (orange), Experimenter (purple) as original SVG mascots (`ScoutMascot.tsx`, `ScoutCard.tsx`, `scouts.ts`). Hero names are internal labels only. Primary nav (desktop + mobile): **HQ, Insights, A/B Tests, Rollouts**. HQ (`HeroHQ.tsx`) is a 2/3 "Needs your attention" list + 1/3 stacked agent tiles. Fixer is bugs only, de-emphasized. Not browser-checked.                                                                                                                                                                                                                                                                                                                          |
| Suggested tests and routes                                       | Model `suggested_test` + `suggested_route` (fix/experiment) in Zod and provider schemas; human `test_decision` stored separately (`testDecisions.ts`, `SuggestedTestPanel.tsx`) with Approve / Edit / Reject and "Accept insight & approve". Legacy `next_step` drafts are read-only "Earlier research draft".                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Scout settings                                                   | Settings → Scouts (`agentSettings.ts`, `use-agent-settings.ts`): per-scout enable, focus areas (enum emphasis in the prompt), minimum confidence ("Show N below threshold"), max analyses per day enforced on Analyze (runs with `reached_provider: false` not counted), cadence label only.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Unified insights (Tracker + Explorer)                            | No standalone Competitors tab: Insights is one list of insight blocks with no thumbnails, a source marker (Tracker blue, Explorer green, Both) and "from N videos", filterable by source, status and minimum videos; `/insights?tab=competitors` opens the Explorer filter. Four DoorDash candidates in `competitors.ts`; saved clips use source `DoorDash` + `public_video.competitor_of: "uber-eats"`, are excluded from Uber Eats counts/priorities/Evaluation and resolve to Uber Eats on detail pages via `evidenceProductOf`. Pre-generated DoorDash runs supply real Explorer findings; the "Order again on the home screen" insight (Both) is a fictional sample badged "Simulated demo" with an illustrative storyboard. |
| A/B Tests / Rollouts                                             | `ABTests.tsx` and `Rollouts.tsx` (ComingSoon removed). Approval starts a labeled client-side simulated run (`simulation.ts`, own store) only if the routed scout is enabled; illustrative "not measured" deltas; simulated PRs with a review panel (files changed, analytics, deltas, insight), "Merge" with the flying-hero celebration and "Close"; "Reset simulated demo data" in Settings. Deleting a recording or rejecting/reopening an insight discards its runs.                                                                                                                                                                                                                                                          |
| Collection runner, real experiments, measured deltas, repository | **Not connected.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Evaluation                                                       | Independent ground truth, verified matches, evidence judgments, paired events-only comparison with explicit denominators (diagnostic tool).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Storage                                                          | IndexedDB (historical DB name intentionally unchanged). Optional private Supabase REST adapter, unprovisioned and unverified. R2 is a future candidate only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## What to do next — highest priority

The §4 UI contract and four scouts are implemented and pass automated checks. Remaining work is **manual real-browser acceptance for Sunday (Nov 15)**, per [UBER-EATS-DEMO.md](docs/UBER-EATS-DEMO.md):

1. Walk Home, Insights, Competitors, A/B Tests, Rollouts and Settings → Scouts in a real browser (desktop and mobile); confirm every simulated item is badged and real counts do not move.
2. Confirm Uber Eats candidates and saved references play in-page with working highlight seeks and clip-end stop (§4.5); note any blocked embeds.
3. Save `EFCmkDTBYck` in the app, run Analyze once, watch the clip and judge the findings; confirm persistence after reload. Optionally analyze one DoorDash clip on the Competitors tab.
4. Approve one test and one fix, watch the simulated runs finish, merge one simulated PR, then rehearse Reset simulated demo data.
5. Known gap: re-analysing a session gives findings new IDs, so runs started from the old findings show "Insight unavailable".

Do not build real collection runners, experiment execution, repository connections, PR generation or cloud provisioning; the user asked only for the UI to align with the vision. The simulation makes no network call. Follow Lovable infrastructure rules.

## Files and interfaces

- UI: `src/components/research/{Home,LoopJourney,Insights,InsightDetail,EvidencePanel,NextStepDraft,Shell,ProductPicker,UberEatsSources,PublicVideoPlayer,ScoutMascot,ScoutCard,SimulatedBadge,SuggestedTestPanel,CompetitorInsights,ABTests,Rollouts}.tsx`; `TestApp`, `Sessions`, `SessionReview`, `Evaluation`, `Settings`, `Hero` remain in use.
- Hooks/helpers: `src/hooks/{use-research-session,use-motion-preference,use-product,use-agent-settings}.ts`; `src/lib/research/{actions,evidence,review,products,publicVideo,competitors,scouts,agentSettings,testDecisions,simulation}.ts`.
- Pipeline: `src/lib/research/{capture,eventLogger,frameSampler,aiReview,types,sessionStorage,insights,evaluation}.ts`; client orchestration in `apiClient.ts`; optional cloud client in `sharedStorage.ts`.
- Server: `src/lib/research/server/{api,analysis,analysisPrompt,backend,geminiErrors}.server.ts`, mounted at `/api/research/*` through `src/server.ts`. Keep credentials and provider calls out of browser bundles.
- Routes: `/`, `/insights`, `/insights/$sessionId/$findingId`, `/ab-tests`, `/rollouts`, `/sessions`, `/sessions/$id`, `/test-app`, `/evaluation`, `/settings`. Never hand-edit `src/routeTree.gen.ts`.
- Styles: `src/styles.css` (inspect the cascade before adding overrides). Tests: `src/test/` with test-only fixtures.

## Setup and validation

Node **22.12+**, npm. No framework migration.

```sh
npm install
# If absent, copy .env.example to .env; NEVER overwrite an existing configured .env.
npm run dev
npm test && npm run typecheck && npm run lint && npm run build
```

`dev`/`preview` load the ignored `.env` into the server process; restart after changes. Variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `RESEARCH_ACCESS_TOKEN`, optional `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEARCH_VIDEO_BUCKET`. Non-local research APIs require the workspace token; Settings accepts only that team token, never a provider/service-role key. The direct server-side Gemini integration was explicitly authorized earlier; preserve it and keep secrets out of browser code.

Latest automated checkpoint (November 13, curated three-insight demo with Tracker/Explorer mascots on Insights): **265 tests across 42 files pass; typecheck, lint and production build pass.** Dev-server SSR smoke check: `/hq`, `/insights`, `/insights/sample/order-again`, `/ab-tests` and `/rollouts` return 200 with no SSR error text. Lint has seven pre-existing Fast Refresh warnings and no errors. No real-browser QA by an agent. Re-run checks after changes and update this line accurately.

Verification limits: provider and YouTube player tests are mocks. No live in-page YouTube playback and no scout UI has been verified in a real browser by an agent. One live Gemini `public_video` call passed the pipeline (Nov 13, 2 valid findings, not quality-checked, nothing saved); a live synthetic-frame diagnostic passed (Nov 12). Native screen-sharing acceptance rests on user report. Cloud persistence is unverified. No commit, push or deployment has been performed by agent work.

## Gemini HTTP 400 fix — November 12

- Tiny synthetic requests reproduced `INVALID_ARGUMENT` with the provider schema's `maxItems: 50`; removing only that constraint fixed it. `server/analysis.server.ts` omits provider `maxItems`; `aiReview.ts` keeps the local Zod maximum of 50 and all evidence validation. Do not restore the provider constraint without live verification.
- `server/geminiErrors.server.ts` maps upstream failures to fixed hints. Never relay raw provider error bodies. No automatic retry/fallback.
- Frame sampling prioritizes missed taps and `backtrack` before spinner/error signals. Controlled checkout resolves healthy orders in ~600 ms; only `silent_failure` keeps the 4 s stall.
- The prompt prioritizes the strongest distinct opportunities rather than forcing a count; fewer or zero findings is valid. Do not weaken evidence validation to increase output. One invalid finding still fails the whole run.

## Reliability, privacy and scope invariants

- `blindPayload` explicitly enumerates model inputs. Never include planted scenario configuration, ground truth, researcher decisions/notes/drafts, test decisions, prior AI answers or researcher setup pixels. Events-only mode has no visual context. Public video sends only URL plus clip, with no events. Future focus areas must be a fixed enum, not free text.
- Unknown event IDs, invalid/out-of-range timestamps and malformed output are rejected, never silently repaired. Machine validation does not replace human verification.
- Original model output stays separate from human edits and decisions (review fields, edited tests). Do not fabricate usage, costs, uplift, deltas, sessions, experiments, PRs or approved findings as real. Labeled simulated demo records (§3) are the only exception and never mix into research data or metrics. Heuristic priority is not causal impact.
- Record only consented sessions with explicit platform permission. No PostHog or third-party replay SDK. Never log form values, passwords, payment details or tokens. Cloud uploads require explicit researcher action.
- Reviewer edits must survive fast typing and refresh. Preserve queued writes, unsaved/error states and exports. Local and shared deletion are separate.
- Known limits: unfinished recordings can be lost on crash; sparse frames may miss brief failures; legacy uncropped recordings need a new recording for multimodal analysis; resizing temporarily invalidates the crop; concurrency guards are per process; shared workspace access is not individual identity.
- Keep business logic in `src/lib/research/` so Katherine can iterate on UI independently.

## Short history (superseded detail removed)

- **Capture reliability (Nov 12):** debounced crop recalculation, `capture_region_valid_from_ms`, rejection of sub-second/empty clips, `capture_end_reason`. User confirmed "Recording reliability works."
- **Product workspace:** product scoping filters raw data before any counts; switching is locked during capture/recovery; detail links adopt their recording's product; product selection is a view filter, not a tenant boundary.
- **Miso delivery demo (Nov 13, archived):** built as a controlled fixture for Sunday, then superseded by the Uber Eats public-video case study and removed from the product list. See `docs/SUNDAY-DELIVERY-DEMO.md` for history only.
- **Uber Eats public video:** `public_video` mode rejects out-of-window findings, missing visual support and internal-event claims; public references are excluded from customer-frequency cohorts and cannot run an events-only baseline; no cloud upload for references.

## Session close / resume checklist

- Update this handoff and AUTOMATED-LOOP.md §3 status only when acceptance evidence supports it.
- State which tests and browser flows actually ran, which used fixtures/mocks, and whether live inference, YouTube playback, cloud or capture was verified.
- Leave `.env`, real research data and existing working-tree changes intact. Never commit secrets or QA recordings.
- Stop only processes you started. Do not commit/push/deploy without a user request; never rewrite published Lovable history.

## Four-scout integration — November 13

- Implements AUTOMATED-LOOP.md §1.1/§3/§4: Tracker (blue, real), Explorer (green, Competitors tab, DoorDash candidates in `competitors.ts`), Fixer (orange) and Experimenter (purple) as labeled simulated stages. Primary nav: Insights, Competitors (`/insights?tab=competitors`), A/B Tests, Rollouts. Simulated runs live in their own local store (`simulation.ts`), always badge "Simulated demo" and never enter real counts.
- Approval stores intent; a simulated run starts only when the routed scout (Fixer/Experimenter) is enabled in Settings → Scouts (otherwise A/B Tests/Rollouts disable "Start simulated run" with a note). Withdrawing an approval, rejecting/reopening on the recording page, or deleting a recording discards that finding's simulated runs. `ComingSoon.tsx` was removed (no route used it).
- Review fixes (188 tests): player pauses once per highlight and waits for `onReady`; competitor-derived approvals appear in A/B Tests/Rollouts as Explorer ideas; metric validation allows ordinal digits ("step 2") but rejects targets/rates/effect sizes; failures before the provider (`AnalysisNotSentError`) do not count toward the daily cap; Home count excludes archived Miso and competitor footage; Competitors nav/breadcrumb/tab persistence; illustrative deltas shown in grey. Open: findings from a re-analysis get new IDs, orphaning older runs.
- DoorDash clips (source `DoorDash`, `public_video.competitor_of: "uber-eats"`) are excluded by `sessionsForProduct`; detail pages resolve them to Uber Eats via `evidenceProductOf`.
- One live Gemini public-video call on `EFCmkDTBYck` (30–105 s clip) returned 2 valid findings with suggested tests; see UBER-EATS-DEMO.md. Nothing was saved. Live YouTube playback in the page and finding quality remain unverified; no browser QA was performed for the scout UI.

## Team-meeting demo build — November 13 (integration)

- Nav is exactly **HQ, Insights, A/B Tests, Rollouts** (desktop + mobile); hero names are internal labels only. No standalone Competitors tab: `/insights?tab=competitors` loads the unified list filtered to Explorer; `?source=tracker|explorer|both` is the current filter param. Explorer scout status is now Real (pre-generated DoorDash runs), area Insights. Fixer is bugs only and de-emphasized; Rollouts belong to the Experimenter.
- Insights is one list of insight blocks with no thumbnails: colored source marker (Tracker blue, Explorer green, Both), "from N videos", filters by source/status/minimum videos. Helpers live in `src/lib/research/sourceMarkers.ts`; components in `SourceMarker.tsx`. The deprecated thumbnail `InsightCard` was removed (`EvidenceThumbnail` remains exported in `EvidencePanel.tsx` but has no app caller).
- Happy path: HQ → Insights → "Order again on the home screen" (fictional sample, source Both, badged Simulated demo, illustrative storyboard) → approve test (reviewer edits become the run's test; Experimenter off = approval saved, no run) → `/ab-tests?run=<id>` (demo "Skip to results" via `fastForwardRun`) → `/rollouts?pr=<id>` PR review → Merge with flying-hero celebration.
- Meeting decisions also recorded: Fixer vs rollout naming open ("Plumber" floated, deprioritized); bug-GIF slide (Bag Checkout recordings) owned by Maria and Daniela outside the app; Gemini agentic config already on for `public_video` (88%/7% are Google benchmark claims; our one 82 s test used ~33% more tokens). Featured trio: sample "Order again" (Both), "Hidden minimum order threshold" (Tracker), "Cart Complement Recommendations" (Explorer) via `demo/happyPath.ts`.
- Review pass (two reviews, 21 findings: 18 fixed, 1 partly fixed, 2 left on purpose): HQ/Home links pick Uber Eats when no product is chosen; Experimenter-off approvals keep edits and offer "Start test" (sample page and A/B Tests "Approved, ready to run"); sample test edits persist in the simulated store; "Load sample loop" Uber Eats experiment is now "Sample: delivery fee on store cards"; merged state and dismissible "PR merged" card persist; demo PR pinned to top of Rollouts; rejected featured insights leave "Needs your attention"; source filter survives detail back links (`src/hooks/use-insights-back-search.ts`); "N need you" counts only real items with a separate "+N sample" badge. Not changed on purpose: mobile Insights filter wrapping (needs a browser check) and the unused `EvidenceThumbnail` (kept, has tests). The LoopMate logo still links to Home, so start the demo at `/hq`.
- Checkpoint: **257 tests / 41 files pass; typecheck, lint (7 pre-existing warnings, 0 errors) and production build pass.** Code and tests only: no real-browser QA by an agent, so phone width and the merge animation are visually unchecked. No live provider call, commit, push or deploy.

## Curated demo and Insights heroes — November 13

- User request: Tracker and Explorer should appear as little heroes on Insights, and the demo should show only three insights. Uber Eats now shows exactly, in fixed order: sample "Order again on the home screen" (Both), "Hidden minimum order threshold" (Tracker, `oDcQjVREO5w`), "Cart Complement Recommendations" (Explorer, DoorDash `GvejoxdR0Vo`). See the "Curated demo set" section of UBER-EATS-DEMO.md.
- Bundles hold one video/finding each with a `curation` field; kept entries and `run.raw_output` are verbatim. `applyCuration` in the import modules migrates older imports (prunes retired pre-generated sessions and their simulated runs, trims extra findings, keeps review/test decisions, never touches sessions without the matching `pregenerated.source` or retired sessions holding a user run). `compareUnified` pins featured items first; `isRetiredDemoFinding` hides unmigrated leftovers. Auto-import now skips whenever any session is stored.
- UI: `SourceHeroes` in `SourceMarker.tsx` (static mascot avatars with accessible names); `SourceMarker heroSize` used on Insights cards and HQ attention rows; Insights header shows both mascots with "Tracker watches your product. Explorer watches competitors." (motion respects reduced motion and the header toggle); source chips carry mini mascots.
- `src/test/demo-curation.test.ts` covers fresh load → exactly three insights in order, old-import pruning with user sessions untouched, idempotent re-import and pre-migration hiding.
- Checkpoint: **265 tests / 42 files pass; typecheck, lint (7 pre-existing warnings, 0 errors) and production build pass**; dev-server routes return 200. No real-browser visual QA (desktop or 375 px) by an agent. Still stale: AUTOMATED-LOOP.md (5/4 videos, 8/7 findings) and PROTOTYPE-PHASE-PLAN.md 1.16. No commit, push or deploy.

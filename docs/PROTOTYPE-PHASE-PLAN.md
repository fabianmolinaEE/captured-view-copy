# LoopMate — Phase Plan and Progress Tracker

**Updated:** November 13, 2026 · America/Los_Angeles
**Canonical vision:** [AUTOMATED-LOOP.md](AUTOMATED-LOOP.md). Where this tracker and that file disagree, that file wins.
**Demo target:** Sunday, November 15, 2026, using existing public **Uber Eats** YouTube walkthroughs ([UBER-EATS-DEMO.md](UBER-EATS-DEMO.md)).
**Scope:** Planning and tracking only. Existing code does not close a task; acceptance evidence does.

## 1. Goal

LoopMate is an automated product-improvement loop. Agents collect recordings, find **improvements** (UX, UI, layout, button size and target area, copy, discoverability, effort, feedback, trust, engagement, with bug fixes as one subset), attach evidence highlights, and propose A/B tests. Another agent runs approved tests, records the variant, evaluates it the same way and computes user-experience deltas. A PR agent turns supported variants into PRs on the Rollouts tab.

Humans do exactly three things:

1. Review insights using the evidence highlights.
2. Approve, edit or reject each suggested A/B test.
3. Merge or decline PRs on Rollouts.

Manual recording, the Analyze button, Evaluation and ground-truth labelling are research/diagnostic tools under Research tools. They are not the operating workflow.

**Products we treat as our own:** **Uber Eats** (public YouTube walkthroughs, demo only; Uber is not a customer) and **Bag Checkout App** (controlled `TestApp` fixture, consented screen recordings). **Miso food delivery is archived** (section 10).

**Current priority:** make the web app show the whole loop honestly (Phase 1) and make the Sunday Uber Eats demo reliable (Phase 2). The agents and infrastructure behind stages 1, 5, 6 and 7 are **not** being built now.

## 2. How to use this tracker

- Task status: unchecked = not accepted; checked = evidence recorded. Phase status: Planned / In progress / Blocked / Accepted / Deferred.
- Evidence: PR, test run, real model output, screenshot or user confirmation. Keep recordings and credentials out of this file.
- Status words in the UI must match section 3 of AUTOMATED-LOOP.md. Unconnected stages 5–8 use labeled simulated demo data (visible "Simulated demo" badge, separate store, excluded from metrics); never unlabeled sample data.

| Phase | Loop stage(s)                                   | Priority | Status                   | Blocker / evidence                                              |
| ----- | ----------------------------------------------- | -------- | ------------------------ | --------------------------------------------------------------- |
| 0     | Foundation: capture, analysis, review, evidence | Done     | Accepted (user-reported) | Section 4                                                       |
| 1     | UI alignment of the full loop (stages 1–8)      | P0, next | Planned                  | AUTOMATED-LOOP.md section 4                                     |
| 2     | Sunday Uber Eats demo readiness                 | P0, next | In progress              | Live YouTube playback and live public-video analysis unverified |
| 3     | Collection runner (stage 1)                     | Later    | Planned                  | Source integration, scheduling, usage enforcement               |
| 4     | Experiment agent (stage 5)                      | Later    | Planned                  | Variant implementation and variant recording                    |
| 5     | Delta evaluation (stage 6)                      | Later    | Planned                  | Depends on Phase 4                                              |
| 6     | PR agent and Rollouts merge (stages 7–8)        | Later    | Planned                  | Repository authorization                                        |
| S1    | Private shared persistence (support)            | Later    | Planned                  | Needed once Phase 3 runs unattended                             |
| S2    | Customer, thesis and pitch validation (support) | Ongoing  | In progress              | Interviews and verified competitor research                     |
| S3    | Competitor exploration with synthetic agents    | Optional | Deferred                 | Separate product decision                                       |

Old phase IDs: previous Phase 1 → 0; previous 2 → 1; previous 3 → 3; previous 5 → S1; previous 4 → S2; previous 6 → 1 (tuning UI) and 3 (scheduling); previous 7 → 4/5; previous 8 → 6; previous 9 → S3.

## 3. Loop stage status (code as of November 13, after four-scout integration)

| #   | Stage                     | Who / scout          | Status in code                                                                                          |
| --- | ------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Collection                | Tracker / Explorer   | Not connected. Manual capture (Bag Checkout) or saved public-video references (Uber Eats, DoorDash).    |
| 2   | Insight analysis          | Tracker / Explorer   | Real, explicit Analyze, per-day cap, focus-area emphasis. One live `public_video` call passed (Nov 13). |
| 3   | Evidence + suggested test | Tracker / Explorer   | Real: highlights, `suggested_test`, `suggested_route`. YouTube playback mock-tested only.               |
| 4   | Insight + test review     | Human                | Real: accept/reject/notes plus test Approve / Edit / Reject and "Accept insight & approve".             |
| 5   | Experiment                | Experimenter         | Simulated, labeled, client-side (`simulation.ts`).                                                      |
| 6   | Deltas                    | Experimenter         | Simulated, "Illustrative, not measured".                                                                |
| 7   | PR draft                  | Fixer / Experimenter | Simulated PR cards. No repository.                                                                      |
| 8   | Rollout merge             | Human                | "Merge (simulated)" / "Close" on Rollouts; only updates the simulated record.                           |

## 4. Phase 0 — Foundation (accepted history)

Kept concise; details live in [UX-IMPLEMENTATION.md](UX-IMPLEMENTATION.md) and [MANUAL-VERIFICATION.md](MANUAL-VERIFICATION.md).

- [x] **0.1** Recording reliability. Fabian confirmed "Recording reliability works." after the immediate-stop / zero-second fixes (Nov 12). User-reported, not agent-observed.
- [x] **0.2** Basic recording → Gemini → review flow. User-reported working after the provider-schema fix (removed provider `maxItems`; local Zod max 50 kept). A live synthetic-frame diagnostic returned zero findings (1,414 tokens, 1,553 ms) and was not saved as data.
- [x] **0.3** Navigation and review UI: Home with mascot/loop, Insights / A/B Tests / Rollouts primary areas, Research tools menu, safe Markdown detail, ~4 s highlights, persistent review, product scoping (Home unscoped). Covered by automated tests and isolated Chrome QA with fixtures.
- [x] **0.4** Uber Eats source library: five attributed candidates in `publicVideo.ts`, bounded ≤5-minute clips, official IFrame API player, `public_video` analysis mode with strict timestamp/clip checks. Automated tests use mocked provider and player only.
- [ ] **0.5** Save one real analysis artifact with provenance (model, input mode, date, usage, latency) and show it as "Saved real analysis", never as a fresh call.
- [ ] **0.6** Verify failure states end-to-end on a real run: permission cancel, missing key, malformed output, no findings.
- [ ] **0.7** Paired frames+events vs events-only evaluation on independently labelled Bag Checkout recordings (diagnostic, not part of the loop).

Latest automated checkpoint recorded in AGENTS.md: 188 tests / 31 files, typecheck and build pass, lint has zero errors and seven pre-existing warnings (Nov 13).

## 5. Phase 1 — UI alignment of the full loop (implemented; browser QA pending)

**Spec:** AUTOMATED-LOOP.md sections 1.1 and 4. **Depends on:** Phase 0. Checked items are implemented and covered by automated tests (mocks for provider and player); none has been checked in a real browser by an agent.

Agent output and prompt:

- [x] **1.1** Add optional `suggested_test` (hypothesis, change, primary metric, optional guardrail and target screen) to the Zod schema and the provider schema (not required there). Invalid fields fail the run. No effect sizes, uplift or sample sizes from the model.
- [x] **1.2** Prompt: keep the improvement-first framing already in `analysisPrompt.server.ts` and add one instruction to propose one falsifiable test per improvement, measurable on screen recordings.
- [x] **1.3** Agent focus areas (fixed enum) sent as emphasis in the prompt, never free text, never removing other lenses. Not added to anything the blind payload forbids.

Human decisions:

- [x] **1.4** `test_decision` stored separately from the model's original `suggested_test`. Edits write only to `edited_test`; the UI labels "Agent suggestion" vs "Edited by reviewer".
- [x] **1.5** Rules: approval needs an accepted insight; "Accept insight & approve test" does both in one queued write; rejecting/reopening the insight or editing after approval resets to pending; empty hypothesis/change/metric blocks approval. Approval starts only the labeled client-side simulated run (no network call, repository write or deployment), and the UI says so.
- [x] **1.6** Legacy `next_step` drafts shown read-only as "Earlier research draft". New UI does not create them.

Pages:

- [x] **1.7** Home: 8-stage loop overview with agent/human badges and real/simulated/not-connected status; may show a labeled sample loop. Keep mascot, infinity loop, motion toggle; no picker.
- [x] **1.8** Insights cards: category, confidence, timestamp chips that open detail at that moment, suggested-test summary with decision badge; filter by test decision; hide below-threshold findings behind a "show N below threshold" toggle.
- [x] **1.9** Insight detail: video (local blob or YouTube embed) with highlight chips, insight review, test editor with Approve / Edit / Reject.
- [x] **1.10** A/B Tests (product-scoped): approved tests with the client-side simulated experiment run (visible stages over tens of seconds, illustrative "not measured" deltas), all badged "Simulated demo"; count of pending suggestions linking to Insights; rejected list.
- [x] **1.11** Rollouts: approved test → experiment → deltas → PR → merge diagram, simulated PR cards with "Merge (simulated)" / "Close", empty state before any run. Simulated records live in their own store, are excluded from priorities/Evaluation/real counts, and Settings offers "Reset simulated demo data".
- [x] **1.12** Settings → Scouts (per-scout enable): focus areas, minimum confidence, max analyses per day (enforced on manual Analyze, counted from stored runs), cadence shown as "Runner not connected in prototype". Browser storage wrapped in try/catch with defaults.
- [x] **1.13** Nothing unlabeled: every simulated record shows a visible "Simulated demo" badge; real counts count stored real records only.
- [x] **1.14** Tests for schema, decision rules, invalidation, usage cap, threshold filter, simulation labeling/isolation/reset and page empty states; typecheck, lint, build pass.

- [x] **1.15** Four scouts (Tracker blue, Explorer green, Fixer orange, Experimenter purple) with original mascots, two buckets on Home, route fix → Fixer / experiment → Experimenter, disabled scout stops simulated runs.
- [x] **1.16** Competitors tab always present; four DoorDash candidates (`competitors.ts`) saved as competitor footage of Uber Eats and excluded from Uber Eats metrics; sample insight badged "Simulated demo" until a clip is analyzed. (Superseded Nov 13: no Competitors tab; Explorer insights sit in the unified Insights list. All four candidates were analyzed, and the curated demo bundle keeps only `GvejoxdR0Vo` / "Cart Complement Recommendations"; the candidate library is unchanged.)
- [ ] **1.17** Real-browser walk of all pages (desktop + mobile) confirming badges, scout colors and that real counts never move.
- [ ] **1.18** Re-analysis orphans simulated runs (new finding IDs → "Insight unavailable"). Known gap.

**Exit:** An evaluator can walk all 8 stages in the UI, see which are real, simulated or not connected, and approve/edit/reject a suggested test on a real insight; approval drives only a clearly badged simulated run and PR, with nothing implying a real test, PR or deployment has run.

## 6. Phase 2 — Sunday Uber Eats demo readiness

**Depends on:** Phase 0.4; Phase 1 where time allows. See [UBER-EATS-DEMO.md](UBER-EATS-DEMO.md).

- [x] **2.1** Uber Eats candidates and saved references browsable on the **Recordings** page itself, not only from Record a session.
- [ ] **2.2** Verify in a real browser that each candidate plays in-page through the IFrame API (`enablejsapi=1`, `origin`, `playsinline=1`, `start`/`end`) and that highlight chips `seekTo` the right moment. "Watch on YouTube" appears only when the player reports a blocked/private/removed embed.
- [ ] **2.3** Run one explicitly consented live `public_video` analysis; check timestamps against the footage and confirm review persistence after reload. _Partial:_ a script-driven live call on `EFCmkDTBYck` (30–105 s) returned 2 valid findings (Nov 13); nothing was saved, nobody has watched the clip, and the in-app run/persistence is not yet done.
- [ ] **2.4** Prepare the remaining usable sources and record which candidates are blocked or unsuitable. Do not claim five validated sources until measured.
- [ ] **2.5** Save at least one real run as the labelled fallback.
- [ ] **2.7** Preview at least one DoorDash candidate in-page and optionally analyze it on the Competitors tab.
- [ ] **2.6** Rehearse the 6-step happy path on the demo laptop (UBER-EATS-DEMO.md): HQ → Insights → "Order again" → approve test and follow the run → review PR → Merge. Check phone width (375 px) and the merge animation. Narrate the sample and stages 5–8 as simulated.

**Exit:** On the demo laptop, at least one Uber Eats video plays in-page with real insight highlights, and the presenter can show the human decisions without leaving the app.

## 7. Phase 3 — Collection runner (later)

- [ ] **3.1** Choose the Bag Checkout collection integration and evidence format (actual video stays the evidence contract; no third-party replay SDK).
- [ ] **3.2** One-time authorization, consent, excluded screens, retention and pause.
- [ ] **3.3** Automatic ingestion with stable IDs and provenance; durable, deduplicated analysis jobs with bounded retries.
- [ ] **3.4** Enforce cadence and usage cap server-side; replace the "Runner not connected" label with real job status.
- [ ] **3.5** Demonstrate a new session producing an insight with no team recording, upload or Analyze click. No-findings is a valid result.
- [ ] **3.6** Cohort aggregation (AUTOMATED-LOOP.md §1.2): group per-session observations across the latest N sessions per product and screen into cohort insights, with links to every supporting highlight.
- [ ] **3.7** Settings → Scouts → Tracker: sample size N (default 50) and minimum support. Bugs and friction require the threshold before surfacing or routing to the Fixer. Improvement ideas below the threshold show as "Hypothesis · seen in k of N".
- [ ] **3.8** Cards show the real "Seen in k of N sessions" denominator, plus a "Single-session observation (n = 1)" label until aggregation ships. Experiment deltas compare cohorts, never single recordings.

## 8. Phases 4–6 — Experiment, deltas, PRs (later)

- [ ] **4.1** Experiment agent takes an approved test, implements the variant in a defined environment, and collects variant recordings. Editing an approved test after approval requires a new decision.
- [ ] **4.2** Variant recordings go through the same insight agent and prompt.
- [ ] **5.1** Compare control vs variant recordings; report user-experience deltas with evidence, counts and uncertainty. Show inconclusive results honestly; no causal claims beyond the data.
- [ ] **5.2** A/B Tests page replaces the simulated run with real running/completed states and measured deltas.
- [ ] **6.1** Choose one source-control provider; define scoped authorization (MCP is not authorization).
- [ ] **6.2** PR agent produces an evidence-linked PR with checks run, assumptions and risks.
- [ ] **6.3** Rollouts lists real PRs with deltas and evidence; humans merge or decline. No automatic merge. Respect Lovable's no-history-rewrite rule.

## 9. Support tracks

**S1 — Persistence.** IndexedDB remains the working store (DB name unchanged). Optional Supabase adapter exists but is unverified live. R2 is the preferred future video store, not implemented. Decide only when Phase 3 needs unattended storage; follow Lovable schema/secret rules.

**S2 — Customer and pitch.** Customer hypothesis: game studios and consumer app incubators (unverified). Open: Katherine's interviews, Maria Emilia's verified competitor research (PostHog and others from primary sources), deck and three-minute pitch rehearsal, measured video-vs-events value. Treat market claims from the meeting as hypotheses.

**S3 — Competitor exploration (Explorer).** Back burner per Fabian (Nov 13), but the Competitors tab always exists and DoorDash public walkthroughs can be saved and analyzed through `public_video`. Automated competitor exploration agents remain out of scope.

## 10. Archived — Miso food delivery

Miso was built as a controlled delivery fixture (dead click, missing context, text clipping) for an earlier Sunday plan. It is **no longer a product or demo**. Tasks are closed as archived, not accepted:

- ~~Use Miso as the first connected product~~ — archived.
- ~~Rehearse Miso native capture and analysis~~ — archived.
- ~~Food Delivery product button~~ — replaced by Uber Eats and Bag Checkout App.

Existing Miso recordings stay in IndexedDB untouched (no migration, deletion or relabelling) and must never be presented as Uber Eats findings. [SUNDAY-DELIVERY-DEMO.md](SUNDAY-DELIVERY-DEMO.md) is historical.

## 11. Decision log

| ID  | Decision                                 | Position                                                                                                                                                                          | Status                                           |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| D1  | Operating model                          | Automated loop; humans only review insights, decide tests, merge PRs                                                                                                              | Resolved Nov 13                                  |
| D2  | Products                                 | Uber Eats (public video demo) and Bag Checkout App; Miso archived                                                                                                                 | Resolved Nov 13                                  |
| D3  | Approval mechanism                       | Model `suggested_test` + human `test_decision`; `next_step` drafts are legacy                                                                                                     | Resolved Nov 13                                  |
| D3b | Unconnected stages in the UI             | Labeled client-side simulated demo data for experiment/deltas/PRs (AUTOMATED-LOOP.md §3)                                                                                          | Resolved Nov 13                                  |
| D4  | Insight focus                            | Improvements first, bugs one subset                                                                                                                                               | Resolved; prompt implemented                     |
| D5  | Gemini input modes                       | Frames+events, events-only, public YouTube `fileData`; one live public-video call passed                                                                                          | Open (Phase 2.3 quality)                         |
| D9  | Scouts                                   | Tracker / Explorer find, Fixer / Experimenter change; DoorDash as Uber Eats competitor                                                                                            | Resolved Nov 13                                  |
| D10 | Insight unit                             | Cohort-level insights over a tunable sample (default N = 50); support threshold required for bugs/friction, ideas below threshold are labeled hypotheses (AUTOMATED-LOOP.md §1.2) | Resolved Nov 13; implementation Phase 3          |
| D11 | Navigation                               | Exactly HQ, Insights, A/B Tests, Rollouts; hero names are internal labels; no standalone Competitors tab (`?tab=competitors` maps to Explorer filter)                             | Resolved Nov 13 (team meeting); implemented      |
| D12 | Insights view                            | One list of insight blocks, no thumbnails; source marker Tracker (blue) / Explorer (green) / Both; "from N videos" with a minimum-videos filter                                   | Resolved Nov 13; implemented                     |
| D13 | HQ                                       | 2/3 "Needs your attention" insights, 1/3 stacked agent tiles (running, usage, credits, spend); demo starts here                                                                   | Resolved Nov 13; implemented                     |
| D14 | Demo happy path                          | HQ → Insights → "Order again" (sample, Both) → approve test → follow run → review PR → merge with flying hero; featured trio tracker-only / explorer-only / both                  | Resolved Nov 13; implemented, browser QA pending |
| D15 | Fixer naming                             | Fixer is bugs only, de-emphasized, not in demo; rollouts belong to Experimenter; "Plumber" floated                                                                                | Open, deprioritized                              |
| D16 | Bug GIF slide                            | Bag Checkout recording GIF slide made by Maria and Daniela outside the app                                                                                                        | Owned outside app                                |
| D17 | Gemini agentic video config              | Switched on for `public_video`; 88%/7% are Google benchmark claims; our one 82 s test used ~33% more tokens                                                                       | Resolved; quality not compared                   |
| D6  | Collection integration for Bag Checkout  | Not selected                                                                                                                                                                      | Open (Phase 3)                                   |
| D7  | Experiment environment and repo provider | Not selected                                                                                                                                                                      | Open (Phases 4, 6)                               |
| D8  | Video storage (R2 vs Supabase)           | R2 preferred, nothing provisioned                                                                                                                                                 | Open (S1)                                        |

## 12. Progress notes

| Date       | Phase  | Outcome                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-12 | 0      | Meeting translated into phases; UX milestone, Gemini schema fix, capture reliability (user-confirmed).                                                                                                                                                                                                                                                                                                 |
| 2026-11-13 | 0.4    | Uber Eats public-video library and `public_video` mode implemented; mock-tested only.                                                                                                                                                                                                                                                                                                                  |
| 2026-11-13 | 1, 2.1 | Four scouts, suggested tests/routes, Settings → Scouts, Competitors/DoorDash, simulated A/B Tests and Rollouts implemented; 188 tests / 31 files pass. One live `public_video` Gemini call passed. No browser QA.                                                                                                                                                                                      |
| 2026-11-13 | Plan   | Restructured around the automated loop. Miso archived. Next: Phase 1 UI alignment and Phase 2 demo readiness. No application code changed by this update.                                                                                                                                                                                                                                              |
| 2026-11-13 | 1, 2   | Team-meeting build: nav HQ/Insights/A/B Tests/Rollouts, unified Insights with source markers and video counts (no thumbnails), HQ split, 6-step happy path with labeled sample, flying-hero merge. Two code reviews: 21 findings, 18 fixed, 1 partly fixed, 2 left on purpose. 257 tests / 41 files, typecheck, lint (7 old warnings, 0 errors) and build pass. No browser QA, commit, push or deploy. |

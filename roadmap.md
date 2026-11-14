# LoopMate — Roadmap

Updated November 13, 2026. Canonical vision: [docs/AUTOMATED-LOOP.md](docs/AUTOMATED-LOOP.md). Tasks and acceptance evidence: [docs/PROTOTYPE-PHASE-PLAN.md](docs/PROTOTYPE-PHASE-PLAN.md).

## The loop

**Collection agent → insight agent (improvements + evidence highlights + suggested A/B test) → HUMAN reviews insight and approves / edits / rejects the test → experiment agent implements and records the variant → deltas → PR agent → HUMAN merges on Rollouts.**

Insights are product improvements (UI, UX, layout, button size and target area, copy, discoverability, engagement), with bug fixes as one subset. Manual recording and Analyze are research tools, not the workflow.

Products: **Uber Eats** (public YouTube walkthroughs, Sunday demo) and **Bag Checkout App** (controlled fixture). Miso food delivery is archived.

## Now — Phase 1: UI shows the whole loop

- [ ] Model returns an optional `suggested_test` per insight; prompt keeps the improvement-first framing and asks for one falsifiable test.
- [ ] Approve / edit / reject on insight detail, with "Accept insight & approve test"; model original kept separate from human edits.
- [ ] Home shows all 8 stages with agent/human and real/simulated/not-connected badges.
- [ ] A/B Tests page: approved tests with a labeled client-side simulated experiment run ("Simulated demo"), pending count linking to Insights, rejected list.
- [ ] Rollouts page: pipeline diagram, labeled simulated PR cards with "Merge (simulated)", empty state before any run.
- [ ] Settings: "Reset simulated demo data"; simulated records stay out of research metrics.
- [ ] Settings → Agents: focus areas, minimum confidence, daily analysis cap (enforced on Analyze), cadence label only.

## Now — Phase 2: Sunday Uber Eats demo (Nov 15)

- [x] Five attributed public candidates, bounded clips, IFrame API player, `public_video` analysis mode (mock-tested).
- [ ] Browse Uber Eats candidates and saved references directly on Recordings.
- [ ] Verify in-page playback and highlight seeking in a real browser; YouTube link only on embed errors.
- [ ] Run one live consented analysis, check timestamps, save a labelled fallback run.
- [ ] Rehearse the loop walkthrough on the demo laptop.

## Later — the agents

- [ ] Phase 3: collection runner with authorization, scheduling and server-enforced usage caps.
- [ ] Phase 3: cohort-level insights. Aggregate observations across a tunable sample (default N = 50 sessions) so one user's experience doesn't drive a change. Bugs need a support threshold, and ideas below it are labeled hypotheses.
- [ ] Phase 4: experiment agent implements approved variants and records them.
- [ ] Phase 5: control vs variant delta evaluation with evidence and uncertainty.
- [ ] Phase 6: PR agent opens evidence-linked PRs; humans merge on Rollouts.
- Support: shared persistence (R2 preferred, nothing provisioned), customer and pitch validation, optional competitor exploration.

## Done

- [x] Recording reliability and basic recording → Gemini → review (user-confirmed, Nov 12).
- [x] Home, navigation, evidence detail with ~4 s highlights, product scoping. [UX checkpoint](docs/UX-IMPLEMENTATION.md).
- [x] Improvement-first Gemini prompt (`analysisPrompt.server.ts`).

Not implemented: collection runner, suggested tests, test decisions, the simulated experiment/delta/PR flow, real experiments, measured deltas, PRs. Simulated stages must always be badged; no UI may imply a real experiment, delta or PR exists.

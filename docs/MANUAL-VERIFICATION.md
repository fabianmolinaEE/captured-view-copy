# LoopMate — Manual acceptance checks

Updated November 13, 2026. These checks need a real desktop browser and, for inference, a real server Gemini key. Mocked tests do not count as passing them. The target loop is defined in [AUTOMATED-LOOP.md](AUTOMATED-LOOP.md). Checks marked **(planned)** apply once that UI contract is implemented; until then, record them as not yet testable.

## 1. Sunday demo: Uber Eats in-page playback and highlights

1. Open Recordings, choose **Uber Eats**. Confirm saved references appear and (planned) the five candidates from `publicVideo.ts` are browsable on this page with creator attribution. Today the candidate library is under Record a session.
2. Preview a candidate. It must play **inside the page** via the YouTube IFrame API: no redirect or new tab to youtube.com. Check the iframe `src` includes `enablejsapi=1`, `origin=<this origin>`, `playsinline=1`, and `start`/`end` for the saved clip.
3. Confirm the player reports duration, the reviewed segment is capped at five minutes, and saving creates one reference (duplicate clicks do not create two).
4. Make one explicitly consented `public_video` analysis. Verify actual model name, latency, usage and that every timestamp falls inside the clip on the original video timeline. Empty results stay empty; failures show a fixed hint, not a raw provider message.
5. Open an insight from Insights. Click each highlight chip/timestamp: the embedded player seeks (`seekTo`) to that point and stops after the bounded ~4 s range. Repeat several highlights and a full replay.
6. Use a blocked/private/removed video ID if available: an error message appears and only then a "Watch on YouTube" link.
7. On mobile width, the player is inline (`playsinline`), attribution visible, no horizontal overflow.

## 2. Insight review and suggested A/B test

1. Accept, reject and reopen an insight; type notes quickly and set severity; refresh. Everything persists and exported JSON keeps the original model output unchanged.
2. **(planned)** Each insight shows an "Agent suggestion" test (hypothesis, change, primary metric, optional guardrail and target screen) with no predicted numbers.
3. **(planned)** "Approve test" is disabled while the insight is pending or rejected. "Accept insight & approve test" sets both in one write; refresh and confirm.
4. **(planned)** Edit the test: the card shows "Edited by reviewer", the agent original stays intact in export, and editing an approved test returns it to pending. Empty hypothesis, change or primary metric blocks approval.
5. **(planned)** Reject a test; reopen or reject an insight with an approved test and confirm the test returns to pending. Refresh after each step.
6. **(planned)** Confirm approval starts only the labeled client-side simulated run: no network request, repository write or deployment (check the network panel), and the UI says so.
7. Legacy `next_step` drafts on older findings remain readable as "Earlier research draft" (planned label) and never appear in model input.

## 3. A/B Tests, Rollouts and simulated stages

- Today both pages are Coming Soon placeholders and must show no running work, participants, deltas, uplift, PRs or counters.
- **(planned)** A/B Tests lists stored approved tests for the selected product; each runs a client-side simulated experiment through visible stages and ends with deltas marked "illustrative, not measured". Every card and detail shows a visible "Simulated demo" badge (not tooltip-only). Pending-suggestion count links to Insights; rejected list present.
- **(planned)** Rollouts shows the approved test → experiment → deltas → PR → merge diagram, simulated PR cards badged "Simulated demo", and "Merge (simulated)" / "Close" that only change the simulated record. Before any run, an empty state explains PRs appear after an experiment finishes.
- **(planned)** Simulated records do not change Insights priorities, Evaluation metrics or any real count. Settings → "Reset simulated demo data" clears them and leaves research sessions intact.
- **(planned)** Home shows the eight loop stages with agent/human badges and real / simulated / not-connected status.

## 4. Settings → Agents (planned)

Pick focus areas and confirm the request contains only the fixed enum values. Raise minimum confidence and confirm lower findings are hidden behind "show N below threshold" but still stored. Set max analyses/day low, analyze until reached, and confirm Analyze is disabled with an explanation. Cadence reads "Runner not connected in prototype".

## 5. Products and Home

1. Fresh tab: Home shows hero and "Across your products" overview with no product picker.
2. Insights, Recordings, Evaluation and Record a session require a product. The picker lists **Uber Eats** and **Bag Checkout App** only; Miso does not appear. Old Miso recordings, if present, show as "Archived delivery app" and are not counted as Uber Eats.
3. Each scoped page uses only the selected product's data. Selection persists per tab across navigation and refresh. Deep links adopt their evidence product. Historical `Carry checkout` recordings belong to Bag Checkout App.
4. Product buttons are disabled during permission, capture, save and unsaved-video recovery.

## 6. Diagnostic research tools (Bag Checkout)

These remain available under Research tools; they are not the operating loop.

1. Without credentials: no sample data, Settings says AI not configured, Analyze disabled.
2. Record a session (Bag Checkout): no capture without consent and the native picker; cancel/deny saves nothing; wrong tab/window is rejected where Capture Handle is supported. Record, scroll, stop via the app and via the browser control, refresh, replay, click events, download video/JSON. Resize during recording: capture continues and crop recalculates. Stops under one second show a retry message.
3. Analyze with consent; inspect the real result, model, latency and usage. Researcher setup pixels, scenarios, ground truth, notes, drafts and test decisions never appear in model input. Invalid credentials produce a failure, not a success; older runs remain.
4. Events-only run: no frames or visual fields in the request.
5. Evaluation: independent ground truth, verified matches, unknown judgments not counted, duplicates do not raise recall, paired denominators shown.
6. Optional Supabase adapter, only after Lovable provisions it: explicit upload/import, conflict on stale upload, public bucket refused, local and shared deletion separate.

## 7. Theme and motion

Every route uses the continuous purple/navy canvas; `.phone` keeps its light palette. Pause motion, navigate and reload: it stays paused. System reduced motion stops animation without hiding content. Downloads use the `loopmate-` prefix.

## Archived

Miso food delivery checks (formerly "Sunday food-delivery acceptance" and the Food Delivery product picker) are archived and not part of acceptance. Historical scripts remain in [SUNDAY-DELIVERY-DEMO.md](SUNDAY-DELIVERY-DEMO.md) for reference only.

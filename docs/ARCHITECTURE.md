# LoopMate — Pipeline and presentation interfaces

## Status and the loop

The product vision and prototype UI contract live in [AUTOMATED-LOOP.md](AUTOMATED-LOOP.md); it wins over any conflicting text here. LoopMate is an automated improvement loop: agents collect recordings, find product **improvements** (UX, UI, layout, target size, copy, effort, trust, engagement; bugs are one subset), attach playable evidence and a suggested A/B test, run approved tests on their own, measure deltas and draft PRs. Humans only (1) review insights with highlights, (2) approve, edit or reject suggested A/B tests and (3) merge PRs on Rollouts. Manual recording, the Analyze button, Evaluation and ground-truth labels are diagnostic research tools, not the operating workflow. This document describes the modules that exist and marks planned contracts explicitly.

Products: **Uber Eats** (`uber-eats`, public YouTube references) and **Bag Checkout App** (`checkout`, consented recordings of the controlled `TestApp` fixture). Miso food delivery is archived (see below).

### Loop stage → module map

| Stage | Actor | Modules today | Status |
| ----- | ----- | ------------- | ------ |
| 1 Collection | Collection agent | `capture.ts`, `eventLogger.ts`, `captureViewport.ts` (Bag Checkout); `publicVideo.ts`, `UberEatsSources.tsx` (Uber Eats references); `sessionStorage.ts` | Manual consented capture / saved references only. No runner, scheduler or background collector. |
| 2 Insight analysis | Insight agent | `frameSampler.ts`, `aiReview.ts` (`blindPayload`, Zod schema), `server/analysis.server.ts`, `server/analysisPrompt.server.ts`, `apiClient.ts`, `AnalysisPanel.tsx` | Real Gemini call with an improvement-focused prompt (`recommendation`, `expected_benefit` fields). Triggered by an explicit Analyze action. |
| 3 Evidence + suggested test | Insight agent | `evidence.ts`, `EvidencePanel.tsx`, `PublicVideoPlayer.tsx` | Highlights real. `suggested_test` **planned** (below). |
| 4 Insight review | Human | `review.ts`, `use-research-session.ts`, `InsightDetail.tsx`, `Insights.tsx`, `insights.ts` | Accept/reject/notes/severity real. Test decisions **planned**. |
| 5 Experiment | Experiment agent | none | Not connected. Planned: labeled client-side simulated run started by test approval. |
| 6 Deltas | Insight agent | none | Not connected. Planned: deterministic illustrative deltas marked "not measured"; never real numbers. |
| 7 PR draft | PR agent | none | Not connected. No repository connection. Planned: labeled simulated PR record. |
| 8 Rollout / merge | Human | `rollouts` route | Not connected. Planned: simulated PR cards; "Merge (simulated)" only updates the simulated record. |

At the time of writing, `/ab-tests` and `/rollouts` still render `ComingSoon`; AUTOMATED-LOOP.md section 4.4 replaces them with the approved-test queue, simulated run progress and simulated PR cards. Simulated records carry `simulated: true`, a visible "Simulated demo" badge and their own local store; they are excluded from `insights.ts` priorities, Evaluation and every real count, and Settings can reset them. Nothing unlabeled or fabricated-as-real anywhere.

### Planned contract: suggested test (not implemented)

Each finding gains an optional, model-authored `suggested_test` (in the Zod `proposalSchema` and, not required, in the provider schema) plus a separate human `test_decision`:

```ts
interface SuggestedTest { hypothesis: string; change: string; primary_metric: string; guardrail_metric?: string; target_screen?: string }
interface TestDecision { decision: "pending" | "approved" | "rejected"; edited: boolean; edited_test?: SuggestedTest; decided_at?: string }
```

The model original and `raw_output` are never mutated; edits go only to `test_decision.edited_test`. A test can be approved only when its insight is accepted ("Accept insight & approve test" writes both in one queued save). Rejecting/reopening the insight, or editing after approval, resets the test to `pending`. Empty hypothesis/change/primary metric blocks approval. The model must not supply numbers, uplift or sample sizes; an invalid `suggested_test` fails the run. Approval starts only the labeled client-side simulated run (no network call); no real experiment, repository write or deployment starts. Test decisions never enter `blindPayload`. Researcher `next_step` drafts are legacy, read-only ("Earlier research draft") and are not the approval mechanism.

### Planned contract: agent settings (not implemented)

Settings → Agents, stored per workspace in browser storage (try/catch, defaults):

- `focus_areas`: allow-listed enum array (navigation, layout/hierarchy, target size, copy, accessibility, feedback/responsiveness, effort, discoverability, trust, engagement, bugs), sent to the server and added to the prompt as emphasis only. Never free text; never removes other lenses.
- `min_confidence`: client-side filter on Insights with a "show N below threshold" toggle; findings stay stored.
- `max_analyses_per_day`: usage cap counted from stored runs; disables manual Analyze when reached.
- `cadence`: label only, shown as "Runner not connected in prototype".

### Storage and infrastructure

Cloudflare R2 is the preferred candidate for future private video storage; the optional Supabase adapter is the only cloud implementation in code, and its live behavior is unverified. No R2 adapter, migration, durable job store or scheduler exists. Provision schema and secrets through Lovable and preserve local data until a researcher explicitly uploads or migrates.

## Reused components and modules

The original `Sessions`, `TestApp`, `SessionReview`, `Evaluation`, `Settings`, `Shell`, `Hero`, capture controller, event logger, IndexedDB stores, sampler, finding schema boundary and scoring modules remain the basis of the app. No database migration, manual generated-file edit, framework replacement or publication is required.

- `capture.ts`: permissioned `getDisplayMedia` and `MediaRecorder`; recording-relative anchor at `recorder.start`, current-tab Capture Handle verification when available, late-picker cancellation, exactly-once finalization, crop metadata and WebM duration repair. Callback receives real video bytes plus aligned events. Clips shorter than one second or without video bytes are rejected; stop reasons are saved. Missing Capture Handles do not end an active recording; a confirmed different handle does.
- `captureViewport.ts`: ignores redundant resize events and remeasures the checkout crop after actual viewport changes settle for 250 ms. `capture_region_valid_from_ms` restricts sampled images to footage after the latest stable crop; original video/events remain intact.
- `eventLogger.ts`: relative event times and an allowlist of semantic flags. Inputs log only focus/change flags, never field values. Controlled backend requests use `application_*` names and `source: local_simulated_backend`, not actual network telemetry.
- `frameSampler.ts`: default 2-second interval, 24-frame cap and max 960-pixel width. It reserves uniform coverage, includes the end, adds signal-adjacent frames, applies calibration, and crops the checkout. The cap spreads coverage for longer videos; it does not promise complete 2-second coverage. Decode/seek waits are bounded.
- `aiReview.ts`: explicit `blindPayload`, separate events-only payload with no frames key, Zod output validation, and evidence ID/timestamp checks. No issue config, ground truth, session title, reviewer note, prior output or human decision crosses the boundary. Image pixels are a separate leakage risk, addressed by the stable checkout crop and rejecting legacy uncropped recordings for multimodal use.
- `server/analysis.server.ts`: provider protocol, system instruction, timestamped images and events, structured output, server-side validation, actual model version/latency/reported usage, input fingerprint and original JSON output. Confidence is not calibrated; citations are machine-checked for existence and bounds, while factual support still needs human verification.
- `server/api.server.ts`: research endpoint handler mounted in the existing TanStack Start custom fetch entry (`src/server.ts`). This avoids placing secrets in isomorphic route modules. Reads runtime bindings/server environment only. Same-origin checks, team bearer access, input limits, timeout and per-isolate in-flight guards protect the prototype. Remote requests without a workspace token configuration are refused. Status exposes configuration booleans and the model name only. All responses disable caching.
- `apiClient.ts`: browser-only access-code storage, status and analysis orchestration. `AnalysisPanel({session, onResult, onError})` displays consent and progress and returns a run plus proposals. Its parent persists runs and never silently confirms proposals.
- `sessionStorage.ts`: original IndexedDB schema and historical database identifier retained across the LoopMate rebrand so existing recordings remain accessible. New audit/video downloads use the `loopmate-` prefix. Full audit JSON export and separate video download. `review.ts` updates only human fields; original model output stays on its run. Review writes are queued and optimistic UI changes occur immediately to prevent fast typing from losing decisions. Local failures remain visible and can be retried/exported.
- `sharedStorage.ts` / `server/backend.server.ts`: explicit cloud snapshot upload, fetch, update and deletion through Supabase REST and authenticated object storage. No browser service-role or Gemini credentials. SessionReview shows sync state; Sessions explicitly lists/imports shared copies. HTTP 409 preserves local edits on conflicts.
- `insights.ts`: latest completed multimodal run, accepted findings, fully resolved proposal review, source app + category + normalized screen equivalence (denominators use the same source), distinct-session frequency. Severity comes from human review (major is a clearly labeled default estimate). Frequency/severity/repeated retries/evidence contribute to estimated priority. Human-marked blockers retain priority at low frequency. No abandonment or causal revenue claims are inferred.
- `evaluation.ts`: latest completed run per selected mode, observed ground-truth issues, unique verified matches for recall; false-positive share denominator is verified, resolved proposal correctness decisions. Unknown linked truth is unresolved. Evidence quality uses explicit evidence judgments and source-appropriate timestamp/context checks; unknown is excluded. Video-needed rate uses verified correct findings with completed necessity judgments. The paired cohort has both modes on identical session IDs. Detection is withheld in the UI when proposal correctness is unresolved.

## UX component interfaces

- `Home` reads local sessions and their latest completed multimodal proposals across products (no picker). Cards link to the three primary areas; counters reflect actual saved data and remain placeholders during load. There is no fabricated agent status. Planned: an 8-stage loop overview with agent/human badges and honest connected/not-connected status.
- `Insights` separates Internal research from an External Coming Soon state. Internal lists pending/accepted/rejected proposals from each session's latest completed video + events run. Prioritized retains the existing accepted cross-session aggregation and formula. Baseline and historical runs remain in session review/evaluation.
- `InsightDetail({sessionId, findingId})` resolves the actual saved session, finding and completed run. It displays source provenance, structured observations/interpretations, review, notes and draft actions. `react-markdown` renders text with an explicit element allowlist; raw HTML, remote images and link behavior are excluded.
- `EvidencePanel({session, finding})` plays the original local Blob, applies session calibration and highlights up to four seconds around the finding. `evidence.ts` clamps the media range to recording/decoded boundaries. Event buttons seek the same recording; events-only findings explicitly state that the model did not receive video. No separate clip is uploaded.
- `useResearchSession(id)` loads the document, applies optimistic functional updates and serializes IndexedDB writes. Failures preserve in-memory edits, show unsaved status and support retry/export. Edits mark shared documents as local changes.
- `NextStepDraft({finding, update})` (legacy; currently still rendered by `InsightDetail`) stores researcher intent in `finding.next_step` (title, scope, status, update time). `actions.ts` requires accepted evidence and non-empty fields before approval; editing or reopening/rejecting revokes it. It is not the loop's approval mechanism: the planned `suggested_test` / `test_decision` contract replaces it, and existing drafts become read-only "Earlier research draft". Neither drafts nor review fields enter `blindPayload`.
- `ComingSoon({area})` currently backs `/ab-tests` and `/rollouts` with no execution controls, sample metrics or synthetic jobs; it is slated for replacement per AUTOMATED-LOOP.md 4.4. `Shell` keeps research tools accessible on desktop and in a mobile menu, with the three primary areas in mobile navigation.

## Stored audit fields

Session IDs are UUIDs, dates are ISO 8601 and recording-relative positions are milliseconds. Runs retain `mode`, actual `model_name`, timestamps, latency, reported token fields if supplied, parsed original `raw_output`, sampled timestamps and a SHA-256 `input_fingerprint`. Token counts and dollar costs are never inferred. Findings retain model evidence/interpretation; reviewer status, note and severity are distinct human fields. Failed runs retain a useful failure state without findings.

Ground truth belongs to the session, not a model run. It starts unknown for enabled scenarios; researchers can add independently observed issues. It never follows automatically from configured defects or proposal acceptance. Explicit matches and evidence judgments belong to finding IDs, so reruns do not inherit old correctness decisions.

## Security and research scope

The shared access code is a prototype credential for a trusted team. Production work needs individual identity, scoped authorization, distributed request budgets, durable jobs, proper audit history and retention. API limits are prototype bounds; upstream hosting must also limit request bodies and rates. In-memory captured chunks are not crash recovery. No third-party behavioral analytics is installed. Videos stay local until a researcher explicitly requests shared upload; analysis transfers only cropped frames/events after separate consent. Researchers must visually check for synthetic-only information, because automatic image redaction is not implemented.

## Shared workspace theme

`Shell` sets `data-theme="loop"` for every research route. `src/styles.css` uses shared dark semantic tokens for controls and translucent surfaces over the same purple/navy ambient canvas. Home-specific selectors adjust only its open hero/workflow layout. `.phone` resets tokens and color scheme for the controlled light storefront, preserving its scenario presentation. Keep these boundaries when adding routes; do not reintroduce a white page background or accidentally recolor the recording stimulus.

## Provider-schema compatibility and safe errors

The Gemini output grammar intentionally omits the `maxItems: 50` constraint that reproduced INVALID_ARGUMENT with Gemini 3.5 Flash-Lite. The rest of the structured schema remains in the request. Zod still limits outputs to 50 findings locally, checks cited event IDs/timestamps and rejects invalid evidence. `geminiErrors.server.ts` inspects provider status/reasons only to choose fixed diagnostic hints; it never returns raw messages, metadata, credentials or request payloads. There is no automatic fallback or duplicate retry.

After the fix, the actual analysis module completed a live multimodal diagnostic with one synthetic blank JPEG and no events. It returned zero findings and was not persisted as a research run. This verifies provider compatibility, not live recording acceptance or detection quality.

## Product selection and analytics scope

`products.ts` defines exactly two products, Uber Eats (`uber-eats`, source `Uber Eats`) and Bag Checkout App (`checkout`, source `Bag checkout app`, legacy alias `Carry checkout`). No stored recordings are renamed or migrated. `useProduct` persists the selection per tab with an SSR-safe `useSyncExternalStore`; `ProductPicker` gates Insights, Recordings, Evaluation and recording setup, which filter loaded sessions before computing any counts, proposals, priorities or paired comparisons. Detail routes adopt their evidence's product. Unknown sources enter neither product. Home is an unscoped overview with no picker; Settings is workspace-wide. Product scoping is a view filter inside the existing team authorization, not a tenant boundary. The optional backend summary query projects `source_app` from the existing JSON document (mock-tested only).

## Uber Eats public-video references

`publicVideo.ts` lists five attributed public walkthrough candidates (`uberEatsCandidates`) and validates canonical YouTube URLs and clips of at most five minutes. References carry no copied video bytes, events, planted scenarios or ground truth. `public_video` analysis sends only the YouTube URL as Gemini `fileData` with `media_processing: "AGENTIC"` (agentic video understanding; the clip window is a fixed MM:SS text instruction since `videoMetadata` clipping is static-only); timestamps stay on the original video timeline, and findings outside the clip, without visual support or citing internal events are rejected. `PublicVideoPlayer` uses the official IFrame Player API (`enablejsapi=1`, `origin`, `playsinline=1`, `start`/`end`) and seeks highlights with `seekTo`; a "Watch on YouTube" link is a fallback only for blocked/removed embeds. Public references are excluded from customer-frequency priority cohorts and events-only comparisons, and have no cloud upload. Provider and player behavior are tested with mocks; real embed playback and live Gemini video analysis are unverified. See [UBER-EATS-DEMO.md](UBER-EATS-DEMO.md).

## Archived: Miso food delivery fixture

Miso is not a product and does not appear in the picker. `productNameForSource` renders its source as "Archived delivery app"; existing Miso recordings remain untouched in IndexedDB. `FoodDeliveryDemo.tsx` and the `delivery` DemoKind remain in code for backward compatibility, but `TestApp` defaults to the Bag Checkout fixture. The `dead_click`, `missing_context` and `text_clipping` categories remain globally available. Never present Miso's planted issues as Uber Eats findings.

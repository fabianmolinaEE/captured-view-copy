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

Last updated: **November 12, 2026**. This is the repository's agent entry point. Read it before continuing work; maintain the handoff as implementation and verification change. Preserve the Lovable-managed block above.

## Start here in a new session

1. Read `git status --short` and relevant diffs. This workspace contains substantial **uncommitted and untracked implementation work** from the current development session. Preserve it; do not reset, clean, overwrite or assume untracked files are disposable. The pre-existing untracked `package-lock.json` was updated by dependency installation.
2. Read [README.md](README.md) for setup/demo instructions, [the phase plan](docs/PROTOTYPE-PHASE-PLAN.md) for feature scope and todos, and [the UX checkpoint](docs/UX-IMPLEMENTATION.md) for current UI behavior and acceptance evidence.
3. Use [ARCHITECTURE.md](docs/ARCHITECTURE.md) for module boundaries, [MANUAL-VERIFICATION.md](docs/MANUAL-VERIFICATION.md) for real-browser acceptance, and [IMPLEMENTATION.md](docs/IMPLEMENTATION.md) for the earlier November 11 checkpoint. Its older test counts and configuration notes are historical, not current runtime state.
4. Resume the next unfinished acceptance task below unless the user requests something else. Check existing functionality before implementing a replacement.

## Product and design decisions to preserve

- The product is **LoopMate**. “From zero to hero. One loop at a time.” is the home headline, not a request to restore the old product name. Keep the friendly superhero mascot.
- The product vision is evidence → reviewed insights → approved experiments → reviewed code changes → measured rollouts. The interview priority is the **real recording → Gemini → evidence → human review** experience.
- Primary areas: **Insights**, **A/B Tests**, **Rollouts**. Recordings, recording setup, Evaluation and Settings remain available under Research tools. Mobile has three primary bottom-nav areas and a research-tools menu in the header.
- The user specifically requested a **continuous purple/navy background across all pages**, with transparent/blended navigation and restrained translucent research surfaces. Do not reintroduce a white subpage or a large boxed hero. Violet, aqua, peach and gold are accents. Use the shared `data-theme="loop"` shell and theme tokens in `src/styles.css` instead of hardcoded pale surfaces.
- Preserve readable fields, contrast, focus states and responsive layouts. The controlled checkout inside `.phone` intentionally retains its own light storefront palette; the surrounding research workspace remains dark. Do not let dashboard styling change planted UX scenarios or capture geometry.
- Keep the animated infinity loop, floating mascot, cape and interactive Discover/Test/Grow explanation. The header motion toggle persists using `loopmate-motion`; system reduced motion takes precedence. The illustration is product vision, not a live agent/progress display. Recording setup is excluded from route-entry animation.
- **External Insights, A/B Tests and Rollouts remain Coming Soon.** Do not imply competitor agents, experiments, PR generation, deployments or measured release deltas already exist. No fake jobs/counters/findings. If separately requested later, synthetic previews must be labeled and excluded from research metrics.
- Next-step draft approval only saves researcher intent. It must never start an experiment, repository write or deployment.

## Implemented baseline

| Area         | Current behavior                                                                                                                                                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recording    | Explicit browser permission/consent, controlled checkout scenarios, semantic event logging, relative timestamps, capture cancellation/source checks, safe checkout crop, WebM duration repair, local save/replay/seek/export/delete.                                                      |
| AI           | Server-side configurable Gemini integration, bounded sampled frames plus events, genuine events-only mode, strict structured-output validation, consent/progress/errors, saved success/failure runs, original output and reported usage.                                                  |
| Human review | Session and finding-detail review, timestamp/event evidence, accept/reject/reopen, notes, severity, queued persistence and retry/export on save failure.                                                                                                                                  |
| Next steps   | Researcher title/scope drafts with approve/dismiss. Approval requires accepted evidence and non-empty fields; title/scope edits or reopening/rejecting the finding revoke approval. Drafts never enter AI input.                                                                          |
| Insights     | Actual latest multimodal proposals including pending review, search/status filters, source tabs and accepted cross-session priorities. Distinct sessions count once; score is a transparent heuristic.                                                                                    |
| Evaluation   | Independent observed ground truth, verified matches, evidence judgments and a paired events-only comparison with explicit denominators/insufficient-data states.                                                                                                                          |
| Storage      | IndexedDB is the working local foundation. An optional private Supabase REST adapter supports explicit upload/import/update/delete and conflict handling. Cloud setup/live behavior is unverified. R2 is the team's preferred future video-storage candidate, not an implemented service. |
| UI           | Home with three workflow areas, safe Markdown detail view, original video with bounded ~4-second highlights, persistent review/drafts, coming-soon pages, responsive navigation, global blended theme and motion controls.                                                                |

The historical IndexedDB database identifier is intentionally unchanged to retain existing local recordings. New exports use the `loopmate-` prefix. Do not rename the database or discard recordings without a migration plan.

## What to do next — highest priority

**Finish Phase 1 acceptance with an actual consented recording and an actual Gemini response.** UI tests and synthetic QA footage do not satisfy that gate.

1. Start locally, check Settings/API status without exposing secrets, and verify the configured model is accessible to the user's account. A local `.env` exists; never print, paste, screenshot or commit its values. The most recent browser status reported Gemini configured and shared storage not configured; that does not prove a successful provider call.
2. In Record a session, select only the current app tab and use synthetic form information. Choose a scenario, interact, Stop & save, refresh, replay, and verify event alignment. Postal code `94107` lets the controlled rejection scenario proceed; other values can trigger its planted rejection.
3. Explicitly approve transmission of cropped frames/events and run Gemini. Inspect genuine findings and their evidence. Zero findings is a valid outcome; failures must remain failures. Do not run billable inference or upload footage silently just to populate a demo.
4. Open a finding from Internal Insights. Inspect its original explanation, play the highlight, accept/reject, add a note, write a next-step scope, approve the draft, refresh, and confirm persistence. Keep run provenance visible as Saved real analysis.
5. Record the acceptance outcome in the phase plan/UX notes, including relevant errors or limitations. Use private/local references for recordings, not committed video or secrets. Fix demonstrated pipeline failures before expanding the roadmap.
6. Then gather a small real research set, run paired modes and label independently. External prerecorded analysis is the next stretch milestone; Agentic Vision/native-video/YouTube/Drive inputs need capability verification before implementation promises.

Do not provision R2/Supabase, migrate frameworks, add real A/B execution, connect repositories, or build autonomous collection merely because they appear later in the plan. Follow current user scope and Lovable infrastructure rules.

## Files and interfaces

- UI: `src/components/research/{Home,LoopJourney,Insights,InsightDetail,EvidencePanel,NextStepDraft,ComingSoon,Shell}.tsx`; existing `TestApp`, `Sessions`, `SessionReview`, `Evaluation`, `Settings`, `Hero` remain in use.
- UI helpers: `src/hooks/use-research-session.ts` (optimistic document + ordered saves), `use-motion-preference.ts` (motion preference); `src/lib/research/actions.ts` (draft rules), `evidence.ts` (calibrated highlight ranges), `review.ts` (human decisions).
- Pipeline: `src/lib/research/{capture,eventLogger,frameSampler,aiReview,types,sessionStorage,insights,evaluation}.ts`; client orchestration in `apiClient.ts`; optional cloud client in `sharedStorage.ts`.
- Server: `src/lib/research/server/{api,analysis,backend}.server.ts`, mounted at `/api/research/*` through the existing `src/server.ts` entry. Keep server credentials and provider calls outside browser bundles.
- Routes: `/`, `/insights`, `/insights/$sessionId/$findingId`, `/ab-tests`, `/rollouts`, `/sessions`, `/sessions/$id`, `/test-app`, `/evaluation`, `/settings`. TanStack generates `src/routeTree.gen.ts`; edit source routes instead.
- Styles: `src/styles.css`. The root tokens and shared `data-theme="loop"` selectors define the workspace. Home-specific rules handle its open layout. `.phone` resets the controlled storefront tokens. Existing file contains earlier style layers; inspect the cascade before adding overrides.
- Tests: `src/test/` contains pipeline, storage, backend-contract, review/draft, safe-Markdown, routing and motion tests. Fixtures are confined to tests/isolated browser QA and are not product data.

## Setup and validation

Node **22.12+**, npm, existing React/TypeScript/TanStack Start/Router/Vite/Tailwind stack. No framework migration.

```sh
npm install
# If absent, copy .env.example to .env; NEVER overwrite an existing configured .env.
npm run dev

npm test
npm run typecheck
npm run lint
npm run build
```

`dev` and `preview` load the ignored `.env` into the server process. Restart after changing server configuration. Variables are documented in `.env.example` and README: `GEMINI_API_KEY`, `GEMINI_MODEL`, `RESEARCH_ACCESS_TOKEN`, optional `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEARCH_VIDEO_BUCKET`. Non-local research APIs require the workspace token. The Settings code field accepts only that team token, never a provider/service-role key.

The earlier mission explicitly authorized the direct server-side Gemini integration that already exists. Preserve that implementation for continuity; do not expand its secret handling into browser code. Treat new infrastructure/provider changes under the Lovable rules and the user's current instructions.

Latest automated checkpoint: **56 tests across 12 files pass; typecheck and production build pass.** Lint has seven pre-existing Fast Refresh warnings and no errors. Re-run appropriate checks after changes and update this checkpoint accurately.

Real isolated-Chrome QA has covered desktop/tablet/mobile layouts, navigation, safe Markdown, synthetic-video highlight playback, notes/drafts surviving reload, approval invalidation, animation pause persistence and system reduced motion. The shared purple/navy theme is applied across subpages, forms and review panels; verify any newly added route uses the same shell and preserves the checkout palette. Desktop route backgrounds/dark fields and the light checkout palette passed browser checks. A rapid scripted scenario-toggle → checkout-navigation check timed out; its stable rerun was blocked when application network permission was revoked. Verify that flow manually during Phase 1; do not count it as a passing capture test. Synthetic browser QA is not real screen-sharing validation. A live Gemini synthetic-frame diagnostic has now passed after fixing the provider schema (see below); the actual recording-to-AI acceptance gate remains open. Cloud persistence remains unverified. No commit, push or deployment has been performed by this work.

## Gemini HTTP 400 fix — November 12

- The user reported `Gemini request failed (HTTP 400)`. A live model lookup and minimal text request succeeded with the existing local server configuration. Tiny synthetic requests reproduced `INVALID_ARGUMENT` with the provider schema's `maxItems: 50`; removing only that constraint succeeded.
- `server/analysis.server.ts` now omits provider `maxItems` while `aiReview.ts` retains the local Zod maximum of 50 findings and all evidence validation. Do not restore the rejected provider constraint without live compatibility verification.
- `server/geminiErrors.server.ts` classifies upstream status/reasons into fixed actionable hints for invalid inputs, API keys/restrictions, permissions, model access, size limits, quota and service availability. Never relay raw provider error bodies/messages: they may echo sensitive request data. There is no automatic retry/fallback.
- The actual `analyze()` module completed one live diagnostic using a synthetic blank JPEG, no user events, and no real recordings; it returned zero valid findings. Provider-reported usage was 1,405 input / 9 output / 1,414 total tokens, latency 1,553 ms. This result was not saved as research data. No key, `.env` or model change was needed.
- **User preference (standing):** the Gemini system instruction asks for **2–3 distinct findings per session**, ranked by confidence, including subtler friction (near-miss taps, retries, hesitation). It may still return fewer when evidence genuinely doesn't support more; do not weaken evidence validation to hit the count. One invalid finding still fails the whole run.
- Frame sampling prioritizes missed taps (`tap`/`pointer_down` with `hit: false`) and `backtrack` before spinner/error signals, and the prompt tells the model to map normalized tap x/y onto controls in nearby frames and to ignore waits that resolve in under ~2 s. This addressed the model defaulting to loading findings on small-button sessions; live detection quality is still unverified.
- Controlled checkout: healthy order placement resolves in ~600 ms; only the planted `silent_failure` scenario keeps the 4 s stall, so non-timeout sessions don't carry an unplanned long-spinner signal.
- Restart the dev server after pulling up the fix and retry the existing consented recording. A real recording → Gemini → reviewed finding still needs user acceptance; the synthetic diagnostic does not prove detection quality.

## Reliability, privacy and scope invariants

- `blindPayload` explicitly enumerates model inputs. Never include planted scenario configuration, ground truth, researcher decisions/notes/drafts, prior AI answers or researcher setup pixels. Events-only mode must have no frames/visual-input context.
- Unknown event IDs, invalid/out-of-range timestamps and malformed model output must be rejected rather than silently repaired into valid-looking evidence. Machine validation does not replace human verification of claims.
- Original model output and human interpretation stay separate. Do not fabricate usage, costs, statistical uplift, customer sessions or approved findings. Keep heuristic priority distinct from causal business impact.
- Record only consented sessions with explicit platform permission. No PostHog or third-party behavioral replay SDK. Never log form values, passwords, payment details or tokens. Historical cloud uploads require an explicit researcher action; recordings stay private.
- Reviewer edits must survive fast typing and refresh. Preserve queued writes, unsaved/error states and exports. Local deletion and shared deletion are separate.
- Known limits: unfinished recordings can be lost on crash/closure; sparse frames may miss brief failures; legacy uncropped recordings need a safe new recording for multimodal analysis; resizing invalidates the crop; API concurrency guards are per process; shared workspace access is a prototype rather than production individual identity.
- Keep business logic outside presentation so Katherine can iterate on UI. Verify real behavior, avoid unnecessary new services, and report untested acceptance honestly.

## Session close / resume checklist

- Update this handoff and the relevant phase-plan tasks only when acceptance evidence supports it.
- State which tests and browser flows actually ran, which used QA fixtures, and whether live inference/cloud/capture was verified.
- Leave the user's `.env`, real research data and existing working-tree changes intact. Never commit secrets or QA recordings.
- Stop only preview/browser processes created for your checks, unless the user asks to keep them running. Do not rely on `/tmp` scripts or screenshots surviving into a new session; durable behavior/checks are described in the repository docs.
- Do not commit/push/deploy without an applicable user request; never rewrite published Lovable history.

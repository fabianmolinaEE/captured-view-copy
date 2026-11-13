# LoopMate

Find friction that logs can't explain. A research prototype for **Record → Replay → Analyze → Review → Prioritize → Evaluate**. React 19, TypeScript, TanStack Start/Router, Vite and Tailwind remain in place. The existing dashboard and superhero mascot are preserved.

## Product direction from the November 12 team discussion

LoopMate's longer-term vision is **evidence → reviewed insights → approved experiments → reviewed code changes → measured rollouts**, combining internal recordings with external competitor research. The initial customer hypothesis is game studios and consumer app incubators that repeatedly launch and retire products; interviews should validate the problem and willingness to pay.

The home and primary navigation now organize LoopMate into **Insights**, **A/B Tests**, and **Rollouts**. Internal Insights shows real saved proposals, review-status filters and the existing Prioritized view. Each finding opens an evidence-focused detail page with safe Markdown, recording highlights, cited events, review controls and an editable next-step draft. **External**, **A/B Tests**, and **Rollouts** are explicit Coming Soon states; they contain no invented findings, running experiments or release metrics. Recordings, recording setup, evaluation and settings remain available under Research tools (in the top menu on mobile).

The interview priority remains a genuinely tested recording-to-insight-to-review flow. Approving a next-step draft saves research intent only; no experiment, repository write or deployment is triggered. Editing an approved title/scope or reopening/rejecting its finding returns the approval to draft.

Use [the prototype phase plan](docs/PROTOTYPE-PHASE-PLAN.md) as the authoritative feature tracker, including owners, the meeting's November 12–13 targets, acceptance criteria and unresolved decisions. [The roadmap](roadmap.md) provides a short overview. Meeting claims about competitors, Agentic Vision, supported video-link inputs and storage pricing remain hypotheses to verify; this documentation does not treat them as established facts.

## Local setup

Use Node **22.12+** and npm.

```sh
npm install
cp .env.example .env
# Edit .env locally: set GEMINI_API_KEY and optionally RESEARCH_ACCESS_TOKEN.
npm run dev
```

Open the Local URL printed by Vite. Desktop Chrome or Edge on localhost/HTTPS is recommended for explicit browser-tab capture. `npm run dev` and `npm run preview` load the ignored `.env` file into the **server process**, not browser code. Restart after changing it. Recording, replay, labels and review work without any external credentials.

Server variables:

| Variable                    | Purpose                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`            | Google Gemini API key; server only. Required for real inference.                                                                                                                                  |
| `GEMINI_MODEL`              | Model identifier; default `gemini-3.5-flash-lite`.                                                                                                                                                |
| `RESEARCH_ACCESS_TOKEN`     | Long random team workspace code; required for non-local research API requests. Enter this code, **never an API key**, in Settings. It remains in that tab's session storage until cleared/closed. |
| `SUPABASE_URL`              | Optional private shared-storage project URL.                                                                                                                                                      |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional backend credential; server only.                                                                                                                                                         |
| `RESEARCH_VIDEO_BUCKET`     | Private bucket, default `research-recordings`.                                                                                                                                                    |

For hosted use, set runtime secrets through Lovable. Do not prefix any secret with `VITE_`. The server entry accepts runtime environment bindings and falls back to the server process environment. Deploy on HTTPS; keep the existing hosting/framework configuration. No deployment or Git push is performed by this implementation.

The default model's image input and structured-output support were checked against [Google's model documentation](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite) on November 11, 2026. The integration uses the [Gemini generateContent REST API](https://aistudio.google.com/api-reference/generate-content), including JSON Schema output. Actual account access is verified by a real request; a configured key alone does not prove quota or model access. Override the identifier if your account requires another vision-capable model.

## Live demonstration

For the interview, prioritize steps 1–5: actual footage, actual Gemini output, evidence navigation and a persisted human decision. Cross-session evaluation is a deeper research demonstration. Existing persisted runs now appear as **Saved real analysis**, with model, input mode, date, latency and available usage on the detail page. A real demonstration dataset still needs to be recorded and analyzed. Prerecorded external-app analysis remains planned. No saved result is presented as a new live call.

1. In **Test App**, choose scenarios, use a neutral session title, and consent. Click **Share this tab & start recording** and choose this app's current tab. The capture stage keeps researcher scenario settings outside the checkout crop sent to AI. Keep the window size fixed.
2. Explore the checkout. Wait through loading, dismiss the returning modal, miss the small Checkout target, or submit a postal code other than `94107` to trigger silent rejection. `94107` lets you continue to the order-timeout scenario. Use made-up details only.
3. **Stop & save**, then refresh. Reopen the saved session and replay it. Click event timestamps to verify alignment. Adjust the video calibration offset if needed; analysis applies the same offset.
4. In **Settings**, enter your team workspace code if the server requires one. On the session page choose **Checkout video frames + events**, approve transmission to Google, and click **Analyze with AI**. Real proposals, model version, latency and reported tokens appear. Zero findings is a valid model outcome. Failed requests stay failed; no fixture findings appear in the product.
5. Open **Insights → Internal** and choose a finding (or follow its title from session review). Inspect the explanation beside the recording, play the bounded ~4-second highlight, and jump to cited events. Accept/reject the finding, add notes and set severity. Add a next-step title/scope and **Approve draft** after accepting the finding. Refresh to confirm persistence. Draft approval records a decision only. Previous model outputs and run history remain intact.
6. In **Observed issues**, mark each configured issue yes/no/unknown and add notes. Add an independent human issue if something else happened.
7. Repeat the experiment on three separately recorded sessions. Resolve all proposals in each latest multimodal run. **Insights → Prioritized** groups accepted findings by category + screen, counts distinct sessions and links back to recording timestamps. It shows an explicit triage heuristic, not measured causal impact.
8. Analyze each same session again with **Events-only baseline**. No frames, visual descriptions, scenario configuration, ground truth, or previous reviews are sent in that mode. Run order should be counterbalanced in a research study.
9. In **Evaluation**, select each mode. Verify proposal-to-ground-truth matches, explicitly verify unmatched proposals, judge video necessity, and judge whether evidence supports each proposal. The paired comparison uses only sessions with completed runs in both modes and withholds detection while proposal correctness is unresolved. No eligible labels means **Insufficient labeled data**.
10. Optionally use **Save shared copy**, with separate upload consent. Another browser can load the team list and import a private copy. Upload historical recordings only after explicit approval. Shared deletion and local deletion are separate controls.

JSON export preserves **all** proposals, labels, decisions and original model outputs for audit. Download the video separately; the JSON includes its expected filename. Neither export is silently uploaded.

## Existing optional backend setup through Lovable

The November 12 meeting prefers **Cloudflare R2 as the candidate for future video storage**, subject to verified costs and access design. R2 is not connected. The existing Supabase adapter below remains an optional implementation, not a requirement for the local interview demo or a settled long-term storage choice. R2 object storage would still need a separate decision for research metadata and identity; see Phase 5 of the [phase plan](docs/PROTOTYPE-PHASE-PLAN.md).

The optional Supabase adapter is implemented but **no database or bucket was provisioned by this work**. AGENTS.md reserves schema changes for Lovable; no migrations or generated database files were edited. Use the setup below only if the team chooses to enable that existing adapter.

Ask the [Lovable editor](https://lovable.dev/projects/163fbc3b-4a28-4987-a543-f87d44b66335) to perform this exact setup:

> Enable private Supabase research persistence. Create `public.research_sessions` with `id uuid primary key`, `title text not null`, `created_at timestamptz not null`, `updated_at timestamptz not null`, and `document jsonb not null`. Enable RLS with no anonymous or authenticated public-access policies; this prototype accesses the table only through its protected server using the service-role credential. Create a PRIVATE bucket `research-recordings`, allow video/webm and video/mp4 uploads, and cap object size at 25 MB. Do not add public object access policies. Store SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEARCH_VIDEO_BUCKET, GEMINI_API_KEY, GEMINI_MODEL, and a strong RESEARCH_ACCESS_TOKEN in server secrets/runtime bindings. Preserve the existing TanStack server entry and `/api/research/*` handling. Do not expose server credentials through VITE variables.

The JSON document contains recording metadata, events, all analysis runs, proposed findings, researcher decisions, human ground truth and verified matches. Video bytes live at `<session UUID>/recording` in the private bucket. The adapter checks bucket privacy before upload, proxies authenticated downloads, never returns a public/signed video URL, and uses `updated_at` optimistic concurrency to prevent overwriting another person's edits. Import the latest shared copy after exporting local work if a conflict occurs. It fetches up to 100 shared session summaries for this small research set.

Local saving remains automatic. Cloud upload/update is always explicit; local edits show **Local changes** until shared again. Full recordings may contain the researcher setup before capture stage settles; cloud upload consent covers the full recording, while AI receives checkout crops only. This is one trusted-team workspace with a shared access code, not production multi-tenant authentication.

## Checks and boundaries

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run preview
```

Tests cover capture timing/lifecycle, denied and wrong-tab permission, late cancellation, frame boundaries, sensitive metadata filtering, blind inputs, the events-only boundary, malformed model outputs and provider failures, review edits and remounting, real IndexedDB semantics with `fake-indexeddb`, private backend request contracts and conflicts, grouping, rare-blocker ranking, and evaluation denominators. Test model responses are mocks confined to `src/test`; they never populate product data or research statistics.

The initial production build passed. The initial TypeScript check had three errors; initial lint had 240 formatting errors. The implementation fixes those errors and formats the research and route files to project conventions. See [the implementation report](docs/IMPLEMENTATION.md) for final check results and verification limits.

## Engineering and UI handoff

See [the UX implementation checkpoint](docs/UX-IMPLEMENTATION.md), [architecture and component interfaces](docs/ARCHITECTURE.md) and [manual acceptance checks](docs/MANUAL-VERIFICATION.md). Katherine can change the existing research components, reusable UI components and styles without changing the capture, inference, persistence, aggregation or scoring modules.

Katherine's meeting responsibilities include customer interviews and the pitch deck; Maria Emilia owns competitor-slide research; Fabian owns prototype readiness and the real Gemini demonstration. Additional engineering owners and post-interview dates remain unassigned in the phase plan. The visual direction now builds on the mascot and navy/gold foundation with violet, aqua and peach accents, glass surfaces and an animated closed-loop illustration. Motion can be paused from the header and follows system reduced-motion settings. The historical browser database identifier is retained so existing local recordings remain accessible; new downloads use the `loopmate-` filename prefix.

New dependencies: `@fix-webm-duration/fix` repairs missing recording duration metadata; `react-markdown` renders model text with HTML, remote images and links excluded; `fake-indexeddb` is test-only. No analytics/replay SDK, PostHog, new backend SDK, framework migration, or generated AI data was added. Existing `zod` validates the analysis protocol; server calls use native `fetch`.

Known prototype limits: full browser closure/crash can lose an unfinished in-memory recording; sparse frames can miss short failures; legacy recordings without a safe crop require a new recording for multimodal analysis; resizing invalidates the crop and stops capture; local deletion does not delete a shared copy; upload limit is 25 MB; API concurrency guards are per browser/process rather than distributed; shared workspace codes are not individual accounts. Use short consented recordings and explicit Stop & save before leaving the page.

## Closed-loop visual direction

For future-session continuity, start with [AGENTS.md](AGENTS.md), which records the current implementation, verification limits and next acceptance task.

The home centers the message **“From zero to hero. One loop at a time.”** A luminous infinity path, floating superhero and translucent panels introduce Discover → Test → Grow. The selector explains the product vision; planned experiments/rollouts are labeled, and the illustration is not a live agent or execution indicator. All research screens share the continuous purple/navy canvas with readable dark controls and translucent accents; the controlled checkout alone retains its light storefront palette.

Decorative motion uses CSS without a new animation dependency. **Pause motion** in the header persists across navigation/reloads; system reduced motion always disables animation. Recording setup does not receive route-entry motion, so its capture geometry stays stable.

## Gemini request troubleshooting

The November 12 fix removes a provider `maxItems: 50` schema constraint that reproduced HTTP 400 / INVALID_ARGUMENT with the configured Flash-Lite model. The server still enforces the 50-finding limit through Zod; evidence validation remains intact. If upgrading an already-running local app, restart `npm run dev` and retry the saved recording. No new key or model change was needed for this fix.

Provider failures now distinguish invalid request/input, API-key/restriction issues, unavailable models, rate/quota limits and service failures. Only fixed safe diagnostic hints reach the browser; upstream messages and request data are not forwarded. A live synthetic-frame request through the fixed module passed; a real consented recording is still needed for the interview acceptance gate.

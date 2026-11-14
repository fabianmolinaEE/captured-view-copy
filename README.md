# LoopMate

An automated product-improvement loop. Agents watch recordings of a product, find **improvements** (UX, UI, layout, button size and target area, copy, discoverability, effort, feedback, trust, engagement; bug fixes are one part), back each insight with playable evidence highlights and propose an A/B test. Approved tests go to an experiment agent that builds the variant, records it and reports user-experience deltas; a PR agent turns supported variants into pull requests on Rollouts. React 19, TypeScript, TanStack Start/Router, Vite and Tailwind.

**[docs/AUTOMATED-LOOP.md](docs/AUTOMATED-LOOP.md) is the canonical vision and per-stage status.**

## The loop and where humans fit

Collection agent → insight agent (Gemini video) → evidence highlights + suggested A/B test → **human insight review** → experiment agent → deltas → PR agent → **human merge on Rollouts**.

Humans do three things only: review insights with their highlights; approve, edit or reject the suggested A/B test; merge or decline the resulting PR. Manual recording, the Analyze button, Evaluation and ground-truth labelling are diagnostic research tools (under Research tools; in the header menu on mobile), not the operating workflow.

## What is real in the prototype

- **Four scouts:** Tracker (blue) and Explorer (green) find what to improve; Fixer (orange) and Experimenter (purple) change the product. Each has its own mascot and can be turned on/off and tuned in Settings → Scouts.
- **Real:** the Gemini insight analysis with an improvement-focused prompt (server-side, strict validation), model-suggested A/B tests and fix/experiment routes with human approve/edit/reject, timestamped evidence highlights on local video or the in-page YouTube embed, human accept/reject/notes/severity, focus areas, confidence threshold and a daily analysis cap. One live Gemini public-video call passed on Nov 13; in-page YouTube playback is mock-tested only.
- **Navigation:** HQ, Insights, A/B Tests, Rollouts. Hero names (Tracker, Explorer, Experimenter, Fixer) are internal labels. HQ shows insights that need you (left) and agent activity tiles (right).
- **Unified Insights:** own-product (Tracker) and DoorDash competitor (Explorer) insights in one list, no thumbnails, each with a source marker (Tracker, Explorer or Both) and "from N videos". Competitor footage stays out of own-product metrics. The "Order again on the home screen" insight is a fictional sample badged "Simulated demo".
- **Simulated (labeled):** approving a test starts a client-side simulated Experimenter run that ends in illustrative "not measured" deltas and a simulated PR on Rollouts; approving a fix sends it to the simulated Fixer, which produces a simulated fix PR. Every such record carries a visible "Simulated demo" badge, is stored apart from research data, is excluded from metrics and can be reset in Settings. No real experiment, repository write, deployment or network call happens.
- **Not connected:** the collection runner, real experiment agent, measured deltas, PR agent and repository connection.

## Products

- **Uber Eats** — public YouTube walkthroughs (third-party footage, attributed; Uber is not a customer). Named demo for **Sunday, November 15, 2026**.
- **Bag Checkout App** — our controlled checkout fixture with consented screen recordings and semantic events. Legacy `Carry checkout` recordings are recognized without rewriting them.

Miso food delivery is archived: it is not a product and is not shown in the UI. Its old local recordings are left untouched. Home opens unscoped with an overview Across your products; Insights, Recordings, Evaluation and recording setup use the product buttons above the page. The choice is per browser tab and is a view filter, not a tenant boundary.

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

## Sunday demo script (Uber Eats)

Six-step happy path; exact clicks and the pre-demo checklist are in [UBER-EATS-DEMO.md](docs/UBER-EATS-DEMO.md). Start at `/hq`. Implemented and tested with mocks; not yet checked in a real browser by an agent, so rehearse it first.

1. **HQ:** insights that need you, agent tiles and usage.
2. **Insights:** Tracker and Explorer insights together, with source markers and video counts.
3. Open **Order again on the home screen** (sample, source Both: your users hunt for last week's order; DoorDash puts it on the home screen).
4. **Approve test** (20% traffic), then **Follow it in A/B Tests** and watch the simulated run.
5. **Review PR** on Rollouts: files changed, analytics, deltas.
6. **Merge:** the hero flies across the screen.

The bug-GIF slide from Bag Checkout recordings is made outside the app.

## Bag Checkout App walkthrough (diagnostic)

1. Select **Bag Checkout App → Record a session**. Choose scenarios, use a neutral title, consent, then **Share this tab & start recording** and pick this tab. Keep the window size fixed; scenario settings stay outside the crop sent to AI.
2. Explore the checkout with made-up details: wait through loading, dismiss the returning modal, miss the small Checkout target, or submit a postal code other than `94107` for silent rejection (`94107` continues to the order-timeout scenario).
3. **Stop & save**, refresh, replay and check event timestamps against the video (adjust calibration offset if needed).
4. In **Settings**, enter the team workspace code if required. On the session page choose **Checkout video frames + events**, approve transmission to Google and click **Analyze with AI**. Model, latency and reported tokens are shown.
5. Review findings in **Insights** as above. Optionally use **Events-only baseline** and **Evaluation** for paired quality checks against independent ground truth; no eligible labels shows **Insufficient labeled data**.

JSON export preserves all proposals, labels, decisions and original model outputs. Video downloads are separate; nothing is uploaded silently.

## Gemini request troubleshooting

The November 12 fix removes a provider `maxItems: 50` schema constraint that reproduced HTTP 400 / INVALID_ARGUMENT with the configured Flash-Lite model. The server still enforces the 50-finding limit through Zod; evidence validation remains intact. If upgrading an already-running local app, restart `npm run dev` and retry the saved recording. No new key or model change was needed for this fix.

Provider failures now distinguish invalid request/input, API-key/restriction issues, unavailable models, rate/quota limits and service failures. Only fixed safe diagnostic hints reach the browser; upstream messages and request data are not forwarded. A live synthetic-frame request through the fixed module passed; the user subsequently reported the basic recording/analysis flow working. Scenario coverage and detection quality remain acceptance tasks.

## Optional shared storage

The Supabase REST adapter is implemented but **no database or bucket has been provisioned**, and cloud behavior is unverified. Cloudflare R2 is a future video-storage candidate, not connected. Schema changes belong to Lovable (see AGENTS.md). If the team enables the adapter, ask the [Lovable editor](https://lovable.dev/projects/163fbc3b-4a28-4987-a543-f87d44b66335) to:

> Enable private Supabase research persistence. Create `public.research_sessions` with `id uuid primary key`, `title text not null`, `created_at timestamptz not null`, `updated_at timestamptz not null`, and `document jsonb not null`. Enable RLS with no anonymous or authenticated public-access policies; this prototype accesses the table only through its protected server using the service-role credential. Create a PRIVATE bucket `research-recordings`, allow video/webm and video/mp4 uploads, and cap object size at 25 MB. Do not add public object access policies. Store SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEARCH_VIDEO_BUCKET, GEMINI_API_KEY, GEMINI_MODEL, and a strong RESEARCH_ACCESS_TOKEN in server secrets/runtime bindings. Preserve the existing TanStack server entry and `/api/research/*` handling. Do not expose server credentials through VITE variables.

Video bytes live at `<session UUID>/recording` in the private bucket; downloads are proxied and never use public/signed URLs; `updated_at` optimistic concurrency prevents overwrites. Upload is always explicit. Public-video references have no cloud upload. This is one trusted-team workspace with a shared code, not production authentication.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Tests cover capture lifecycle, permission handling, frame boundaries, blind inputs, the events-only and public-video boundaries, malformed model output and provider failures, review persistence, IndexedDB semantics with `fake-indexeddb`, backend contracts, product scoping and evaluation denominators. Model and YouTube player responses in tests are mocks confined to `src/test`. Current counts are recorded in [AGENTS.md](AGENTS.md).

## Design and handoff

The home headline is **“From zero to hero. One loop at a time.”** with the superhero mascot and animated infinity loop. All pages share the continuous purple/navy `data-theme="loop"` canvas; only the controlled checkout inside `.phone` keeps its light storefront palette. **Pause motion** in the header persists; system reduced motion always wins.

Business logic lives in `src/lib/research/` so Katherine can iterate on the UI components and styles independently. See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [UX-IMPLEMENTATION.md](docs/UX-IMPLEMENTATION.md), [MANUAL-VERIFICATION.md](docs/MANUAL-VERIFICATION.md) and [the phase plan](docs/PROTOTYPE-PHASE-PLAN.md). Start a new agent session from [AGENTS.md](AGENTS.md).

Dependencies of note: `@fix-webm-duration/fix` (recording duration metadata), `react-markdown` (model text with HTML, remote images and links excluded), `fake-indexeddb` (tests only). No analytics/replay SDK or PostHog.

Known limits: a crash can lose an unfinished recording; sparse frames can miss short failures; legacy uncropped recordings need a new recording for multimodal analysis; resizing temporarily invalidates the crop; concurrency guards are per process; upload limit is 25 MB.

# LoopMate — Roadmap

Updated from the November 12, 2026 team discussion. The full task tracker, owners, dependencies and acceptance criteria live in [the prototype phase plan](docs/PROTOTYPE-PHASE-PLAN.md). Current implementation evidence is recorded separately in [the implementation report](docs/IMPLEMENTATION.md); code availability is not live acceptance.

## Interview priorities — November 12–13

- [ ] Verify the existing consented recording → Gemini insight → timestamped evidence → human review flow on the demo laptop. Preserve the checkout, event capture, local persistence and evaluation foundation.
- [ ] Verify the proposed Agentic Vision and recording-input options; retain the current frame pipeline if alternate inputs are unsupported. Show actual reported usage rather than invented costs.
- [ ] Add and identify a saved real analysis fallback. Never present it as a fresh model call.
- [x] Present the Insights / A/B Tests / Rollouts vision, Internal / External sources and evidence panel. [UX acceptance evidence](docs/UX-IMPLEMENTATION.md). Label future-state pages and synthetic activity explicitly; isolate them from real research data.
- [ ] Consider prerecorded external-app analysis as stretch work after the internal real demo passes.
- [ ] Complete Katherine's customer-interview/deck work, Maria Emilia's verified competitor comparison, and Fabian's second-laptop demo rehearsal. Distinguish hypotheses from demonstrated advantages.

## After prototype validation

- [ ] Evaluate private Cloudflare R2 video storage against the existing optional Supabase adapter; decide metadata storage separately and preserve local fallback. Provision through Lovable where required.
- [ ] Add real jobs, schedules, credit budgets and additional server-side model providers.
- [ ] Design consented continuous sampling and web integrations before promising always-on or native-mobile collection.
- [ ] Implement editable, human-approved experiment proposals, participant allocation and real A/B comparisons through a selected integration.
- [ ] Add scoped repository inspection and authorized, tested PR generation, followed by separately approved rollouts and actual outcome tracking.
- [ ] Research the feasibility of synthetic competitor-app agents, including non-happy paths and time-gated content, before committing to autonomous coverage.

The initial customer hypothesis is game studios and consumer app incubators. Use customer interviews and paired video-versus-events evaluation to revise priorities after the November 13 pitch. No production experimentation, deployment, billing or autonomous-agent capability is implied by this roadmap.

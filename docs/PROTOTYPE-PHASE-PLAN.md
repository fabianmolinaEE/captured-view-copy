# LoopMate — Prototype Phases and Progress Tracker

**Planning date:** November 12, 2026 · America/Los_Angeles  
**Source:** Team discussion supplied by Fabian; [meeting transcript reference](https://notes.granola.ai/t/801c29a0-b202-41cb-92dd-4754f62deb0b). This plan uses the pasted discussion, not an independently verified transcript.  
**Scope:** Planning and tracking only. No application features are implemented by this document.

**Product name:** LoopMate. Use this name in the app, deck, customer-facing materials and new documentation. The name update does not mark any planned feature as accepted; the existing superhero mascot and professional visual direction remain.

## 1. Goal and scope

Show the long-term loop clearly while proving one real component:

**Consented recordings → AI insights with evidence → ranked opportunities → human review → approved experiments → reviewed code changes → measured rollouts.**

For the interview, the minimum is a genuinely tested **recording-to-insight-to-review** experience. A/B Tests, Rollouts, autonomous agents, production integrations, billing, and continuous collection can remain clearly labeled previews. Do not expand tonight's critical path to include the whole loop.

The initial customer hypothesis is **game studios and consumer app incubators that repeatedly launch, evaluate, and retire products**. Competitor analysis for companies with sparse internal user data is a secondary hypothesis. Customer interviews should test these assumptions before they become product commitments.

## 2. How to use this tracker

- **Priority:** P0 = interview requirement; P1 = interview stretch; P2 = after prototype validation; P3 = exploratory or later.
- **Task status:** unchecked = not accepted yet; checked = acceptance evidence is linked. Existing code alone does not close a task.
- **Phase status:** Planned / In progress / Blocked / Accepted / Deferred. Record the actual blocker when using Blocked.
- **Owner:** named owners come from the meeting. `TBD` means the team still needs to assign someone.
- **Evidence:** link the PR, recording, real model output, screenshot, test result, or interview notes that prove completion. Keep private recordings and credentials out of this document.
- **Dates:** November 12–13 deadlines below come from the meeting. Later phases have no committed dates.

| Phase | Outcome                                           | Priority | Owner                               | Target                               | Status      | Evidence / blocker                                                |
| ----- | ------------------------------------------------- | -------- | ----------------------------------- | ------------------------------------ | ----------- | ----------------------------------------------------------------- |
| 0     | Confirm baseline and interview scope              | P0       | Fabian; team decisions              | Nov 12                               | Planned     | —                                                                 |
| 1     | Prove real recording → AI → review                | P0       | Fabian                              | Nov 12                               | Planned     | Live verification outstanding in prior report                     |
| 2     | Present the product vision honestly               | P0 / P1  | Fabian; Katherine for design        | Nov 12                               | In progress | [UX checkpoint](UX-IMPLEMENTATION.md); optional previews deferred |
| 3     | Analyze prerecorded external app sessions         | P1       | Fabian; external research owner TBD | Interview stretch                    | Planned     | Input suitability and model support to validate                   |
| 4     | Validate thesis, customer and pitch               | P0       | Katherine, Maria Emilia, Fabian     | Nov 12–13; research continues        | Planned     | Unverified competitive/API claims                                 |
| 5     | Add private shared persistence with R2 evaluation | P2       | Engineering owner TBD               | After interview                      | Planned     | Storage decision and provisioning                                 |
| 6     | Add real jobs, budgets and consented sampling     | P2       | Engineering / product owners TBD    | After Phase 5                        | Planned     | Identity, job execution and capture integration                   |
| 7     | Run human-approved experiments                    | P2       | Product / engineering owners TBD    | After Phase 6                        | Planned     | Experiment integration and participant allocation                 |
| 8     | Generate reviewed PRs and track rollouts          | P3       | Engineering owner TBD               | After experiment contract is defined | Planned     | Repository and release integrations                               |
| 9     | Explore competitor apps with synthetic agents     | P3       | Research / engineering owners TBD   | Feasibility gated                    | Planned     | Early feasibility research in Phase 4                             |

## 3. Existing baseline — reuse before adding

This inventory comes from the repository's [implementation report](IMPLEMENTATION.md), dated November 11. It is not a new live acceptance run. The report records 30 passing tests, a passing typecheck/build, and lint with no errors; browser recording, live Gemini inference and cloud persistence remained unverified at that checkpoint.

| Area               | Existing implementation                                                                                              | What still needs proving or extending                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Capture and replay | Permissioned browser-tab recording, checkout scenarios, timestamped events, IndexedDB, seeking, downloads and export | Real recording → refresh → replay on the interview browser                                 |
| AI                 | Server-side Gemini, sampled checkout frames + events, structured findings, usage fields and saved runs               | Real provider call; evaluate proposed native-video / Agentic Vision / link-input paths     |
| Review             | Accept/reject, notes, severity, run history and preserved original output                                            | Verify real model findings through the full flow; add editable proposed actions later      |
| Prioritization     | Cross-session accepted-finding groups and an explicit heuristic                                                      | Validate grouping; avoid presenting heuristic scores as predicted causal impact            |
| Evaluation         | Ground truth, verified matches and paired events-only comparison                                                     | Collect actual recordings and independent human labels                                     |
| Shared storage     | Optional private Supabase adapter and conflict protection                                                            | Provisioning unverified; R2 is a new preference to evaluate, not an existing integration   |
| Presentation       | Existing dashboard, mascot, sessions, review, insights, evaluation and settings                                      | New three-bucket home, Internal/External organization, evidence layout and vision previews |
| Future execution   | No production experiment, repository-write, rollout or autonomous competitor-agent implementation                    | Separate future phases; previews must not imply these systems run                          |

## 4. Phase 0 — Lock the baseline and demo contract

**Priority:** P0 · **Owner:** Fabian; decisions with the team · **Target:** November 12  
**Depends on:** None

- [ ] **0.1** Walk through the current app and mark existing functionality as code-only, live verified, or needing repair.
- [ ] **0.2** Choose one reliable internal example, such as the bag checkout, with synthetic information and consented footage.
- [ ] **0.3** Agree on the minimum interview story: real footage, actual model output, supporting timestamps, human review, and honest cost/usage visibility.
- [ ] **0.4** Keep existing recording, review, aggregation and evaluation modules; avoid a framework or dashboard rewrite.
- [ ] **0.5** Decide whether external analysis is an interview stretch or a later milestone. Do not let it block the internal demo.
- [ ] **0.6** Confirm the preferred demo mode: live analysis plus a clearly labeled saved real analysis as a fallback.
- [ ] **0.7** Confirm that advanced A/B, rollout and agent activity screens are previews until their execution phases are accepted.

**Exit criterion:** The team can point to exactly what will be real, saved from a real run, synthetic, or unavailable during the interview.

**Evidence / decisions:** _TBD_

## 5. Phase 1 — Validate real insight generation

**Priority:** P0 · **Owner:** Fabian · **Target:** November 12  
**Depends on:** Phase 0

- [ ] **1.1** Configure server-side Gemini access and verify an account-accessible model and its actual capabilities. Never place provider keys in browser code or recordings.
- [ ] **1.2** Verify what the meeting calls “Gemini Agentic Vision”: API/product name, availability, supported model, tool behavior, and whether it improves the existing inference path. Do not assume it is a drop-in endpoint.
- [ ] **1.3** Test candidate recording inputs separately: existing sampled frames, direct video upload if supported, a YouTube URL if supported, and a private Google Drive source if supported. Record actual successes, failures, privacy implications and latency. Do not make private footage public to satisfy a URL-input demo.
- [ ] **1.4** Retain the existing frame pipeline if alternative inputs are unsupported or add unnecessary risk to the interview.
- [ ] **1.5** Record the internal example, generate events, stop, refresh, reopen, replay and check timestamp alignment.
- [ ] **1.6** Run actual inference and inspect proposed qualitative issues against the footage. Distinguish visible observations, interpretations, measured event counts and unsupported predictions.
- [ ] **1.7** Preserve the blind-input boundary: no planted scenarios, researcher labels, review decisions or researcher setup in model inputs.
- [ ] **1.8** Save a real analysis artifact with recording reference, model/version, input mode, date, timestamps, original output, reported token usage and latency. Save a readable Markdown/text version and structured JSON for UI reuse and audit.
- [ ] **1.9** Surface saved output as **“Saved real analysis”**, including its provenance. A cached result must not appear to be a fresh live call.
- [ ] **1.10** Verify finding → evidence timestamp → accept/reject → note → refresh persistence. Preserve the AI's original claim when a researcher edits their interpretation.
- [ ] **1.11** Verify permission cancellation, missing-key/API failure, malformed output and no-findings states. Never replace a failed call with invented findings.
- [ ] **1.12** Display only provider-reported usage. Show cost as unavailable unless it can be calculated from verified pricing and the applicable usage breakdown; distinguish estimates from billed amounts.

**Exit criterion:** On the interview machine, a consented real recording produces actual evidence-backed model output that can be replayed, reviewed and reopened. A saved real run provides an honest fallback.

**Evidence / actual model / selected input path:** _TBD_

## 6. Phase 2 — Build the interview experience and vision previews

**Priority:** P0 for clarity; P1 for visual polish · **Owners:** Fabian; Katherine for UI/UX  
**Target:** November 12 · **Depends on:** Phase 1 for real insights; preview work can proceed independently

### Home and navigation

- [x] **2.1** Add the home concept with the existing superhero, a sideways-flying pose if useful, and three clickable cards: **Insights**, **A/B Tests**, **Rollouts**.
- [x] **2.2** Give each card a short explanation and hover/focus entry point; make the same actions usable on touch and keyboard.
- [x] **2.3** Make those three areas the primary navigation while retaining clear access to recording, sessions, evaluation and settings.
- [x] **2.4** Split Insights into **Internal** and **External**. Keep their sources and research claims distinct.

### Insight detail and review

- [x] **2.5** Present readable model-generated Markdown in the center and an evidence panel on the right, with a stacked layout on smaller screens.
- [x] **2.6** Show rows of insights, linked events, key moments and timestamp navigation. Handle recordings with no accompanying event logs explicitly.
- [x] **2.7** Add approximately four-second highlight playback around a finding, clamped to recording boundaries and preserving the original timestamp. A playback range is sufficient initially; exported clips can follow later.
- [x] **2.8** Reuse accepted-finding grouping and ranking. Label impact estimates as heuristics; do not display invented conversion, revenue or performance deltas.
- [x] **2.9** Add a distinct proposed-action draft that humans can edit, approve or disapprove without modifying the source finding. For the interview, approval can save a decision without executing anything.

### Activity and future-state previews

- [ ] **2.10** Show real activity from actual analysis jobs where available. Otherwise label any example agent count, task, recording count, credit usage or experiment count **“Synthetic demo activity — no agents running.”**
- [ ] **2.11** Make synthetic activity an explicit demo state, separated from real counters, saved research, evaluation and usage records. An empty real workspace should remain empty.
- [x] **2.12** Add A/B Tests and Rollouts pages with **Coming Soon** or unmistakably labeled synthetic examples. Preview group comparisons and rollout deltas without implying real experiments or deployments occurred.
- [ ] **2.13** Preview model choice, frequency and credit allocation controls only where their unavailable behavior is clearly indicated. Gemini remains the real connected provider until others are implemented.
- [x] **2.14** Preserve the professional blue/navy palette, restrained gold accents, reusable components and existing mascot.

**Exit criterion:** An evaluator can navigate the three-bucket vision and distinguish real analysis, saved real results, synthetic previews and unavailable actions without explanation from the presenter.

**Evidence / design decisions:** [November 12 UX checkpoint](UX-IMPLEMENTATION.md). Unit/component tests and isolated Chrome desktop/mobile checks cover navigation, real-data loading, safe Markdown, highlight playback, draft review and reload persistence. External analysis and agent/settings previews remain open. Browser QA fixtures were isolated and cleared; this does not close the real-inference acceptance gate.

## 7. Phase 3 — External insights from prerecorded competitor sessions

**Priority:** P1 · **Owner:** Fabian; external research owner TBD · **Target:** Interview stretch  
**Depends on:** Phase 1; Internal/External source distinction in Phase 2

- [ ] **3.1** Select a suitable competitor-app recording captured by the team or otherwise available for this research use. Record app/version, platform, capture date, task and source provenance.
- [ ] **3.2** Analyze it through the validated video path. Reuse the core evidence pipeline with external-specific context rather than pretending it has internal event logs.
- [ ] **3.3** Save and display actual external findings with timestamps and playable evidence, clearly separated from internal sessions and their metrics.
- [ ] **3.4** Support a human-reviewed idea informed by external evidence plus internal observations, with links back to both sources.
- [ ] **3.5** Describe external suggestions as hypotheses to test in the customer's context, not proven improvements or access to the competitor's private analytics.
- [ ] **3.6** Keep customer datasets isolated. Do not use another customer's private analytics as competitor input.
- [ ] **3.7** Label prerecorded external analysis accurately: it is not evidence that autonomous competitor exploration already exists.

**Exit criterion:** One real external recording yields a reviewable external insight and a clearly sourced test idea. Autonomous exploration is not required.

**Evidence / chosen app and source:** _TBD_

## 8. Phase 4 — Validate the thesis, customer and pitch

**Priority:** P0 for interview preparation; continuing research afterward  
**Owners:** Katherine — interviews/deck; Maria Emilia — competitor slide; Fabian — prototype/demo  
**Dates from meeting:** First deck draft November 12; customer interviews and pitch deadline November 13

### Customer and positioning work

- [ ] **4.1** Katherine: interview product teams about their existing improvement loop before presenting the solution. Probe how they iterate, catch small bugs and discover issues late.
- [ ] **4.2** Avoid promising prototype access or steering participants toward video/AI as the answer. Store evidence, role and current workflow separately from team interpretation.
- [ ] **4.3** Test willingness to pay and workflow fit with game studios and consumer app incubators. Assess the sparse-data/competitor-analysis angle separately.
- [ ] **4.4** Map the current multi-tool workflow, handoffs and approval steps. Test whether centralization actually saves work instead of assuming “one button” is inherently valuable.
- [ ] **4.5** Maria Emilia: validate current PostHog and adjacent product capabilities from primary sources. Check reconstruction/video/mobile support, code-change boundaries, integrations and experiment coverage before claiming gaps.
- [ ] **4.6** Treat the meeting's release dates, market-share percentages, market-absence claims and competitor incentives as unverified claims or hypotheses. Keep an evidence/source/date log for the pitch.
- [ ] **4.7** Prepare answers to “Why can't PostHog add this?” and “Why rebuild steps competitors already do well?” Distinguish proven capability from a defensibility hypothesis.
- [ ] **4.8** Research a defensible example of a company winning by connecting a full workflow. Evaluate the Shopify/Amazon suggestions rather than adopting the analogy uncritically.
- [ ] **4.9** Begin competitor-agent feasibility research: permitted test environments, access constraints, time-gated content and whether synthetic exploration adds evidence beyond screenshot libraries. Record a go/no-go recommendation for Phase 9.

### Video value, measurement and pricing

- [ ] **4.10** Curate real cases where visual evidence may add value: clipped text, broken layouts/form factors, canvas/non-DOM interfaces and visible feedback failures. Treat mobile examples as research demonstrations until native collection exists.
- [ ] **4.11** Compare events-only and video-plus-events on the same internally recorded sessions with independently labeled ground truth and verified matches. Do not substitute a convincing anecdote for a measured comparison.
- [ ] **4.12** Record incremental correct findings, false-positive share, evidence quality, latency and reliable API usage/cost. Show insufficient data when labels or samples are incomplete.
- [ ] **4.13** Collect actual customer tool-spend examples and compare equivalent scope against a clearly labeled LoopMate cost hypothesis. Do not invent savings or willingness-to-pay figures.
- [ ] **4.14** Verify the R2-versus-Supabase pricing assumptions with current documentation and expected upload, retrieval, storage and request patterns before deciding on economics.

### Pitch and demo delivery

- [ ] **4.15** Katherine: prepare the first presentable deck draft on November 12; prepare the application deck for November 13. Confirm the application requirements: meeting notes specify four mandatory slides, with up to five for the three-minute live pitch.
- [ ] **4.16** Maria Emilia: produce the competitor petal chart, approximately five areas, or a clearer capability matrix. Mark roadmap capabilities as future rather than current advantages.
- [ ] **4.17** Fabian: rehearse the real demo on the second laptop, including permissions, credentials, network access and the saved-real-result fallback.
- [ ] **4.18** Rehearse the full three-minute story: target customer, specific friction evidence, human review, why video, and the future approved-execution loop.

**Exit criterion:** The team has a rehearsed real demo, an evidence-qualified competitor narrative, a presentable deck and customer interview notes that can change the roadmap.

**Evidence / interview findings / changes to priorities:** _TBD_

## 9. Phase 5 — Private shared persistence and the R2 decision

**Priority:** P2 · **Owner:** Engineering TBD · **Target:** After interview  
**Depends on:** Validated recording and analysis contracts; storage decision from Phase 4

- [ ] **5.1** Document the storage decision: R2 is the team's preferred candidate for video. Compare it with the existing optional Supabase adapter; retain local IndexedDB fallback.
- [ ] **5.2** Decide where structured research metadata lives independently of video objects. R2 video storage does not by itself replace the database, identity or authorization layer.
- [ ] **5.3** Provision private storage, server-only credentials/bindings and protected upload/download paths. Follow Lovable-managed schema and secret rules; do not hand-edit migrations or generated files.
- [ ] **5.4** Persist recording references, events, insight runs, human notes/decisions, evaluation labels and Internal/External source metadata with stable IDs.
- [ ] **5.5** Require explicit upload approval, show local/shared/sync state, and provide independent cloud/local deletion. Do not silently migrate historical footage.
- [ ] **5.6** Add team-scoped authorization, retention rules, import/update conflict handling and safe playback access.
- [ ] **5.7** Test cross-browser retrieval, failed upload/retry, unauthorized access, deletion and realistic video sizes/retrieval costs.

**Exit criterion:** A permitted teammate can reopen the same private recording and research document in another browser; unauthorized access and unintended uploads fail.

**Evidence / architecture decision:** _TBD_

## 10. Phase 6 — Real agent operations, budgets and consented collection

**Priority:** P2 · **Owners:** Product / engineering TBD  
**Depends on:** Phase 5 and an explicit customer capture-integration design

- [ ] **6.1** Define actual background job types, queue states, retries, cancellation and audit records. Replace synthetic activity with real job telemetry.
- [ ] **6.2** Implement frequency controls, scheduled runs, pause/resume, run history and notifications without claiming work runs before a scheduler exists.
- [ ] **6.3** Implement allocation settings with the meeting's example defaults: 70% finding improvements, 15% A/B testing, 15% competitor analysis. Validate totals; unavailable capabilities must not consume allocations.
- [ ] **6.4** Define the meaning of credits, provider usage accounting, hard spending limits, exhaustion behavior and budget enforcement. Keep billing/subscriptions a separate optional milestone, not a prerequisite for an honest prototype.
- [ ] **6.5** Add a server-side provider/model interface, then evaluate additional providers such as Claude. Store credentials through supported secret handling; never retain a provider key in client state or display its value back.
- [ ] **6.6** Design consent, eligible participants, sensitive-screen exclusions, revocation, retention and sampling policy before customer recording integration.
- [ ] **6.7** Retain on-demand feature studies. Add continuous sampling only for eligible, consented participants within supported browser/OS permissions; browser-tab capture does not silently become always-on collection.
- [ ] **6.8** Implement and audit cohort invitations and capture quotas, such as selecting 50 from 1,000 eligible willing participants. Show invited, consented and actually recorded counts separately.
- [ ] **6.9** Define the web integration first. Make native mobile, Flutter, React Native, games and canvas capture an explicit feasibility/coverage track; do not imply support from the web prototype alone.
- [ ] **6.10** Decide which analytics integrations are needed first, including Amplitude, custom event sources and experimentation platforms. Preserve event provenance; recordings-first scope can defer connectors without removing existing events-only evaluation.

**Exit criterion:** Real jobs run on a defined schedule within measurable budgets; recording collection respects participant consent and supported platform permissions, and dashboard counters reflect actual work.

**Evidence / supported capture environment / provider decisions:** _TBD_

## 11. Phase 7 — Human-approved A/B experiments

**Priority:** P2 · **Owners:** Product / engineering TBD  
**Depends on:** Phase 6; a chosen experiment/feature-delivery integration

- [ ] **7.1** Generate experiment drafts from reviewed insights with the hypothesis, editable feature scope, expected mechanism, eligibility, variants, metrics, duration, budget and stop rules.
- [ ] **7.2** Add edit, approve and disapprove actions. Approving an insight must not automatically authorize a code change, participant exposure or rollout.
- [ ] **7.3** Choose an existing experimentation integration or define a small controlled study. Establish who provides variants and how participants are exposed before promising automated execution.
- [ ] **7.4** Implement stable Group A/B assignment and participant consent/visibility, including allocation records and a way to pause or stop.
- [ ] **7.5** Gather permitted recordings by group, compare qualitative evidence and actual metrics, and show counts, uncertainty and inconclusive results.
- [ ] **7.6** Replace the A/B Tests preview with approved/running/paused/completed states, group comparisons, evidence links and a human decision record.
- [ ] **7.7** Test rejected, edited-after-approval, cancelled, insufficient-participant and budget-exhausted experiments. Changes to approved scope require a new decision.

**Exit criterion:** An approved experiment can run in a defined supported environment, with real allocation and outcome data; unapproved changes cannot reach participants.

**Evidence / experiment integration / sample requirements:** _TBD_

## 12. Phase 8 — Repository integration, PR generation and rollouts

**Priority:** P3 · **Owner:** Engineering TBD  
**Depends on:** Defined action approvals, scoped repository access, experiment variant delivery and deployment boundaries

- [ ] **8.1** Choose one source-control provider for the initial integration based on customer need. Track GitHub, GitLab and Perforce separately rather than assuming identical APIs or workflows.
- [ ] **8.2** Define the connector/MCP tool contract and the provider's actual authentication method, repository scope and read/write permissions. MCP is not a substitute for source-control authorization.
- [ ] **8.3** Begin with approved, read-only code inspection and an evidence-linked change proposal.
- [ ] **8.4** Require explicit approval of the proposed change scope before generating a branch/diff. Apply relevant repository instructions, including Lovable's prohibition on rewriting published history.
- [ ] **8.5** Run the repository's applicable checks and present the diff, assumptions, evidence, validation and remaining risks for review.
- [ ] **8.6** Submit a PR/change request only through an authorized integration, then track human review. PR creation, merge, experiment exposure and production deployment are separate actions.
- [ ] **8.7** Add controlled rollout approval, release status, pause/rollback ownership and an audit link from insight → experiment → PR → release.
- [ ] **8.8** Replace the Rollouts preview with actual release history and measured post-release performance. Distinguish observed deltas from causal claims and show insufficient data when appropriate.

**Exit criterion:** A reviewed insight can produce an authorized, tested, human-reviewed change request; production rollout remains explicit and its reported outcomes are traceable to actual measurements.

**Evidence / first provider / release integration:** _TBD_

## 13. Phase 9 — Synthetic exploration of competitor apps

**Priority:** P3; research before commitment · **Owners:** Research / engineering TBD  
**Depends on:** Phase 3, Phase 4 feasibility decision, and Phase 6's real jobs/budgets

- [ ] **9.1** Run a bounded feasibility study in permitted app environments. Document access, anti-bot constraints, supported platforms, maintenance burden and cost. Make a go/no-go decision before promising autonomous coverage.
- [ ] **9.2** Define synthetic identities and isolated exploration state. Never substitute another customer's private sessions or analytics.
- [ ] **9.3** Capture real exploration footage, actions, timestamps, app version and task context; distinguish bot behavior from evidence about real users.
- [ ] **9.4** Support resumable exploration and real elapsed-time schedules for time-gated experiences, such as Day 3 offers and level-10 unlocks. Do not imply a short demo traversed a multi-day flow.
- [ ] **9.5** Compare coverage with screenshot libraries: ordinary/happy paths, failures, alternate paths, progression and delayed offers. Report what was not reached.
- [ ] **9.6** Convert external observations into reviewable experiment ideas, optionally supported by internal recordings. Do not automatically promote an observed competitor pattern to a validated improvement.
- [ ] **9.7** Add per-app budgets, stop conditions, evidence retention, failure reporting and human supervision.

**Exit criterion:** A permitted synthetic exploration produces verifiable evidence unavailable in the selected static-library baseline, including truthful coverage/time limitations, before broader automation is committed.

**Evidence / go-no-go decision:** _TBD_

## 14. Decision log

| ID  | Decision / question                                     | Current position                                                                   | Needed evidence                                                    | Owner                     | Resolution / date |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------- | ----------------- |
| D1  | Which Gemini capability and input mode?                 | Existing frames work in code; Agentic Vision and video/URL paths need verification | Real provider calls on the selected footage                        | Fabian                    | Open              |
| D2  | Is external analysis required for the interview?        | Stretch until the internal real demo passes                                        | Rehearsal time and one reliable external source                    | Team                      | Open              |
| D3  | What activity is real versus synthetic?                 | Only actual jobs count as real; synthetic examples are labeled and isolated        | Phase 2 walkthrough                                                | Fabian / Katherine        | Open              |
| D4  | R2 or existing Supabase video adapter?                  | R2 preferred in meeting; no migration commitment                                   | Verified pricing, retrieval pattern, hosting fit and access design | Engineering TBD           | Open              |
| D5  | Primary customer and urgent problem?                    | Studios/incubators are hypotheses                                                  | Unbiased customer interviews and purchasing evidence               | Katherine                 | Open              |
| D6  | Defensible differentiation?                             | Video evidence, integrations and full-loop ambition require separate proof         | Verified competitor research and paired evaluation                 | Maria Emilia / team       | Open              |
| D7  | First analytics / experiment / repository integrations? | Unselected; avoid building all providers at once                                   | Customer workflow and technical feasibility                        | Product / engineering TBD | Open              |
| D8  | Continuous recording and native coverage?               | Future consented collection; current app is on-demand web                          | Capture/permission design and platform tests                       | Engineering TBD           | Open              |
| D9  | Autonomous competitor exploration?                      | Research-gated                                                                     | Access feasibility, incremental evidence and cost                  | Research TBD              | Open              |

## 15. Interview-ready checklist and follow-up

- [ ] A real recording and real model analysis can be inspected on the demo laptop.
- [ ] Every displayed insight links to actual evidence; cached real output is identified as saved.
- [ ] Human review and saved decisions work after reopening the session.
- [ ] Usage, activity, experiment results and rollout deltas are real or unmistakably labeled synthetic/unavailable.
- [ ] No preview approval control can silently record people, open a PR, expose a variant or deploy a change.
- [ ] The team can name the customer hypothesis, the demonstrated capability and the unimplemented vision separately.
- [ ] The second laptop, application deck and three-minute pitch have been rehearsed.
- [ ] Customer interview findings and verified competitor evidence are linked back to roadmap decisions.

**Next review:** After the November 13 interviews/pitch, re-rank Phases 3–9 using customer evidence and the actual demo results. Assign the remaining owners and dates then.

### Progress notes

| Date       | Task IDs / phase | Outcome or blocker                                                                         | Evidence link                                                   | Next action / owner                                    |
| ---------- | ---------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------ |
| 2026-11-12 | Plan             | Meeting translated into phases; existing implementation distinguished from live acceptance | This document; [prior implementation report](IMPLEMENTATION.md) | Team to assign open owners and confirm interview scope |

### November 12 UX milestone

Home, the three primary areas, Internal/External organization, the finding detail/evidence layout, bounded highlights, persistent next-step drafts and explicit Coming Soon pages are implemented. See [UX-IMPLEMENTATION.md](UX-IMPLEMENTATION.md) for the scope and acceptance evidence. No real model run or interview dataset was created by UI verification; Phase 1 remains open. Agent counters, credit/frequency controls, external analysis, experiments and execution integrations remain future tasks.

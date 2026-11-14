# Sunday demo — Uber Eats and Bag Checkout App

Demo date: **Sunday, November 15, 2026.** Updated November 13, 2026. The product vision and UI contract live in [AUTOMATED-LOOP.md](AUTOMATED-LOOP.md); this file is the demo script and source list. Where they disagree, AUTOMATED-LOOP.md wins.

## The story we tell

LoopMate is an automated improvement loop. Agents watch recordings, find **product improvements** (UX, UI, layout, button size and target area, copy, discoverability, trust, engagement; bug fixes are one subset), attach playable evidence highlights, and propose an A/B test for each insight. Humans do three things only: review insights against the highlights, approve / edit / reject the suggested test, and merge the resulting PR on Rollouts. The work is split across **four scouts**: **Tracker** (blue) watches our own product's recordings and **Explorer** (green) watches competitors' public footage, so together they find what to improve; **Fixer** (orange) turns a clear problem into a fix PR and **Experimenter** (purple) runs an A/B test for an open question, so together they change the product. For Uber Eats, the competitor is **DoorDash**. Hero names are internal labels only; the nav reads HQ, Insights, A/B Tests, Rollouts. The Fixer handles bugs only and does not appear in the demo; rollouts belong to the Experimenter.

We pretend to own two products:

- **Uber Eats**: public YouTube walkthroughs (below). Third-party footage; Uber is not a customer and we have no access to its analytics.
- **Bag Checkout App**: the controlled checkout fixture (`TestApp`) recorded with consented screen capture. Legacy `Carry checkout` recordings count as this product.

Miso food delivery is **not** part of the demo or the product picker (see the archived [SUNDAY-DELIVERY-DEMO.md](SUNDAY-DELIVERY-DEMO.md)).

Say plainly in the demo which stages are real, simulated and not connected. Real: the improvement-focused Gemini prompt, strict evidence validation, suggested tests and fix/experiment routes, bounded highlights, insight and test decisions, scout settings, and in-page YouTube playback (once verified in a browser). Simulated (badged "Simulated demo", per AUTOMATED-LOOP.md §3): the experiment run, variant recordings, illustrative deltas and the PR on Rollouts. Not connected: the collection runner and any repository. In the prototype, a human triggers Analyze.

## Pre-demo checklist (run Saturday)

The happy path below is implemented and covered by automated tests (257 tests / 41 files; provider and YouTube player mocked). **No agent has checked it in a real browser.** Walk it once on the demo laptop, at desktop width and at phone width (375 px), and drop or narrate any step that fails.

1. **Nav** reads exactly HQ, Insights, A/B Tests, Rollouts (desktop and mobile bottom bar). Research tools (Recordings, recording setup, Evaluation, Settings) sit in the secondary menu. No Competitors tab; an old `/insights?tab=competitors` link opens Insights filtered to Explorer.
2. **Reset** in Settings → **Reset simulated demo data**, so the sample test is pending and no simulated PR exists. Confirm Settings → Scouts has the **Experimenter on** (if it is off, approving only saves the test and the sample page then offers **Start test**).
3. **Imported runs present:** the pre-generated Uber Eats and DoorDash runs load, so HQ shows the featured trio: "Order again on the home screen" (Both, sample), "Hidden minimum order threshold" (Tracker only) and "Cart Complement Recommendations" (Explorer only).
4. **No thumbnails** on HQ or Insights; each card shows a source marker (blue Tracker, green Explorer, both) and "from N videos".
5. **Merge animation** plays (the hero flies across); with Pause motion or system reduced motion a static "PR merged" card shows instead. Both keep the card until Dismiss.
6. **Insights filters** (source, status, videos) do not crowd or overflow at 375 px. Not yet checked by anyone.
7. **Bug GIF slide** (Bag Checkout recordings) is prepared by Maria and Daniela outside the app; it is not part of this script.

## Demo script: the 6-step happy path (about 4 minutes)

Start the browser at **`/hq`** (the LoopMate logo goes to Home, not HQ). One concrete fictional example carries the story, like the pitch-night "reorder past orders = 2x spend" example: users hunt for last week's order, DoorDash puts it one tap away. Say once, up front, that the reorder insight and everything after approval are a labeled sample.

1. **HQ: orientation (40 s).** Left two-thirds: **Needs your attention**, the three featured insights with their source markers. Right third: agent tiles stacked vertically (Tracker, Explorer, Experimenter, Fixer muted as "Bugs only"), analyses today and tokens by agent/product. Credits read "not connected"; simulated counts carry the "Simulated demo" badge and the "+N sample" count is separate from real items.
2. **Insights: one view for both scouts (40 s).** Click **All insights** (it picks Uber Eats if no product is chosen). Point out the blue/green markers and "from N videos", then use the **source** filter (Tracker / Explorer / Both) and the **videos** filter (an option only the sample reaches says "(sample)"). Mention the real Tracker-only and Explorer-only insights as real Gemini output on public footage.
3. **Open "Order again on the home screen" (45 s).** Badge: Sample / Simulated demo. Two observation rows: Tracker (your users scroll and search for last week's order) and Explorer (DoorDash's home-screen "Order again" row). The evidence is an **Illustrative storyboard · not real footage**, with sample stats ("Seen in 14 of 50 sessions · sample"). It does not claim any stored YouTube video shows this.
4. **Approve the A/B test, follow it running (45 s).** Under **Suggested A/B test** ("Order again" button on the home screen, 20% traffic) click **Approve test**, then **Follow it in A/B Tests**. The run advances through Building variant → Collecting variant recordings → Analyzing → Comparing deltas → Drafting PR. Use **Skip to results** if time is short. When it finishes click **Review PR**.
5. **Review the PR on Rollouts (45 s).** The demo PR is at the top. Tabs: **Files changed** (diffs), **Analytics** ("Control vs variant · sample"), **Deltas** (grey, illustrative, not measured) and **Insight** (the linked insight). Note: editing the test does not change the sample PR, diffs or analytics.
6. **Merge (15 s).** Click **Merge**: the Experimenter flies across the screen and the "PR merged" card stays until **Dismiss**. Close with: nothing was deployed and no repository was touched; this stage is simulated in the prototype.

Fallbacks: if the imported runs are missing, step 2 still shows the sample; describe the real trio verbally. If the animation stutters, Pause motion in the header shows the static confirmation.

### What is real vs sample in this path

- **Real:** Gemini `public_video` analysis that produced the imported Uber Eats (Tracker) and DoorDash (Explorer) findings, unaltered model text, their in-page YouTube evidence on the real insight detail pages, source markers and video counts for real insights ("from 1 video").
- **Sample / simulated (always badged):** the "Order again" insight, its storyboard and stats, the experiment run, deltas, the PR and the merge.
- **Not connected:** collection runner, credits, real experiments, repository.

## Uber Eats source candidates

Defined in `publicVideo.ts` (`uberEatsCandidates`). Clips are capped at five minutes (`MAX_PUBLIC_CLIP_MS`).

Titles and creators below match what YouTube's public oEmbed lookup returned on November 13, 2026, for all five IDs. A successful lookup suggests embedding is allowed, but none has been previewed in the page by an agent.

| Title (as on YouTube)                                           | Creator · date label                                                               | Source                                                 | Review consideration                                                                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How to Use Uber Eats for the First Time                         | 4kEasyGuide · June 2026                                                            | [YouTube](https://www.youtube.com/watch?v=EFCmkDTBYck) | Description covers login through checkout; inspect actual footage. Used for the one live analysis check (below).                                          |
| How To Order Food On Uber Eats                                  | How to Everything · January 2026                                                   | [YouTube](https://www.youtube.com/watch?v=XRYyOhmIdfg) | Confirm readable, continuous app content.                                                                                                                 |
| Uber Eats: how to order food (Russian-language tutorial)        | HardReset_info Ukraine · October 2025                                              | [YouTube](https://www.youtube.com/watch?v=oDcQjVREO5w) | Narration and app language are Russian; chapters cover address, cart, delivery and payment.                                                               |
| Join us as we explore the Uber Eats app                         | Bridges Helpdesk and Technical Assistance Center · linked in an August 2024 review | [YouTube](https://www.youtube.com/watch?v=BgETPxj78Eo) | VoiceOver context changes gesture interpretation; [creator context](https://imagemd.org/2024/08/27/food-order-apps-whats-out-there-and-how-to-use-them/). |
| How to Use Uber Eats on iPhone & Android - Walkthrough Tutorial | TechZG Guides · August 2020                                                        | [YouTube](https://www.youtube.com/watch?v=Xkv-FUvspg0) | Historical backup; not evidence of the current UI.                                                                                                        |

## DoorDash competitor candidates (Explorer)

Defined in `competitors.ts` (`doorDashCandidates`) and listed in Recordings → Uber Eats under "Competitor footage · Explorer". Explorer findings from them appear in the unified Insights list with a green marker. Saved clips use source `DoorDash` with `public_video.competitor_of: "uber-eats"`. They never appear in Uber Eats rows, totals, priorities or Evaluation. Titles and creators were checked against oEmbed on November 13, 2026. Pre-generated runs from the live `public_video` competitor prompt are bundled (7 findings); none has been previewed in the page by an agent.

| Title (as on YouTube)                                                                  | Creator · date label          | Source                                                 | Review consideration                          |
| -------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------ | --------------------------------------------- |
| How to Use DoorDash App 2026 \| Complete Beginner's Guide to Ordering Food & Groceries | Online Money · titled 2026    | [YouTube](https://www.youtube.com/watch?v=Q-41ykn9eMI) | Review usable segments first.                 |
| How to Order Food Through DoorDash in 2026 \| Step-by-Step Delivery Guide              | DiziSight · titled 2026       | [YouTube](https://www.youtube.com/watch?v=GvejoxdR0Vo) | Check that the app screen is readable.        |
| How To Use DoorDash - Complete Beginner's Guide                                        | Howfinity · date not verified | [YouTube](https://www.youtube.com/watch?v=POS585Ok0Jg) | App version may be older than the current UI. |
| How to Order Food on DoorDash 2024                                                     | lemme help · titled 2024      | [YouTube](https://www.youtube.com/watch?v=VfirQD7YTqM) | Older backup.                                 |

The "Order again on the home screen" insight (source Both) is a fictional sample badged "Simulated demo"; it is not from analyzed footage.

Pick segments that show the app, not narration-only or edited sections, and avoid personal details. Start with the recent videos. These are tutorials, not representative customer sessions: do not call them "validated customer sessions" or aggregate different app versions into prevalence claims. Preserve attribution.

## How public-video analysis works

- Mode `public_video` sends the YouTube URL as Gemini `fileData` with `media_processing: "AGENTIC"` (agentic video understanding; the clip window is sent as a fixed MM:SS text instruction because `videoMetadata` clipping/FPS is static-only, and every finding is still checked against the window) through the existing server-side `generateContent` call. No events are sent and none are fabricated.
- Agentic mode caveat: the "88%" and "7%" improvement figures are Google benchmark claims, not our measurement. Our one 82 s agentic test used about 33% more tokens than the earlier non-agentic call; quality was not compared.
- The system prompt (`server/analysisPrompt.server.ts`) frames the model as a senior product designer looking for improvements to the whole journey; bugs are one kind of insight. Recommendations may improve a healthy flow.
- Timestamps use the original video's timeline and must fall inside the clip. Out-of-window findings, missing visual support and any claim of internal events fail the run.
- Public references are excluded from customer-frequency priorities and have no events-only baseline. JSON export includes the source reference. Cloud upload of references is not implemented.

References: Google's [video-understanding guide](https://ai.google.dev/gemini-api/docs/video-understanding), [generateContent Part/VideoMetadata](https://ai.google.dev/api/generate-content) (VideoMetadata is documented as deprecated but still accepted), and the [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference).

## Live analysis check — November 13, 2026

One real Gemini call (`gemini-3.5-flash-lite`) through `analysisInput.parse` → `analyze()` on `EFCmkDTBYck`, clip 30,000–105,000 ms at 1 FPS, returned HTTP 200 and 2 findings that passed all validation (evidence schema, clip window, visible-evidence-only, no internal events, `suggested_test` and `suggested_route` schemas). Both were routed to "experiment". Usage: 5,788 input / 844 output / 6,632 total tokens; latency 6,383 ms. Nothing was saved. The script passed `duration_ms` = 105,000 (the clip end) because the real length was unknown; the app uses the player-reported duration. No one has watched the clip to judge whether the findings are right.

## Verification limits

The YouTube player and the provider are covered by mocked automated tests. Live in-page YouTube playback, footage quality, embed availability and the scout UI have not been verified in a real browser by an agent. No DoorDash clip has been previewed in the page by an agent. Live Gemini video analysis has passed one pipeline check (above), not a quality check. Public videos can change or disappear; a saved URL is not a copy of the media. The checklist above is the acceptance gate for Sunday.

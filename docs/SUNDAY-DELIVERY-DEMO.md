# ARCHIVED — Miso food-delivery demo (superseded)

> [!WARNING]
> **Archived November 13, 2026. Do not use this script.** Miso food delivery is not part of the Sunday demo and is not a product. The products are **Uber Eats** and **Bag Checkout App**; follow [UBER-EATS-DEMO.md](UBER-EATS-DEMO.md) for the Sunday script and [AUTOMATED-LOOP.md](AUTOMATED-LOOP.md) for the product vision. Miso no longer appears in the product picker; existing Miso recordings stay untouched in IndexedDB and are shown as "Archived delivery app". The "Miso Demo" button, the manual record-and-Analyze walkthrough and the "Product vision versus current demo" section below describe the old plan and are kept for history only.

## Demo product and retained recordings (historical)

The main demo was **Miso**, a fictional food-delivery storefront with a fictional restaurant, Little Green Kitchen. It is independent of Uber Eats, Grubhub and Postmates. Those are Fabian's comparison candidates; no competitor capture, current capability comparison or customer-data access is implied.

Choose the **Miso Demo** product button, then **Record a session**. To open the original Carry app's research, choose **Bag Checkout App**. These buttons scope the whole workspace: Home totals/recent sessions, Insights and priorities, Recordings and all summary counts, Evaluation and paired comparisons, and the recording fixture. There is no combined analytics view by default. Selection survives navigation/refresh per browser tab. Workspace settings remain shared.

Existing IndexedDB recordings and the database identifier are preserved. Historical `Carry checkout` tags are recognized under Bag Checkout App without rewriting data; new bag recordings use `Bag checkout app`. Delivery records remain `Miso food delivery` internally. Prioritization treats old and renamed bag sources as one product with its own denominator.

## Three evidence scenarios

| Researcher toggle | Participant experience | What events can establish | What visual evidence may add |
| --- | --- | --- | --- |
| Looks clickable | The food illustration and offer banner do nothing when tapped. The explicit View item button works. | Where and when taps occurred, including repeated taps outside controls. | The image/banner's appearance and lack of visible response in sampled frames. Intent remains an interpretation. |
| Missing item details | Item details show Regular/Large and serving information; the basket omits that context. Edit item returns to the selected size and quantity. | A basket → item → basket navigation pattern. | Which information is present on the item page and absent from the basket. A backtrack alone does not establish the reason. |
| Clipped names and addresses | Long food names and the synthetic address truncate with an ellipsis in the basket. The address editor shows the full address. | Taps and navigation to edit an address. | The visible truncation and what a participant could see at that viewport. Do not infer a wrong delivery occurred. |

Disable all three for a clean comparison: food images/banner work, basket portion information is visible, and names/addresses wrap. Scenario settings stay outside the checkout crop and are excluded from model inputs. Ground-truth observations start **unknown**, even when a defect is enabled. Semantic logs do not contain raw address/name values. The fictional details are visible in the actual video.

## Suggested walkthrough

1. Choose the Food Delivery product, open Record a session, choose scenarios and consent. Use desktop Chrome/Edge, share this app's current tab and confirm capture starts. This is the existing permissioned screen-video path.
2. On the menu, try the pizza illustration and offer banner. Pause briefly after interactions so sparse frame sampling can capture context. Use **View item** to continue.
3. Choose **Large** (serves two), add to basket, inspect the item and address, and use **Edit item** to revisit the portion. Keep the session natural; do not claim an issue the participant did not encounter.
4. Return to the basket, use **Edit delivery address** to inspect the complete synthetic address, then place the demo order. No charge or real delivery occurs.
5. Stop and save; refresh and replay. Confirm source, video duration, event positions and the Food Delivery recording list.
6. Consent to AI analysis, inspect actual findings/evidence, then review. The model may return fewer than three findings; never fill gaps with canned results. Save one real run as a fallback for Sunday.
7. If time permits, record a clean comparison and run the paired events-only analysis using independently judged labels. Demonstrate what the actual evidence supports, rather than claiming event analytics can never detect these behaviors.

## Product vision versus current demo

The intended product automatically collects **real-user sessions in the company's own product**, analyzes them and generates insights. The team approves automated A/B tests and reviews/merges generated PRs. Priority/usage tuning comes later.

This milestone changes the demo domain and preserves actual recordings. It continues to use manual browser screen-sharing and explicit analysis consent. Automatic source integration/ingestion/jobs, A/B execution, PR generation and competitor exploration are not implemented by it. Browser screen video and reconstructed web replay remain distinct options; no replay SDK was added. The next automation milestone should use this delivery demo as its first connected product, once the capture approach is chosen.

## Verification checkpoint

All **84 tests across 17 files** pass, along with typecheck and production build. Lint has no errors and seven existing Fast Refresh warnings. Checks cover the delivery flow and clean variant, capture source/crop/unknown ground truth, safe event metadata, retained basket state, original-recording filters and independent source denominators. These capture tests use a mocked MediaRecorder, not native browser permission capture.

A local visual-preview attempt could not start because the sandbox rejected binding 127.0.0.1:3007 (EPERM). Native screen sharing, visual layout and real Gemini detection quality therefore require live verification on the interview laptop. The earlier browser-launch approval rejection was not retried or bypassed. No live provider inference, deployment, migration or real research-data modification was performed for this milestone.

Product-workspace follow-up: product selection now precedes analytics, and the former Original checkout option is named Bag Checkout App. Regression checks cover first-entry gating, product-specific counts/findings/evaluation/fixtures, remembered selection, legacy source aliases, detail-link adoption and capture switching locks. Shared summary responses project existing JSON source metadata without a database migration; live cloud behavior remains unverified.

Home-entry update: Home is a general workspace overview with no product picker or selection requirement. Its totals span products and recent recordings identify their product. Product selection/scoping remains on Insights, Recordings, Evaluation and recording setup; returning Home preserves the remembered product for those pages.

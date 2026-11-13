# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

`AGENTS.md` (imported above) is the authoritative handoff: Lovable rules, product/design decisions to preserve, privacy invariants, current acceptance status and next task. Keep it updated as the session handoff; this file adds only commands and the cross-file architecture.

## Commands

Node 22.12+, npm (a `bun.lock` exists from Lovable, but local work uses npm).

```sh
npm run dev            # Vite dev server; loads ignored .env into the SERVER process only
npm test               # vitest run (jsdom, setup in src/test/setup.ts)
npx vitest run src/test/research.test.ts        # single file
npx vitest run -t "<test name substring>"       # single test by name
npm run typecheck      # tsc --noEmit
npm run lint           # eslint; ~7 pre-existing react-refresh warnings are expected
npm run build          # production build (nitro, Cloudflare Worker target)
```

Restart `npm run dev` after any `.env` or server-code configuration change. Never print or overwrite `.env`.

## Architecture

**Stack:** React 19 + TanStack Start/Router (file-based routes in `src/routes/`, generated `src/routeTree.gen.ts` — never hand-edit) + Vite + Tailwind v4 + Radix/shadcn UI. `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which already bundles the React, Tailwind, tsconfig-paths, nitro and devtools plugins — do not add them again, and do not set `ssr.external` or add compression.

**Server boundary:** `src/server.ts` is the custom fetch entry. Requests to `/api/research/*` are routed to `src/lib/research/server/api.server.ts` *before* TanStack SSR; everything else goes to the TanStack server entry. All secrets (Gemini key, Supabase service role, workspace token) are read only in `*.server.ts` files from runtime bindings / process env. Browser code talks to the server only via `src/lib/research/apiClient.ts` (analysis) and `sharedStorage.ts` (optional cloud copy).

**Research pipeline (client → server → client):**
1. `capture.ts` (getDisplayMedia + MediaRecorder, crop metadata, WebM duration fix) and `eventLogger.ts` (semantic, value-free events with recording-relative ms) produce a session.
2. `sessionStorage.ts` persists sessions in IndexedDB (historical DB name intentionally unchanged). `use-research-session.ts` wraps it with optimistic updates and serialized write queue.
3. `frameSampler.ts` samples cropped checkout frames; `aiReview.ts` builds the explicit `blindPayload` (or events-only payload) and owns the Zod output schema + evidence validation.
4. `server/analysis.server.ts` calls Gemini `generateContent` with structured output; `geminiErrors.server.ts` maps failures to fixed hints. The provider JSON schema deliberately differs from the local Zod schema (no `maxItems`) — see AGENTS.md.
5. Results are stored as runs (original model output) separate from human review fields (`review.ts`), next-step drafts (`actions.ts`), and ground truth/matches (`evaluation.ts`). `insights.ts` aggregates accepted findings across sessions; `evidence.ts` computes highlight ranges.

**UI:** `src/components/research/*` holds the presentation layer; route files are thin wrappers. Keep business logic in `src/lib/research/` so UI can be iterated independently. `Shell` sets `data-theme="loop"`; theme tokens live in `src/styles.css`, and `.phone` deliberately resets to a light storefront palette for the controlled checkout (`TestApp`) — styling changes must not alter it or capture geometry.

**Tests:** `src/test/` uses `fake-indexeddb` and `research-fixtures.ts`. Fixtures are test-only and must never appear as product data.

## Further docs

`docs/ARCHITECTURE.md` (module contracts and stored audit fields), `docs/PROTOTYPE-PHASE-PLAN.md` (authoritative feature/acceptance tracker), `docs/UX-IMPLEMENTATION.md`, `docs/MANUAL-VERIFICATION.md`, `README.md` (setup, env vars, live demo script).

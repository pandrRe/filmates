# Filmates

Group film-watchlist app. Friends join a group by invite link, post films, vote up/down, mark seen. Main view ranks films by score.

## Read first

- `DESIGN.md` — the source of truth: product rules, data model, visual spec. Do not contradict it; if the code must diverge, update DESIGN.md in the same commit.
- `CHECKLIST.md` — run it before ending any work session.

## Stack

- Frontend: **Octane** (`octane`) with `@octanejs/tanstack-router`, file-based routes. Octane is React's model, compiled: no dependency arrays, no rules of hooks, refs as props, native DOM events. Do not write React idioms that Octane removed.
- Backend: **Convex** — live queries for all reads, mutations for all writes, actions for TMDB calls. Convex has no Octane binding: use the `useLiveQuery` wrapper around `ConvexClient` (`convex/browser`).
- Movie data: **TMDB**, server-side only. Films are cached in the `films` table on first post.

## Rules

- Commit frequently with the `/commit` skill: one coherent change per commit, after every working unit — not one big commit at the end.
- Visual work follows the DESIGN.md tokens exactly: six colors, Helvetica stack, 4 px grid, no radius/shadows/emoji. When in doubt, remove decoration.
- Docs are written in Simplified Technical English: short sentences, active voice.
- Phone first: build and check at 375 px before desktop.

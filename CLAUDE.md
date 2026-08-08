# Filmates

Group film-watchlist app. Friends join a group by invite link, post films, vote up/down, mark seen. Main view ranks films by score.

## Read first

- `DESIGN.md` — the source of truth: product rules, data model, visual spec. Do not contradict it; if the code must diverge, update DESIGN.md in the same commit.
- `CHECKLIST.md` — run it before ending any work session.

## Stack

- Frontend: **Octane** (`octane`) with `@octanejs/tanstack-router`, file-based routes. Octane is React's model, compiled: no dependency arrays, no rules of hooks, refs as props, native DOM events. Do not write React idioms that Octane removed.
- Backend: **Convex** — live queries for all reads, mutations for all writes, actions for TMDB calls. Convex has no Octane binding: use the `useLiveQuery` wrapper around `ConvexClient` (`convex/browser`).
- Movie data: **TMDB**, server-side only. Films are cached in the `films` table on first post.

## Code style

- **Type-safe.** TypeScript strict mode. No `any`, no `as` casts, no non-null `!`. If the type system fights you, the model is wrong — fix the model.
- **Data-oriented.** Plain serializable objects, no classes, no inheritance. Types describe the data exactly: unions over booleans-plus-flags, literal types over strings. Make illegal states unrepresentable.
- **Functional.** Pure functions transforming data; side effects only at the edges (Convex functions, DOM). No mutation of inputs. Logic is composed from small functions, not orchestrated in big ones.
- **Parse, don't validate.** Every external boundary parses into a domain type with **Valibot**: TMDB responses, route search params (TanStack Router accepts Valibot schemas via Standard Schema), invite tokens, any env var. Inside the boundary, data is trusted and typed. Convex's own `v` validators own the database schema and function args — Valibot owns everything Convex does not cover.
- Small functions with one job. If describing a function needs "and", split it.
- Names are full words. No abbreviations, no `data`/`info`/`utils`/`helper`/`manager`, no synonyms — one concept has one name, taken from the glossary below.
- A comment must never narrate an edit or explain what changed. Code is always the present; it does not describe itself. No "now we…", "changed to…", "this replaces…", "instead of…". If a comment explains the diff, delete it — the commit message carries that. The rare valid comment states a non-obvious invariant or an external contract. Default is zero comments.

## Domain glossary

One concept, one word — in types, tables, functions, UI copy, and docs.

- **film** — never "movie". TMDB says "movie"; translate at the API boundary and nowhere else.
- **group** — a private circle of members, created with a name and a member limit.
- **member** — a user inside a group. "User" means only the account.
- **invite** — a token link that admits a user into a group.
- **post** — the act of adding a film to a group. The resulting row is a **groupFilm**.
- **vote** — up or down. **score** = upvotes − downvotes, denormalized on the groupFilm.
- **seen** — the per-member mark, stored in `seenMarks`. Never "watched".

## Tooling

- **pnpm** is the only package manager. Never npm, yarn, or bun. Commit `pnpm-lock.yaml`; a `package-lock.json` or `yarn.lock` appearing is a bug.
- **Latest stable everything.** When adding a dependency, install the latest stable version; do not copy versions from old examples. When a task touches an outdated dependency, flag it.
- **TypeScript 7** (native compiler, GA July 2026) for typechecking and builds. Known gap until 7.1: tools that need the programmatic API (typescript-eslint, ts-morph) still require a side-by-side TS 6.x — pin it explicitly if one is added, and remove the pin when 7.1 lands.

## Rules

- Commit frequently with the `/commit` skill: one coherent change per commit, after every working unit — not one big commit at the end.
- Visual work follows the DESIGN.md tokens exactly: six colors, Helvetica stack, 4 px grid, no radius/shadows/emoji. When in doubt, remove decoration.
- Docs are written in Simplified Technical English: short sentences, active voice.
- Phone first: build and check at 375 px before desktop.

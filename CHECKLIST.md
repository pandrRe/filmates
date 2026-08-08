# Work checklist

Run this before you end a work session. Skip items whose area you did not touch. If an item fails, fix it or write down why not.

## Always

- [ ] The change matches DESIGN.md. If it does not, update DESIGN.md in the same commit and say so.
- [ ] No dead code, no commented-out blocks, no TODO without an owner.
- [ ] No comment narrates an edit or explains a change. Code is the present; it does not describe itself. The only valid comment states a non-obvious invariant or external contract.
- [ ] Functions are small and do one job. Logic is pure; effects live at the edges.
- [ ] No `any`, no `as` casts, no non-null `!`. Strict mode stays on.
- [ ] Every external input (TMDB response, search params, invite token, env var) is parsed with Valibot before use. Nothing raw crosses a boundary.
- [ ] Names come from the CLAUDE.md glossary. No "movie", no "watched", no `utils`/`helper`/`data`.
- [ ] Work is committed with the `/commit` skill. Small, coherent commits — one idea per commit.

## Docs

- [ ] Simplified Technical English: short sentences, active voice, one idea per sentence.
- [ ] No claim contradicts another section (search DESIGN.md for the terms you touched).
- [ ] Links resolve.

## Backend (Convex)

- [ ] Every query reads through an index. No table scans.
- [ ] Invariants hold inside one mutation: member limit on join, one vote per (user, film), one post per (group, film), score matches votes.
- [ ] TMDB is called only from actions. The key never reaches the client.
- [ ] No fictional fallback values. Missing required data raises an error.

## Frontend (Octane)

- [ ] Typecheck passes. Tests pass. Paste the output, do not summarize it.
- [ ] Main route JS < 80 kB gzip. Check after adding any dependency.
- [ ] New routes are code-split. Filter/search state lives in URL search params.
- [ ] Votes and seen marks update optimistically and reconcile from the live query.

## Visual

- [ ] Only the six color tokens. No new colors, no gradients, no shadows, no border radius (avatars excepted).
- [ ] Helvetica stack only. Titles uppercase bold; numbers `tabular-nums`.
- [ ] All spacing is a multiple of 4 px. Nothing is centered.
- [ ] Posters: strict 2:3, hard corners, correct TMDB size for the slot, explicit width/height.
- [ ] No icons where a word works. No emoji anywhere.

## Phone

- [ ] Layout works at 375 px width, one-handed.
- [ ] Tap targets ≥ 44 px, including the vote arrows.
- [ ] Film detail opens as a bottom sheet and survives refresh via the URL.

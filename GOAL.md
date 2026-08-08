# Goal prompt — implement Filmates end to end

Paste the block below as the goal for an implementation session.

---

Implement Filmates end to end. DESIGN.md is the spec — follow it exactly.
CLAUDE.md and CHECKLIST.md govern how you work. Read all three first.

Before starting: check that CONVEX_DEPLOYMENT and TMDB_API_KEY exist in the
environment. If either is missing, ask me for it once and stop until provided.

Build in this order. Each milestone must run, pass CHECKLIST.md, and be
committed before the next begins.

1. Scaffold — pnpm, Vite (latest), Octane, @octanejs/tanstack-router
   (file-based routes), TypeScript 7 strict, oxlint + oxfmt, lefthook
   pre-commit hooks (oxfmt → oxlint --fix → tsc --noEmit on staged files).
   Convex initialized with the full schema and indexes from DESIGN.md
   § Data model. App boots to an empty shell.
2. Auth + groups — Convex Auth (Google + email OTP). Create group with name
   and member limit. Invite links /join/<token>: 128-bit token, 7-day expiry,
   revoke, member-limit check inside the join mutation.
3. Films — add-film flow: Convex action → TMDB /search/movie, debounced
   200 ms, 24 h response cache. Film details cached in `films` on first post.
   One post per (group, film), enforced in the mutation.
4. Votes + seen — one vote per (member, film) with `score` updated in the
   same mutation; seenMarks; optimistic UI reconciled by live queries through
   the useLiveQuery wrapper over ConvexClient.
5. Main view — ranked list per DESIGN.md § Product design: rank numbers,
   spec lines, dot rows, posters at w92, filters in URL search params
   (Valibot-validated), client-side fuzzy search over the group list.
6. Visual pass — apply § Visual design completely: six tokens, Helvetica
   stack, 4 px grid, hairlines, bottom-sheet detail with URL state, the one
   rank-reorder animation. Verify at 375 px width.
7. PWA + performance — manifest, service worker (app shell only), route
   code splitting, poster loading rules. Measure against § Performance
   budget and paste the real numbers.

Rules of engagement:

- Commit with /commit after every coherent unit of work, not once per
  milestone. Hooks always run; never use --no-verify.
- Parse every external input with Valibot. Never invent fallback values —
  a failed parse throws.
- Where DESIGN.md has an open question (§ Open questions), pick the smallest
  reasonable answer, record it in DESIGN.md, and keep moving. Do not stall.
- When reality contradicts DESIGN.md (TMDB shapes, Octane gaps), adapt and
  update DESIGN.md in the same commit.
- If an Octane binding is missing for something, first try the OctaneCompat
  escape hatch before writing custom infrastructure.

Done means: on a phone, I can create a group, open an invite link as a second
user, post films, vote, mark seen, and watch the ranking reorder live in both
sessions — with every CHECKLIST.md item passing and all work committed.

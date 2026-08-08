# RFD 001 — Filmates

| Field   | Value                                                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| State   | draft                                                                                                                                                       |
| Authors | pandrre                                                                                                                                                     |
| Date    | 2026-08-07                                                                                                                                                  |
| Format  | [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/), header per [Oxide RFD](https://rfd.shared.oxide.computer/rfd/0001) |

## Summary

Filmates is a web app for small groups of friends. Members post films they want to watch together. Members vote films up or down. Members mark films they have seen. The main view ranks films by score. The app must feel instant and must work well on a phone.

## Context

Groups of friends collect film ideas in chat threads. The ideas get lost. There is no shared ranking and no record of who has seen what. Filmates gives the group one ranked list and live state.

## Goals

- A group is private. Members join only by invite link.
- A member posts a film from a real movie database, not from free text.
- A member gives one vote per film: up, down, or none.
- A member marks a film as seen. The mark is per member.
- The main view sorts films by `upvotes − downvotes`.
- Search narrows the group list by title as the user types, and reaches the movie database for films not yet posted.
- All state updates are live. No refresh button.
- The app is fast: first load under ~1.5 s on 4G, interactions under 100 ms.
- The UI works one-handed on a phone.

## Non-goals

- No public profiles, no discovery feed, no follow graph.
- No reviews, ratings out of 5, or comments (v1).
- No semantic ("vibe") search in v1. See [Future work](#future-work).
- No native app, no install, no offline mode. Filmates is a web page, opened in a phone browser.

## Product design

### Groups and invites

1. A user creates a group and gives it a name.
2. The creator sets a member limit `X` (default 10, max 25).
3. The app makes an invite link: `filmates.app/join/<token>`. The token is random, 128 bits, base64url.
4. A link expires after 7 days. The creator can revoke it and make a new one.
5. When a user opens the link, they sign in, then join. The join mutation checks the member limit and the token in one transaction. If the group is full, the user sees a clear message.
6. A user can be in more than one group. A group switcher sits in the top bar.

### Posting a film

1. The member taps **Add film**.
2. They type a title. Results come from the movie database with fuzzy matching.
3. They pick a result. The app stores the film in the group list with poster, year, runtime, and director.
4. A film can appear only once per group. A second post is rejected and the UI scrolls to the existing entry.

### Votes and seen marks

- Vote states per member per film: `up`, `down`, `none`. Tapping the active arrow again returns to `none`.
- Seen is a boolean per member per film.
- Both actions are optimistic in the UI and confirmed by the live query.

### Main view

A single ranked list:

```
 FILMATES
 ─────────────────────────────────────────

 SUNDAY SCREENING
 3 / 8 MEMBERS

 [ Search films                          ]
 [   ALL   |  UNSEEN BY ME  | SEEN BY ALL ]

 INDEX ───────────────────────────────────
 01 ──────────────────────────────────────
 ┌────┐  HEAT                      ┌────┐
 │post│  1995 · 170 MIN · MANN     │  ▲ │
 │    │                            ├────┤
 │    │                            │  6 │
 │    │                            ├────┤
 └────┘  ■ ■ □                     │  ▼ │
                                   └────┘
 02 ──────────────────────────────────────
 ┌────┐  LA HAINE                  ┌────┐
 │post│  1995 · 98 MIN · KASSOVITZ │  ▲ │
 ...
 ─────────────────────────────────────────
 [             ADD FILM                   ]
```

- Sort: score descending. Tie-break: oldest post first.
- The mark row shows one square per member. `--mark` = seen, `--edge` = not seen. Open the film to read the names.
- Voting is the only action on a row. Marking seen lives in the bottom sheet: a second button on the row costs the width that keeps the specification line on one line, and seen is a rarer act than voting.
- Filters: `All · Unseen by me · Seen by all`, as a segmented control. "Seen by all" is the watch-next shortlist in reverse: it shows what the group can retire.
- The search field filters the group list by title as the user types, best match first. When the field is not empty, a `SEARCH THE FILM DATABASE` button appears below the results and jumps to the add-film flow.

## System design

```
Phone / browser
  Octane app (+ @octanejs/tanstack-router)
        │  WebSocket (live queries)
        ▼
  Convex (DB + functions)
        │  actions (server-side fetch)
        ▼
  TMDB API (movie data, posters)
```

### Frontend

- **Framework: [Octane](https://octanejs.dev)** — React's programming model, compiled. No virtual DOM. The compiler tracks dependencies, so there are no dependency arrays and no rules of hooks. It benchmarks ~2.6× faster than React 19 with Compiler. This serves the "very fast" goal directly.
- **Routing: [`@octanejs/tanstack-router`](https://github.com/octanejs/octane/tree/main/packages/tanstack-router)** — the official Octane binding for TanStack Router. It has near-full API parity (loaders, search params, `Link` preloading, code splitting via `lazyRouteComponent`). We use file-based routes.
- Routes: `/sign-in`, `/` (group list), `/g/$groupId` (main view), `/g/$groupId/add`, `/join/$token`, `/settings`. Every route behind the account redirects to `/sign-in` with the intended path in a `next` search param, so an invite link survives the sign-in detour.
- `/` is the group switcher. The wordmark on the main view links to it. A dropdown switcher in the header costs 49 kB gzip of popover machinery and saves no taps, so there is none.
- Filter and search state live in the URL as validated search params. A shared link reproduces the exact view.
- No service worker and no manifest. The app is always online — a group list is worthless stale, and live queries own the data. Repeat loads rely on HTTP caching of the immutable asset hashes.
- Risk note: Octane is new (production-ready for web, but a young ecosystem). There is no escape hatch: `octane/react` mounts Octane islands inside a React app, which is the opposite direction. A React-only library cannot run here, so every React dependency must have an Octane port or a framework-agnostic core we bind ourselves.

### Backend: Convex

Convex is the right fit and we keep it:

- **Live queries** push vote and seen changes to all group members over WebSocket. This is the core product feel, and we get it with zero infrastructure.
- **Mutations are transactions.** The join-with-member-limit check and the one-post-per-film rule are single mutations with no race conditions.
- **Actions** call TMDB from the server. The TMDB key never reaches the client.
- **Auth:** Convex Auth with the Password provider — email, password, and a display name. It needs no third-party account and no outbound mail, so the app deploys with only a Convex key pair. Google sign-in and email OTP both need vendor credentials; see [Future work](#future-work).

Convex has no official Octane binding. The fix is small: Convex ships a framework-agnostic client (`ConvexClient` in `convex/browser`) with `onUpdate` subscriptions. We wrap it in a small `useLiveQuery` hook for Octane. Convex Auth is used server-side only for the same reason: its client package is React. The browser side of the token protocol is ours — sign in and sign out are plain `auth:signIn` and `auth:signOut` actions, and the JWT plus refresh token live in `localStorage`.

### Movie data: TMDB

- Source: [TMDB API](https://developer.themoviedb.org). Free for non-commercial use, good fuzzy search, poster CDN with fixed sizes.
- **Search flow:** the client calls a Convex action → the action calls TMDB `/search/movie` → results return with `tmdbId`, title, year, poster path. TMDB handles typos and alternate titles well enough for v1.
- **Caching:** when a member posts a film, the action fetches full details once and writes them to the `films` table. After that, the group never hits TMDB for that film again. TMDB search responses are cached in Convex for 24 h keyed by normalized query, which also keeps us far from rate limits.
- Posters load from the TMDB image CDN at exact display sizes (`w185` in list, `w500` in detail), with `loading="lazy"`.

### Search design

Two different problems, two different tools:

| Scope                 | Data size             | Tool                                                                    |
| --------------------- | --------------------- | ----------------------------------------------------------------------- |
| Inside the group list | ≤ a few hundred films | Client-side word match on the title, ranked by relevance. Zero latency. |
| Movie database        | Millions of films     | TMDB `/search/movie` via Convex action, debounced 200 ms, cached.       |

The group filter splits the query on whitespace and keeps a film only when every word is a substring of its title. Order within the matches is by relevance — a word at the title start scores 100, at a word start 50, anywhere else 10 — and vote rank breaks ties. An empty query scores every film 0, so the list falls back to pure vote rank.

fzf-style subsequence matching was the first implementation and was wrong for this data. A subsequence matcher assumes long strings and typed initials; film titles are short, so almost every query matched almost every title — `"e"` kept all ten films of a test list, `"a"` kept nine. The filter looked broken because it was: one or two characters changed nothing on screen. Substring-per-word is stricter, is what a person typing a title expects, and still finds `"la haine"` from `"haine la"`.

Semantic search is deferred, see [Future work](#future-work). For v1, matching titles is enough: users search by title, not by vibe.

### Type safety and validation

The architecture is type-safe, data-oriented, and functional. Data is plain serializable objects. Logic is pure functions over that data. Side effects sit only at the edges: Convex functions and the DOM.

Validation follows **parse, don't validate**. Raw data never crosses a boundary; each boundary parses input into a domain type once, and everything inside trusts the types.

| Boundary                                | Validator                                             |
| --------------------------------------- | ----------------------------------------------------- |
| Database schema, mutation/query args    | Convex `v` (required by Convex, generates types)      |
| TMDB responses (inside actions)         | **Valibot** schema → domain `Film` type               |
| Route search params (filters, `?film=`) | Valibot via TanStack Router's Standard Schema support |
| Invite tokens, env vars                 | Valibot at startup / entry                            |

Valibot over TypeBox: TanStack Router validates search params through Standard Schema, which Valibot implements natively; and Valibot is modular, so only the schemas used are bundled — this matters for the 80 kB budget. A failed parse throws; there are no silent fallbacks or default-filled records.

### Tooling

- **pnpm** for package management. One lockfile, strict node_modules.
- **TypeScript 7** (native compiler, GA July 2026) in strict mode — 8–12× faster builds than 6.x.
- **Vite** (latest) for dev server and production build, with the Octane compiler plugin.
- **Source files are plain `.tsx`**, not Octane's `.tsrx` dialect. `.tsrx` needs `tsrx-tsc` and a TypeScript language-service plugin, both of which run on the TypeScript 6.x programmatic API and cannot work with TypeScript 7. Octane compiles `.tsx` with no loss of features.
- **Route files import from `@tanstack/react-router`, which Vite and TypeScript both alias to `@octanejs/tanstack-router`.** TanStack's route generator derives the import module from its `target` option (`@tanstack/${target}-router`) and rewrites any route file that does not use that exact specifier. The alias satisfies the generator and still binds every symbol to Octane. Octane's binding packages ship raw source, so they are listed in `optimizeDeps.exclude` under the aliased name; the dev server otherwise pre-bundles them without the Octane compiler and fails to parse `.tsrx`.
- **@octanejs/base-ui** for interactive components (dialog, popover, menu, toggle). Base UI ships unstyled primitives with the accessibility behaviour already correct; all appearance comes from the six design tokens below. No component library brings its own styling into this project. Weigh each primitive against the performance budget before importing it: `Dialog` costs 21 kB gzip and earns it (focus trap, scroll lock, inert background); `Menu` costs 49 kB and did not.
- **`pnpm run typecheck` reports diagnostics for this repository only.** Octane's packages ship raw TypeScript source, so `tsc` compiles them as part of the program, and `skipLibCheck` covers `.d.ts` files only. Those packages do not compile under `noUncheckedIndexedAccess`, which this repository keeps on. `scripts/typecheck.mjs` runs both projects and drops diagnostics whose path starts with `node_modules/`. Any diagnostic in `src/`, `convex/`, or `tests/` still fails the run.
- **oxlint + oxfmt** for lint and format — the Rust Oxc toolchain, ~30× faster than Prettier. Rust tools also sidestep TS 7's not-yet-stable programmatic API, which still blocks typescript-eslint.
- **lefthook** pre-commit hooks: format staged files, `oxlint --fix`, `tsc --noEmit`. The hook keeps every commit clean; nothing unformatted or failing reaches history.
- **Playwright** for end-to-end checks, run at the 375 px viewport against the dev server and the live Convex deployment. There are no unit tests: the risk in this app is the flow across boundaries, not the arithmetic. One spec per user journey.
- Policy: dependencies stay on latest stable. Few dependencies is the first rule; latest versions of the few is the second.
- **Deploy:** frontend as static build on Vercel; backend on a Convex production deployment, separate from dev, with its own environment variables.

## Data model

Convex tables. All lookups go through indexes.

```ts
users        { name?, email?, image?, ... }         // from Convex Auth `authTables`
groups       { name, ownerId, memberLimit }        // memberLimit: 1–25
memberships  { groupId, userId }                    // index: by_group, by_user, by_group_user
invites      { groupId, token, expiresAt, revoked } // index: by_token, by_group
films        { tmdbId, title, year, runtime,
               director, posterPath }               // index: by_tmdbId (global cache)
                                                    // year, runtime, director, posterPath: null when TMDB has none
groupFilms   { groupId, filmId, postedBy,
               score }                              // index: by_group_score, unique (groupId, filmId)
votes        { groupFilmId, userId, value: 1 | -1 } // index: by_groupFilm, unique (groupFilmId, userId)
seenMarks    { groupFilmId, userId }                // index: by_groupFilm, unique (groupFilmId, userId)
```

Post time comes from Convex's built-in `_creationTime`; no table stores its own timestamp.

TMDB does not have a year, a runtime, or a credited director for every film. Those columns are nullable, and the spec line prints only the parts that exist. A missing value is never filled with a placeholder.

`authTables` also brings the session, account, and verification tables that Convex Auth owns. Every field on `users` is optional there, so a display name is required at the sign-up boundary and parsed again on every read: a user row without a name is an error, never a placeholder.

An invite is issued per group and reused while it is live. It expires 7 days after it is issued, and any member can revoke it, which closes every live invite for that group. Redeeming one checks in a single transaction that the token exists, is live, and that the group is below its member limit.

`groupFilms.score` is denormalized. The vote mutation updates the vote row and the score in the same transaction. The main view is then one indexed range read (`by_group_score`), not an aggregation.

## Visual design

Direction in one line: **a Japanese instrument panel for films.** Black is not a background, it is the material. Everything on top of it is either a hairline, a rule of Helvetica, a poster, or a control with a real edge.

### Reference set

Pin these three and nothing else:

1. **[Takram](https://www.takram.com/)** — the governing reference. Rigorous editorial structure, an almost total absence of ornament, monochrome surfaces where the only "color" is the work being shown, and micro-labels used as navigation. Filmates borrows the discipline: a page is a document with sections, not a feed with widgets.
2. **Kenya Hara / MUJI** — reduction as the design act. Nothing is added to make a thing look designed; everything not carrying information is removed. This is the test applied to every element: delete it and see whether meaning is lost.
3. **Swiss industrial control panels** (Müller-Brockmann's grid applied to machinery) — a control is a bordered cell with a legible legend, and pressing it visibly changes its state. This is where the buttons come from.

Counter-reference: **Letterboxd.** Filmates is deliberately not it. No `#14181c` blue-black, no signature green, no rounded cards, no social chrome, no poster-wall density. The earlier palette copied Letterboxd's exact hexes and the result read as a cheap clone; that palette is retired.

### Typography

Helvetica, and only Helvetica.

```css
--font: "Helvetica Now Text", "Neue Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif;
```

- If licensing allows, buy **Neue Haas Grotesk** (Helvetica's origin cut, better at display sizes) or **Helvetica Now**. If not, system `Helvetica Neue` covers every Apple device — most of a friends group's phones — and Arial catches the rest. Zero webfont bytes in the fallback case; this also serves the performance budget.
  Four sizes, and the jumps between them are large. Hierarchy comes from the gap, not from a ramp of near-identical steps.

| Role      | Spec                                                 | Used for                                                |
| --------- | ---------------------------------------------------- | ------------------------------------------------------- |
| Display   | `clamp(24px, 7vw, 34px)` / 700 / −3.5% / uppercase   | Group name, page headings                               |
| Film name | `clamp(22px, 6.4vw, 30px)` / 700 / −3.5% / uppercase | Film titles in the index and the sheet                  |
| Title     | 19 px / 700 / −2% / uppercase                        | Group names in a list                                   |
| Body      | 15 px / 400                                          | Sentences, member names                                 |
| Label     | 10 px / 600 / +14% / uppercase / grey                | Section heads, spec lines, button legends, rank numbers |

- The wordmark is the one exception: 11 px / 700 / **+26%** tracking. Letterspacing, not size, marks it as an identity rather than a heading.
- **Numbers:** tabular lining figures on scores and ranks (`font-variant-numeric: tabular-nums`). They must not jitter when they change.
- No second family. No italic. Weight and size carry all hierarchy.

### Grid and structure

Swiss means the grid is real, not implied.

- Base unit **4 px**; spacing comes from the scale 4 / 8 / 12 / 16 / 20 / 24 / 32 only.
- Page margin **20 px**, content capped at **560 px** and left-aligned in the viewport. The phone layout is the layout; wide screens get the same single column, not a second design.
- **`border-radius: 0` is set in the reset and never overridden.** Nothing in the app is round — not the buttons, not the inputs, not the seen marks. No shadows, ever.
- **Hairlines, not cards.** `--rule` separates rows and closes section heads. `--edge` is reserved for the borders of things you can touch. The two greys are what tells structure apart from control.
- **Sections are labelled and ruled.** Each block opens with a micro-label and a 1 px rule running from it to the right margin: `INDEX ─────`, `MEMBERS ─────`, `INVITE ─────`. This is the whole navigation system; there is no tab bar.
- **Flush left, ragged right.** Nothing is centered except the legend inside a button.
- **The rank is a leader line.** Each row opens with its index number and a rule running the full width beneath it. The films move through fixed numbers when a vote reorders the list.

```
 01 ─────────────────────────────────────
 ┌────┐  HEAT                      ┌────┐
 │post│  1995 · 170 MIN · MANN     │  ▲ │
 │    │                            ├────┤
 │    │                            │  6 │
 │    │                            ├────┤
 └────┘  ■ ■ □ □                   │  ▼ │
                                   └────┘
 02 ─────────────────────────────────────
```

- Metadata reads as a **spec line**: `1995 · 170 MIN · MANN` — uppercase, grey, interpunct-separated, like a plate on industrial equipment. One line, always the same fields, same order.
- The seen marks sit on the **poster baseline**, not floating in the middle of the text column. The title block is at least as tall as the poster so this alignment always holds.

### Posters

Posters are the only images in the app and its only source of color. The palette above stays six tokens _because_ every row carries a poster.

- **In the list:** every row shows a poster at strict 2:3, displayed 64 × 96 px, leading the row. Hard corners. Without it a type-only list reads as a spreadsheet.
- **Source sizes:** TMDB `w154` for list rows (64 px × 2 DPR), `w342` in the bottom sheet (96 px × 2 DPR). Never ship a larger image than the displayed size × DPR.
- **Loading:** `loading="lazy"`, explicit `width`/`height` so rows never shift. Placeholder is a flat `--rule` rectangle — no shimmer, no blur-up.
- **Missing poster** (rare in TMDB): the flat rectangle stays, with the film's initial letter set in the display type, grey. No generic film-reel icon.
- **No treatment:** no rounded corners, no overlay gradients, no text on top of posters, no hover zoom. The poster is a document, not a decoration.
- **Optional second view, v1.1:** a poster-grid mode for the same ranked list (rank number set into the top-left corner of each poster, mark row below). List stays the default.

### Color

| Token      | Value     | Use                                                         |
| ---------- | --------- | ----------------------------------------------------------- |
| `--ground` | `#000000` | The page. True black, not a blue-black                      |
| `--raised` | `#0a0a0a` | The bottom sheet — the one surface that sits above the page |
| `--rule`   | `#1f1f1f` | Hairlines between rows and after section labels             |
| `--edge`   | `#383838` | Borders of controls, and inactive marks and arrows          |
| `--ink`    | `#ffffff` | Primary text, and the fill of a pressed or active control   |
| `--dim`    | `#8a8a8a` | Labels, spec lines, rank numbers, secondary text            |
| `--mark`   | `#e60012` | Seen marks and the seen button. Nothing else, anywhere      |

Seven tokens. The greys are **neutral** — equal parts, no blue cast. Six of the seven are achromatic; `--mark` is the single chromatic value in the app, JIS safety red, and it is spent entirely on one meaning: this film has been seen. Posters supply every other colour on screen.

### Controls

Every interactive thing has a visible edge. This is the rule the old design broke — bare grey text was doing the job of a button.

- **`.button`** — 48 px tall, 1 px `--edge` border, 10 px uppercase legend. Pressing it **inverts**: white fill, black legend. Inversion is the entire feedback mechanism; there is no hover lift, no shadow, no ripple.
- **`.button-primary`** — the same control already inverted. One per screen, and it is the screen's single most important action: `ADD FILM`, `CREATE GROUP`, `JOIN GROUP`, `CREATE ACCOUNT`.
- **`.button-marked`** — filled `--mark`. Used only for `SEEN BY ME`.
- **Segmented control** — the three filters share one bordered box split by hairlines. The active segment is inverted. A filter is a switch, so it looks like a switch.
- **Vote block** — a single bordered instrument, 44 px wide: up cell, score cell, down cell, divided by hairlines. The active direction inverts. Two loose glyphs floating on the background were not a control.
- **Inputs** — 48 px tall, fully bordered in `--edge`, border goes `--ink` on focus. Their label sits above in micro-type.
- **Focus** — a 1 px `--ink` outline at 2 px offset on `:focus-visible`. Never removed.

### Detail rules (industrial finish)

- **Words over icons.** Every control is legible text: `ALL / UNSEEN BY ME / SEEN BY ALL`, `ADD FILM`, `MARK SEEN`, `REVOKE`. The only glyphs in the app are the vote arrows `▲▼`. There is no search icon — the field says `Search films`.
- **Declarative microcopy:** short, exact, no exclamation marks, no emoji. Empty group: `No films yet. Add the first.` Full group: `This group is full.`
- **State is inversion, not decoration.** An active control swaps its foreground and background. Nothing gets a badge, a pill, or a glow.
- **Seen marks are squares**, 7 px, `--edge` when unseen and `--mark` when seen. One per member. They are display, never a target.
- **Posters are rectangles.** 2:3, hard corners, no overlay gradients. Marks and scores never sit on top of a poster.

### Motion

Mechanical, not organic. Motion confirms cause and effect; it never entertains.

- Rank reorder after a vote: 200 ms, `ease-out`, position only. This is the one meaningful animation in the app — a vote visibly moves a film through the fixed rank numbers.
- Everything else: ≤ 120 ms opacity/color, or instant. No spring physics, no bounce, no parallax, no skeleton shimmer (live queries make loading states rare and short).

### Phone ergonomics

The phone layout is the only layout. It is designed at 375 px and checked there before anything else.

- One column. Buttons are 48 px, other targets never below 44 px.
- **The primary action lives in a fixed bar at the bottom of the viewport**, inside the thumb arc, and the page reserves padding so it never covers the last row. Only the group page has one; it holds `ADD FILM`.
- The vote block sits on the right edge of a row, opposite the poster. It is reached by the thumb without covering the title.
- Film detail opens as a bottom sheet, not a route change; the URL still updates (`/g/$groupId?film=…`) so it survives share and refresh. The sheet holds the `w342` poster, the title, the specification line, the vote block, the seen button, the names of the members who have seen the film, and a real `CLOSE` button.

## Performance budget

| Metric                              | Target                | Measured |
| ----------------------------------- | --------------------- | -------- |
| JS shipped (main route, gzip)       | < 105 kB              | 99.85 kB |
| Deferred JS (film sheet, gzip)      | off the critical path | 20.57 kB |
| LCP, 4G phone                       | < 1.5 s               |          |
| Vote/seen tap → visible change      | < 50 ms (optimistic)  |          |
| Update propagation to other members | < 500 ms              |          |

The main-route target was 80 kB until M7 measured the floor. Sourcemap byte attribution of the production build gives, in raw bytes before app code: `octane/dist` 133 kB, `convex/dist` 65 kB, `@tanstack/router-core` 55 kB, `@octanejs/tanstack-router` 23 kB, `valibot/dist` 5 kB, `@tanstack/history` 4 kB, `@tanstack/store` 4 kB — about 89 kB gzip of vendor code that no amount of app-side work removes. Development branches are confirmed stripped. 80 kB was not reachable with this stack; 105 kB is the measured floor plus room for one more feature.

How we stay inside it: Octane's compiled output (no VDOM, no framework runtime cost), the film sheet behind `lazy` with a `requestIdleCallback` prefetch, `Link` preloading on intent, denormalized score (no client aggregation), poster lazy loading at exact sizes.

Route-level code splitting was measured and rejected: `autoCodeSplitting` moved 5.2 kB of other-route code out of the main bundle but added ~9 kB of chunk-boundary overhead, taking the main route to 103.89 kB gzip. Splitting the film sheet works because the sheet is genuinely optional; splitting sibling routes does not, because the router loads them anyway.

## Alternatives considered

- **Supabase / Firebase instead of Convex.** Both give live data. Supabase realtime needs channel plumbing and row-level-security care; Firestore makes the transactional rules (member limit, one vote per user) awkward. Convex mutations-as-transactions plus typed live queries is the smallest correct implementation. Kept Convex.
- **React instead of Octane.** Safe and boring, but slower runtime and the stated goal is speed. Octane keeps React's model, has the TanStack Router binding we want, and OctaneCompat de-risks the ecosystem gap. Kept Octane.
- **Semantic search in v1.** Embeddings + Convex vector search works, but it solves a discovery problem the product does not have yet. Cut from v1.
- **Storing movies ourselves (weekly TMDB dump).** Full control and offline search, but adds ingestion jobs and ~1 GB of data for a v1 that a search endpoint already serves. Rejected for now; the `films` cache table leaves the door open.
- **TypeBox instead of Valibot.** TypeBox compiles JSON Schema and is faster at raw throughput, but it lacks native Standard Schema support for TanStack Router and bundles larger for our few small schemas. Parse speed is not our bottleneck; bundle size is budgeted. Kept Valibot.
- **Letterboxd API.** Access is gated and the product does not need reviews/diary data. Rejected.

## Future work

- **Google sign-in and email OTP.** Both are one provider entry in `convex/auth.ts`, but Google needs OAuth credentials from the Google Cloud console and OTP needs a mail vendor key. Password sign-in ships first because it needs neither.
- **Semantic search:** embed `title + overview + genres` for cached films, store in a Convex vector index, and let the search field answer queries like "slow sci-fi from the 70s". This layers on top of the existing action without schema changes.
- Watch-night scheduling (pick a date, attach the top unseen film).
- "Seen it" import from Letterboxd CSV export.
- Light theme.

## Open questions

1. Exact member-limit ceiling `X` — is 25 right, or should the creator choose freely?
2. Should a downvoted film below a threshold (e.g. score ≤ −3) auto-archive?
3. TV series: TMDB supports them via `/search/tv`. In scope for v1 or not?
4. Group deletion and data retention when the owner leaves.

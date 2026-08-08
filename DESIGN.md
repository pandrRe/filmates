# RFD 001 — Filmates

| Field | Value |
|---|---|
| State | draft |
| Authors | pandrre |
| Date | 2026-08-07 |
| Format | [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/), header per [Oxide RFD](https://rfd.shared.oxide.computer/rfd/0001) |

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
- Search is fuzzy, both inside the group list and against the movie database.
- All state updates are live. No refresh button.
- The app is fast: first load under ~1.5 s on 4G, interactions under 100 ms.
- The UI works one-handed on a phone.

## Non-goals

- No public profiles, no discovery feed, no follow graph.
- No reviews, ratings out of 5, or comments (v1).
- No semantic ("vibe") search in v1. See [Future work](#future-work).
- No native app. The web app is installable (PWA) instead.

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
┌──────────────────────────────────────────┐
│ FILMATES        ⌕ search        [group ▾]│
├──────────────────────────────────────────┤
│ ▲ 6  ┌────┐  HEAT                        │
│ ▼    │post│  1995 · 170 MIN · MANN       │
│      └────┘  ●●●○○                       │
├──────────────────────────────────────────┤
│ ▲ 4  ┌────┐  LA HAINE                    │
│ ▼    │post│  1995 · 98 MIN · KASSOVITZ   │
│      └────┘  ●●○○○                       │
└──────────────────────────────────────────┘
```

- Sort: score descending. Tie-break: oldest post first.
- The dot row shows one icon per member. Green = seen. Grey = not seen. Tap the row to see names.
- Filters: `All · Unseen by me · Seen by all`. "Seen by all" is the watch-next shortlist in reverse: it shows what the group can retire.
- The search field filters the group list with fuzzy matching as the user types. The same field offers "Search the movie database →" as the last result row, which jumps to the add-film flow.

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
- Routes: `/` (group list → redirect to last group), `/g/$groupId` (main view), `/g/$groupId/add`, `/join/$token`, `/settings`.
- Filter and search state live in the URL as validated search params. A shared link reproduces the exact view.
- PWA: manifest + service worker for install and instant repeat loads. App shell is cached; data is never cached stale — live queries own the data.
- Risk note: Octane is new (production-ready for web, but a young ecosystem). The escape hatch is `octane/react` (OctaneCompat), which runs React libraries unchanged.

### Backend: Convex

Convex is the right fit and we keep it:

- **Live queries** push vote and seen changes to all group members over WebSocket. This is the core product feel, and we get it with zero infrastructure.
- **Mutations are transactions.** The join-with-member-limit check and the one-post-per-film rule are single mutations with no race conditions.
- **Actions** call TMDB from the server. The TMDB key never reaches the client.
- **Auth:** Convex Auth with Google + email OTP. One vendor fewer than Clerk; enough for a friends app.

Convex has no official Octane binding. The fix is small: Convex ships a framework-agnostic client (`ConvexClient` in `convex/browser`) with `onUpdate` subscriptions. We wrap it in a ~30-line `useLiveQuery` hook for Octane. If that stalls, OctaneCompat can run Convex's React hooks as-is.

### Movie data: TMDB

- Source: [TMDB API](https://developer.themoviedb.org). Free for non-commercial use, good fuzzy search, poster CDN with fixed sizes.
- **Search flow:** the client calls a Convex action → the action calls TMDB `/search/movie` → results return with `tmdbId`, title, year, poster path. TMDB handles typos and alternate titles well enough for v1.
- **Caching:** when a member posts a film, the action fetches full details once and writes them to the `films` table. After that, the group never hits TMDB for that film again. TMDB search responses are cached in Convex for 24 h keyed by normalized query, which also keeps us far from rate limits.
- Posters load from the TMDB image CDN at exact display sizes (`w185` in list, `w500` in detail), with `loading="lazy"`.

### Search design

Two different problems, two different tools:

| Scope | Data size | Tool |
|---|---|---|
| Inside the group list | ≤ a few hundred films | Client-side fuzzy match (fzf-style subsequence scoring, ~50 lines, no dependency). Zero latency. |
| Movie database | Millions of films | TMDB `/search/movie` via Convex action, debounced 200 ms, cached. |

Semantic search is deferred, see [Future work](#future-work). For v1, fuzzy is enough: users search by title, not by vibe.

### Type safety and validation

The architecture is type-safe, data-oriented, and functional. Data is plain serializable objects. Logic is pure functions over that data. Side effects sit only at the edges: Convex functions and the DOM.

Validation follows **parse, don't validate**. Raw data never crosses a boundary; each boundary parses input into a domain type once, and everything inside trusts the types.

| Boundary | Validator |
|---|---|
| Database schema, mutation/query args | Convex `v` (required by Convex, generates types) |
| TMDB responses (inside actions) | **Valibot** schema → domain `Film` type |
| Route search params (filters, `?film=`) | Valibot via TanStack Router's Standard Schema support |
| Invite tokens, env vars | Valibot at startup / entry |

Valibot over TypeBox: TanStack Router validates search params through Standard Schema, which Valibot implements natively; and Valibot is modular, so only the schemas used are bundled — this matters for the 80 kB budget. A failed parse throws; there are no silent fallbacks or default-filled records.

### Tooling

- **pnpm** for package management. One lockfile, strict node_modules.
- **TypeScript 7** (native compiler, GA July 2026) in strict mode — 8–12× faster builds than 6.x.
- **Vite** (latest) for dev server and production build, with the Octane compiler plugin.
- **oxlint + oxfmt** for lint and format — the Rust Oxc toolchain, ~30× faster than Prettier. Rust tools also sidestep TS 7's not-yet-stable programmatic API, which still blocks typescript-eslint.
- **lefthook** pre-commit hooks: format staged files, `oxlint --fix`, `tsc --noEmit`. The hook keeps every commit clean; nothing unformatted or failing reaches history.
- Policy: dependencies stay on latest stable. Few dependencies is the first rule; latest versions of the few is the second.

## Data model

Convex tables. All lookups go through indexes.

```ts
users        { name, image, authId }
groups       { name, ownerId, memberLimit }        // memberLimit: 1–25
memberships  { groupId, userId }                    // index: by_group, by_user
invites      { groupId, token, expiresAt, revoked } // index: by_token
films        { tmdbId, title, year, runtime,
               director, posterPath }               // index: by_tmdbId (global cache)
groupFilms   { groupId, filmId, postedBy, postedAt,
               score }                              // index: by_group_score, unique (groupId, filmId)
votes        { groupFilmId, userId, value: 1 | -1 } // index: by_groupFilm, unique (groupFilmId, userId)
seenMarks    { groupFilmId, userId }                // index: by_groupFilm, unique (groupFilmId, userId)
```

`groupFilms.score` is denormalized. The vote mutation updates the vote row and the score in the same transaction. The main view is then one indexed range read (`by_group_score`), not an aggregation.

## Visual design

Direction in one line: **a Swiss industrial index of films.** Letterboxd supplies the dark ground and the density. Porto Rocha supplies the attitude: typographic confidence, utilitarian structure, work that "has a presence" ([It's Nice That](https://www.itsnicethat.com/articles/porto-rocha-museu-nacional-identity-graphic-design-030720)). The International Typographic Style supplies the rules: grid, Helvetica, flush left, no decoration.

### Reference set

Pin these three and nothing else:

1. **[portorocha.com](https://www.portorocha.com/)** — the studio's own site is the closest reference to what Filmates should feel like: a grid-based index list, uppercase micro-labels, minimal tags, declarative one-line descriptions ("Winning back audience trust"), imagery doing all the color work. Filmates' main view is exactly this pattern — an index of films instead of an index of projects.
2. **Porto Rocha for [live](https://the-brandidentity.com/project/porto-rocha-embrace-times-new-roman-pared-back-identity-post-digital-agency-live)** — proof of the pared-back move: one system typeface, stripped ornament, tone carried entirely by typesetting. We do the same move with Helvetica instead of Times.
3. **Letterboxd** — the `#14181c` dark ground, the poster-forward density, the green. What we take is the surface; what we drop is the rounded-card social-app chrome.

Counter-reference: Porto Rocha's [Tudum for Netflix Brazil](https://the-brandidentity.com/project/porto-rocha-devise-maximalist-vibrant-unpredictable-identity-netflix-brazils-tudum) shows the studio's maximalist register. Filmates does **not** go there. We take the rigor, not the noise.

### Typography

Helvetica, and only Helvetica.

```css
--font: "Helvetica Now Text", "Neue Haas Grotesk",
        "Helvetica Neue", Helvetica, Arial, sans-serif;
```

- If licensing allows, buy **Neue Haas Grotesk** (Helvetica's origin cut, better at display sizes) or **Helvetica Now**. If not, system `Helvetica Neue` covers every Apple device — most of a friends group's phones — and Arial catches the rest. Zero webfont bytes in the fallback case; this also serves the performance budget.
- **Display (film titles):** uppercase, bold (700), tight tracking (−2%), size `clamp(20px, 5vw, 28px)` in the list. Titles are the interface.
- **Text (metadata, UI):** regular (400/500), sentence case, 13–15 px, tracking normal.
- **Micro-labels (section heads, filters):** 11 px, uppercase, +8% tracking, grey — the Porto Rocha index label: `UNSEEN BY ME`, `SEEN BY ALL`.
- **Numbers:** tabular lining figures everywhere (`font-variant-numeric: tabular-nums`). Scores and rank numbers must not jitter when they change.
- No second family. No italic. Weight and size carry all hierarchy.

### Grid and structure

Swiss means the grid is real, not implied.

- Base unit **4 px**; all spacing is a multiple of it.
- Phone: 4-column grid, 16 px margins. ≥ 768 px: 12 columns, max content width 1100 px, the list keeps a single column but gains a wider poster and a visible rank column.
- **Hairlines, not cards.** 1 px rules in `#2c3440` separate rows. No border radius anywhere except avatars (full circle). No shadows, ever.
- **Flush left, ragged right.** Nothing is centered — not titles, not empty states, not modals.
- **The rank is typography.** Each row leads with its index number — `01`, `02`, `03` — set in the display weight, grey, like a Müller-Brockmann program listing. The score sits with the vote arrows. When ranks change, the numbers stay fixed to position and the films move through them.

```
 01  ▲ 6  ┌────┐  HEAT
     ▼    │post│  1995 · 170 MIN · MANN
          └────┘  ●●●○○
 ─────────────────────────────────────────
 02  ▲ 4  ┌────┐  LA HAINE
     ▼    │post│  1995 · 98 MIN · KASSOVITZ
          └────┘  ●●○○○
```

- Metadata reads as a **spec line**: `1995 · 170 MIN · MANN` — uppercase, grey, interpunct-separated, like a plate on industrial equipment. One line, always the same fields, same order.

### Posters

Posters are the only images in the app and its only source of color. The palette above stays six tokens *because* every row carries a poster.

- **In the list:** every row shows a poster at strict 2:3, displayed 48 × 72 px (56 × 84 px ≥ 768 px), between the vote column and the title block. Hard corners. This is the Letterboxd half of the identity — a type-only list would read as a spreadsheet.
- **Source sizes:** TMDB `w92` for list rows, `w342` in the bottom sheet, `w500` only on ≥ 768 px detail. Never ship a larger image than the displayed size × DPR.
- **Loading:** `loading="lazy"`, explicit `width`/`height` so rows never shift. Placeholder is a flat `--rule` rectangle — no shimmer, no blur-up.
- **Missing poster** (rare in TMDB): the flat rectangle stays, with the film's initial letter set in the display type, grey. No generic film-reel icon.
- **No treatment:** no rounded corners, no overlay gradients, no text on top of posters, no hover zoom. The poster is a document, not a decoration.
- **Optional second view, v1.1:** a poster-grid mode for the same ranked list (rank number set into the top-left corner of each poster, dot row below). List stays the default.

### Color

| Token | Value | Use |
|---|---|---|
| `--ground` | `#14181c` | Background (Letterboxd tone) |
| `--ink` | `#eaf0f4` | Primary text |
| `--muted` | `#8899a6` | Metadata, labels, rank numbers, unseen dots |
| `--rule` | `#2c3440` | Hairlines |
| `--seen` | `#00e054` | Seen dots, active upvote, positive score |
| `--down` | `#8899a6` | Active downvote — grey, not red; a downvote is a preference, not an alarm |

Six tokens, dark only. Posters are the only images and the only saturation. UI never competes with them.

### Detail rules (industrial finish)

- **Words over icons.** Filters are text (`ALL / UNSEEN BY ME / SEEN BY ALL`), not glyphs. The only glyphs are the vote arrows `▲▼` (typographic, not custom icons), the seen dots, and the search `⌕`.
- **Declarative microcopy**, Porto Rocha register: short, exact, no exclamation marks, no emoji. Empty group: `No films yet. Add the first.` Full group: `This group is full.`
- **State is color, not decoration.** An active upvote turns the arrow green. A seen dot turns green. Nothing gets a badge, a pill, or a glow.
- **Posters are rectangles.** 2:3, hard corners, no overlay gradients. The dot row and score never sit on top of the poster.

### Motion

Mechanical, not organic. Motion confirms cause and effect; it never entertains.

- Rank reorder after a vote: 200 ms, `ease-out`, position only. This is the one meaningful animation in the app — a vote visibly moves a film through the fixed rank numbers.
- Everything else: ≤ 120 ms opacity/color, or instant. No spring physics, no bounce, no parallax, no skeleton shimmer (live queries make loading states rare and short).

### Phone ergonomics

- One column. Vote arrows on the left edge, inside thumb reach; the dot row on the right is display, not a target.
- Tap targets ≥ 44 px even where the visual mark is smaller (arrows get invisible padding).
- Film detail opens as a bottom sheet, not a route change; the URL still updates (`/g/$groupId?film=…`) so it survives share and refresh.

## Performance budget

| Metric | Target |
|---|---|
| JS shipped (main route, gzip) | < 80 kB |
| LCP, 4G phone | < 1.5 s |
| Vote/seen tap → visible change | < 50 ms (optimistic) |
| Update propagation to other members | < 500 ms |

How we stay inside it: Octane's compiled output (no VDOM, no framework runtime cost), route-level code splitting, `Link` preloading on intent, denormalized score (no client aggregation), poster lazy loading at exact sizes, PWA shell cache for repeat visits.

## Alternatives considered

- **Supabase / Firebase instead of Convex.** Both give live data. Supabase realtime needs channel plumbing and row-level-security care; Firestore makes the transactional rules (member limit, one vote per user) awkward. Convex mutations-as-transactions plus typed live queries is the smallest correct implementation. Kept Convex.
- **React instead of Octane.** Safe and boring, but slower runtime and the stated goal is speed. Octane keeps React's model, has the TanStack Router binding we want, and OctaneCompat de-risks the ecosystem gap. Kept Octane.
- **Semantic search in v1.** Embeddings + Convex vector search works, but it solves a discovery problem the product does not have yet. Cut from v1.
- **Storing movies ourselves (weekly TMDB dump).** Full control and offline search, but adds ingestion jobs and ~1 GB of data for a v1 that a search endpoint already serves. Rejected for now; the `films` cache table leaves the door open.
- **TypeBox instead of Valibot.** TypeBox compiles JSON Schema and is faster at raw throughput, but it lacks native Standard Schema support for TanStack Router and bundles larger for our few small schemas. Parse speed is not our bottleneck; bundle size is budgeted. Kept Valibot.
- **Letterboxd API.** Access is gated and the product does not need reviews/diary data. Rejected.

## Future work

- **Semantic search:** embed `title + overview + genres` for cached films, store in a Convex vector index, and let the search field answer queries like "slow sci-fi from the 70s". This layers on top of the existing action without schema changes.
- Watch-night scheduling (pick a date, attach the top unseen film).
- "Seen it" import from Letterboxd CSV export.
- Light theme.

## Open questions

1. Exact member-limit ceiling `X` — is 25 right, or should the creator choose freely?
2. Should a downvoted film below a threshold (e.g. score ≤ −3) auto-archive?
3. TV series: TMDB supports them via `/search/tv`. In scope for v1 or not?
4. Group deletion and data retention when the owner leaves.

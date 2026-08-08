import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "octane";
import * as valibot from "valibot";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { GroupFilm } from "../../convex/films";
import type { Member } from "../../convex/users";
import type { Vote } from "../../convex/votes";
import { readSession } from "../authentication/session";
import { convexClient } from "../convex/client";
import { useLiveQuery } from "../convex/useLiveQuery";
import { describeError } from "../describeError";
import { FilmPoster } from "../films/FilmPoster";
import { LazyFilmSheet, prefetchFilmSheet } from "../films/LazyFilmSheet";
import { matchTitle } from "../films/search";
import { SeenMarks } from "../films/SeenMarks";
import { filmSpecification } from "../films/specification";
import { useRankReorder } from "../films/useRankReorder";
import { VoteColumn } from "../films/VoteColumn";

const FilmFilter = valibot.picklist(["all", "unseenByMe", "seenByAll"]);

type Filter = valibot.InferOutput<typeof FilmFilter>;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unseenByMe", label: "Unseen by me" },
  { value: "seenByAll", label: "Seen by all" },
];

const GroupSearch = valibot.object({
  filter: valibot.optional(FilmFilter, "all"),
  query: valibot.optional(valibot.pipe(valibot.string(), valibot.maxLength(80)), ""),
  film: valibot.optional(valibot.pipe(valibot.string(), valibot.maxLength(64))),
});

export const Route = createFileRoute("/g/$groupId/")({
  validateSearch: GroupSearch,
  beforeLoad: ({ params }) => {
    if (readSession().status === "signedOut") {
      throw redirect({ to: "/sign-in", search: { next: `/g/${params.groupId}` } });
    }
  },
  component: GroupPage,
});

function GroupPage() {
  const { groupId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const group = useLiveQuery(api.groups.get, { groupId });

  return (
    <>
      <main class="page">
        <header class="masthead">
          <Link class="wordmark" to="/">
            Filmates
          </Link>
        </header>

        {group.status === "loading" && <p class="muted">Loading</p>}
        {group.status === "failed" && <p class="failure">{group.message}</p>}
        {group.status === "ready" && (
          <>
            <div class="subject">
              <h1 class="display">{group.value.name}</h1>
              <p class="label">
                {group.value.memberCount} / {group.value.memberLimit} members
              </p>
            </div>

            <div class="section">
              <label class="search-field">
                <input
                  class="search"
                  type="search"
                  value={search.query}
                  placeholder="Search films"
                  aria-label="Search films"
                  autoComplete="off"
                  maxLength={80}
                  onInput={(event) => {
                    const query = event.currentTarget.value;
                    void navigate({
                      search: (previous) => ({ ...previous, query }),
                      replace: true,
                    });
                  }}
                />
              </label>

              <nav class="segmented">
                {FILTERS.map((filter) => (
                  <button
                    class="segment"
                    key={filter.value}
                    type="button"
                    aria-pressed={filter.value === search.filter}
                    onClick={() => {
                      void navigate({
                        search: (previous) => ({ ...previous, filter: filter.value }),
                        replace: true,
                      });
                    }}
                  >
                    {filter.label}
                  </button>
                ))}
              </nav>
            </div>

            <FilmList
              groupId={groupId}
              members={group.value.members}
              filter={search.filter}
              query={search.query}
              openFilm={search.film}
            />

            <section class="section">
              <p class="section-head">
                <span class="label">Members</span>
              </p>
              <ul class="entries">
                {group.value.members.map((member) => (
                  <li class="entry" key={member.id}>
                    <span>{member.name}</span>
                    {member.id === group.value.ownerId && <span class="label">Owner</span>}
                  </li>
                ))}
              </ul>
            </section>

            <InvitePanel groupId={group.value.id} />
          </>
        )}
      </main>

      {group.status === "ready" && (
        <div class="action-bar">
          <div class="action-bar-inner">
            <Link
              class="button button-primary button-wide"
              to="/g/$groupId/add"
              params={{ groupId }}
              search={{ title: "" }}
            >
              Add film
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function keeps(groupFilm: GroupFilm, filter: Filter, memberCount: number): boolean {
  if (filter === "unseenByMe") {
    return !groupFilm.mySeen;
  }
  if (filter === "seenByAll") {
    return groupFilm.seenBy.length === memberCount;
  }
  return true;
}

type RankedFilm = { groupFilm: GroupFilm; rank: number; relevance: number };

function rankFilms(
  films: Array<GroupFilm>,
  filter: Filter,
  memberCount: number,
  query: string,
): Array<RankedFilm> {
  return films
    .map((groupFilm, index) => ({ groupFilm, rank: index + 1 }))
    .filter((entry) => keeps(entry.groupFilm, filter, memberCount))
    .flatMap((entry) => {
      const match = matchTitle(entry.groupFilm.film.title, query);
      return match.status === "matched" ? [{ ...entry, relevance: match.relevance }] : [];
    })
    .toSorted((left, right) => right.relevance - left.relevance || left.rank - right.rank);
}

function FilmList(props: {
  groupId: string;
  members: Array<Member>;
  filter: Filter;
  query: string;
  openFilm: string | undefined;
}) {
  const films = useLiveQuery(api.films.listForGroup, { groupId: props.groupId });
  const navigate = useNavigate({ from: Route.fullPath });
  const list = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    const idle = window.requestIdleCallback(prefetchFilmSheet);
    return () => window.cancelIdleCallback(idle);
  }, []);

  function showFilm(film: string | undefined) {
    void navigate({ search: (previous) => ({ ...previous, film }), replace: true });
  }

  if (films.status === "loading") {
    return <p class="muted">Loading</p>;
  }
  if (films.status === "failed") {
    return <p class="failure">{films.message}</p>;
  }
  if (films.value.length === 0) {
    return <p class="muted">No films yet. Add the first.</p>;
  }

  const ranked = rankFilms(films.value, props.filter, props.members.length, props.query);

  useRankReorder(list, ranked.map((entry) => entry.groupFilm.id).join(","));

  return (
    <section class="section">
      <p class="section-head">
        <span class="label">Index</span>
      </p>
      {ranked.length === 0 && <p class="muted">Nothing matches.</p>}
      <ol class="rows" ref={list}>
        {ranked.map((entry) => (
          <FilmRow
            key={entry.groupFilm.id}
            groupFilm={entry.groupFilm}
            rank={entry.rank}
            members={props.members}
            open={entry.groupFilm.id === props.openFilm}
            onOpen={() => showFilm(entry.groupFilm.id)}
            onClose={() => showFilm(undefined)}
          />
        ))}
      </ol>
      {props.query.trim().length > 0 && (
        <Link
          class="button button-wide"
          to="/g/$groupId/add"
          params={{ groupId: props.groupId }}
          search={{ title: props.query }}
        >
          Search the film database
        </Link>
      )}
    </section>
  );
}

function FilmRow(props: {
  groupFilm: GroupFilm;
  rank: number;
  members: Array<Member>;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [castVote, setCastVote] = useState<Vote | null>(null);
  const [markedSeen, setMarkedSeen] = useState<boolean | null>(null);

  const vote = castVote ?? props.groupFilm.myVote;
  const score = props.groupFilm.score + scoreDelta(props.groupFilm.myVote, vote);
  const seen = markedSeen ?? props.groupFilm.mySeen;

  async function cast(direction: "up" | "down") {
    setCastVote(direction === vote ? "none" : direction);
    try {
      await convexClient.mutation(api.votes.cast, { groupFilmId: props.groupFilm.id, direction });
    } finally {
      setCastVote(null);
    }
  }

  async function toggleSeen() {
    setMarkedSeen(!seen);
    try {
      await convexClient.mutation(api.seenMarks.toggle, { groupFilmId: props.groupFilm.id });
    } finally {
      setMarkedSeen(null);
    }
  }

  return (
    <li class="film-row" data-film={props.groupFilm.id}>
      <p class="rank-line">
        <span class="rank">{rankNumber(props.rank)}</span>
      </p>
      <div class="film-body">
        <button
          class="film-open"
          type="button"
          aria-label={`Open ${props.groupFilm.film.title}`}
          onClick={props.onOpen}
        >
          <FilmPoster
            size="row"
            title={props.groupFilm.film.title}
            posterPath={props.groupFilm.film.posterPath}
          />
          <span class="film-text">
            <span class="film-name">{props.groupFilm.film.title}</span>
            <span class="label">{filmSpecification(props.groupFilm.film)}</span>
            <SeenMarks members={props.members} seenBy={props.groupFilm.seenBy} />
          </span>
        </button>
        <VoteColumn
          title={props.groupFilm.film.title}
          vote={vote}
          score={score}
          onVote={(direction) => void cast(direction)}
        />
      </div>
      {props.open && (
        <LazyFilmSheet
          groupFilm={props.groupFilm}
          members={props.members}
          vote={vote}
          score={score}
          seen={seen}
          onVote={(direction) => void cast(direction)}
          onToggleSeen={() => void toggleSeen()}
          onClose={props.onClose}
        />
      )}
    </li>
  );
}

function rankNumber(rank: number): string {
  return String(rank).padStart(2, "0");
}

function scoreDelta(from: Vote, to: Vote): number {
  return voteWeight(to) - voteWeight(from);
}

function voteWeight(vote: Vote): number {
  if (vote === "up") {
    return 1;
  }
  return vote === "down" ? -1 : 0;
}

function InvitePanel(props: { groupId: Id<"groups"> }) {
  const [link, setLink] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function issue() {
    setFailure(null);
    try {
      const token = await convexClient.mutation(api.invites.issue, { groupId: props.groupId });
      const inviteLink = new URL(`/join/${token}`, window.location.origin).toString();
      setLink(inviteLink);
      await window.navigator.clipboard.writeText(inviteLink);
    } catch (error) {
      setFailure(describeError(error));
    }
  }

  async function revoke() {
    setFailure(null);
    try {
      await convexClient.mutation(api.invites.revoke, { groupId: props.groupId });
      setLink(null);
    } catch (error) {
      setFailure(describeError(error));
    }
  }

  return (
    <section class="section">
      <p class="section-head">
        <span class="label">Invite</span>
      </p>
      {link !== null && <p class="invite-link">{link}</p>}
      {failure !== null && <p class="failure">{failure}</p>}
      <div class="buttons">
        <button class="button button-wide" type="button" onClick={() => void issue()}>
          Copy invite link
        </button>
        <button class="button" type="button" onClick={() => void revoke()}>
          Revoke
        </button>
      </div>
    </section>
  );
}

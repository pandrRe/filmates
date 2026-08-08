import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "octane";
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
import { filmSpecification } from "../films/specification";

export const Route = createFileRoute("/g/$groupId/")({
  beforeLoad: ({ params }) => {
    if (readSession().status === "signedOut") {
      throw redirect({ to: "/sign-in", search: { next: `/g/${params.groupId}` } });
    }
  },
  component: GroupPage,
});

function GroupPage() {
  const { groupId } = Route.useParams();
  const group = useLiveQuery(api.groups.get, { groupId });

  return (
    <main class="page">
      <header class="page-head">
        <Link class="label" to="/">
          Groups
        </Link>
        <Link class="label" to="/g/$groupId/add" params={{ groupId }}>
          Add film
        </Link>
      </header>

      {group.status === "loading" && <p class="muted">Loading</p>}
      {group.status === "failed" && <p class="failure">{group.message}</p>}
      {group.status === "ready" && (
        <>
          <h1 class="wordmark">{group.value.name}</h1>
          <FilmList groupId={groupId} members={group.value.members} />
          <section class="panel">
            <p class="label">
              Members {group.value.memberCount} / {group.value.memberLimit}
            </p>
            <ul class="rows">
              {group.value.members.map((member) => (
                <li class="row" key={member.id}>
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
  );
}

function FilmList(props: { groupId: string; members: Array<Member> }) {
  const films = useLiveQuery(api.films.listForGroup, { groupId: props.groupId });

  if (films.status === "loading") {
    return <p class="muted">Loading</p>;
  }
  if (films.status === "failed") {
    return <p class="failure">{films.message}</p>;
  }
  if (films.value.length === 0) {
    return <p class="muted">No films yet. Add the first.</p>;
  }

  return (
    <ol class="rows">
      {films.value.map((groupFilm, index) => (
        <FilmRow
          key={groupFilm.id}
          groupFilm={groupFilm}
          rank={index + 1}
          members={props.members}
        />
      ))}
    </ol>
  );
}

function FilmRow(props: { groupFilm: GroupFilm; rank: number; members: Array<Member> }) {
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
    <li class="film-row">
      <span class="votes">
        <button
          class={vote === "up" ? "arrow arrow-active" : "arrow"}
          type="button"
          aria-label={`Vote up ${props.groupFilm.film.title}`}
          aria-pressed={vote === "up"}
          onClick={() => void cast("up")}
        >
          ▲
        </button>
        <span class="score">{score}</span>
        <button
          class={vote === "down" ? "arrow arrow-active" : "arrow"}
          type="button"
          aria-label={`Vote down ${props.groupFilm.film.title}`}
          aria-pressed={vote === "down"}
          onClick={() => void cast("down")}
        >
          ▼
        </button>
      </span>
      <span class="rank">{props.rank}</span>
      <FilmPoster title={props.groupFilm.film.title} posterPath={props.groupFilm.film.posterPath} />
      <span class="film-title">
        <span>{props.groupFilm.film.title}</span>
        <span class="label">{filmSpecification(props.groupFilm.film)}</span>
        <SeenDots members={props.members} seenBy={props.groupFilm.seenBy} />
      </span>
      <button
        class="label"
        type="button"
        aria-label={`Seen ${props.groupFilm.film.title}`}
        aria-pressed={seen}
        onClick={() => void toggleSeen()}
      >
        Seen
      </button>
    </li>
  );
}

function SeenDots(props: { members: Array<Member>; seenBy: Array<Id<"users">> }) {
  return (
    <span class="dots">
      {props.members.map((member) => (
        <span
          key={member.id}
          class={props.seenBy.includes(member.id) ? "dot dot-seen" : "dot"}
          title={member.name}
        />
      ))}
    </span>
  );
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
    <section class="panel">
      <p class="label">Invite</p>
      {link !== null && <p class="invite-link">{link}</p>}
      {failure !== null && <p class="failure">{failure}</p>}
      <div class="actions">
        <button class="action" type="button" onClick={() => void issue()}>
          Copy invite link
        </button>
        <button class="label" type="button" onClick={() => void revoke()}>
          Revoke
        </button>
      </div>
    </section>
  );
}

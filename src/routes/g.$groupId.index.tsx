import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "octane";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
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
          <FilmList groupId={groupId} />
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

function FilmList(props: { groupId: string }) {
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
        <li class="film-row" key={groupFilm.id}>
          <span class="rank">{index + 1}</span>
          <FilmPoster title={groupFilm.film.title} posterPath={groupFilm.film.posterPath} />
          <span class="film-title">
            <span>{groupFilm.film.title}</span>
            <span class="label">{filmSpecification(groupFilm.film)}</span>
          </span>
          <span class="score">{groupFilm.score}</span>
        </li>
      ))}
    </ol>
  );
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

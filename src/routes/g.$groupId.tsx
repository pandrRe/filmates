import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "octane";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { readSession } from "../authentication/session";
import { convexClient } from "../convex/client";
import { useLiveQuery } from "../convex/useLiveQuery";
import { describeError } from "../describeError";

export const Route = createFileRoute("/g/$groupId")({
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
      </header>

      {group.status === "loading" && <p class="muted">Loading</p>}
      {group.status === "failed" && <p class="failure">{group.message}</p>}
      {group.status === "ready" && (
        <>
          <h1 class="wordmark">{group.value.name}</h1>
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
          <InvitePanel groupId={group.value.id} />
        </>
      )}
    </main>
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

import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "octane";
import { api } from "../../convex/_generated/api";
import { readSession } from "../authentication/session";
import { convexClient } from "../convex/client";
import { useLiveQuery } from "../convex/useLiveQuery";
import { describeError } from "../describeError";

export const Route = createFileRoute("/join/$token")({
  beforeLoad: ({ params }) => {
    if (readSession().status === "signedOut") {
      throw redirect({ to: "/sign-in", search: { next: `/join/${params.token}` } });
    }
  },
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const invite = useLiveQuery(api.invites.preview, { token });
  const navigate = useNavigate();

  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function join() {
    setFailure(null);
    setPending(true);
    try {
      const groupId = await convexClient.mutation(api.invites.redeem, { token });
      navigate({ to: "/g/$groupId", params: { groupId } });
    } catch (error) {
      setFailure(describeError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <main class="page">
      <header class="masthead">
        <h1 class="wordmark">Filmates</h1>
      </header>

      {invite.status === "loading" && <p class="muted">Loading</p>}
      {invite.status === "failed" && <p class="failure">{invite.message}</p>}
      {invite.status === "ready" && invite.value.status === "unknown" && (
        <p class="muted">This invite link is not valid.</p>
      )}
      {invite.status === "ready" && invite.value.status === "closed" && (
        <p class="muted">This invite link is closed.</p>
      )}
      {invite.status === "ready" && invite.value.status === "full" && (
        <p class="muted">{invite.value.groupName} is full.</p>
      )}
      {invite.status === "ready" && invite.value.status === "open" && (
        <>
          <div class="subject">
            <h2 class="display">{invite.value.groupName}</h2>
            <p class="label">
              {invite.value.memberCount} / {invite.value.memberLimit} members
            </p>
          </div>
          {failure !== null && <p class="failure">{failure}</p>}
          <button
            class="button button-primary button-wide"
            type="button"
            disabled={pending}
            onClick={() => void join()}
          >
            Join group
          </button>
        </>
      )}

      <Link class="button button-wide" to="/">
        Groups
      </Link>
    </main>
  );
}

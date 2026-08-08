import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "octane";
import { api } from "../../convex/_generated/api";
import { readSession, signOut } from "../authentication/session";
import { convexClient } from "../convex/client";
import { useLiveQuery } from "../convex/useLiveQuery";
import { describeError } from "../describeError";

const DEFAULT_MEMBER_LIMIT = 8;

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (readSession().status === "signedOut") {
      throw redirect({ to: "/sign-in", search: { next: "/" } });
    }
  },
  component: GroupListPage,
});

function GroupListPage() {
  const groups = useLiveQuery(api.groups.listForCurrentUser, {});
  const navigate = useNavigate();

  return (
    <main class="page">
      <header class="masthead">
        <h1 class="wordmark">Filmates</h1>
        <button
          class="label"
          type="button"
          onClick={() => {
            void signOut().then(() => navigate({ to: "/sign-in", search: { next: "/" } }));
          }}
        >
          Sign out
        </button>
      </header>

      <section class="section">
        <p class="section-head">
          <span class="label">Groups</span>
        </p>
        {groups.status === "loading" && <p class="muted">Loading</p>}
        {groups.status === "failed" && <p class="failure">{groups.message}</p>}
        {groups.status === "ready" && groups.value.length === 0 && (
          <p class="muted">No groups yet. Create the first.</p>
        )}
        {groups.status === "ready" && (
          <ul class="entries">
            {groups.value.map((group) => (
              <li key={group.id}>
                <Link class="entry" to="/g/$groupId" params={{ groupId: group.id }}>
                  <span class="title">{group.name}</span>
                  <span class="label">
                    {group.memberCount} / {group.memberLimit}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateGroupForm />
    </main>
  );
}

function CreateGroupForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [memberLimit, setMemberLimit] = useState(DEFAULT_MEMBER_LIMIT);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setFailure(null);
    setPending(true);
    try {
      const groupId = await convexClient.mutation(api.groups.create, { name, memberLimit });
      navigate({ to: "/g/$groupId", params: { groupId } });
    } catch (error) {
      setFailure(describeError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form class="form" onSubmit={submit}>
      <p class="section-head">
        <span class="label">New group</span>
      </p>

      <label class="field">
        <span class="label">Name</span>
        <input
          value={name}
          onInput={(event) => setName(event.currentTarget.value)}
          maxLength={40}
          required
        />
      </label>

      <label class="field">
        <span class="label">Member limit</span>
        <input
          type="number"
          value={memberLimit}
          onInput={(event) => setMemberLimit(event.currentTarget.valueAsNumber)}
          min={1}
          max={25}
          required
        />
      </label>

      {failure !== null && <p class="failure">{failure}</p>}

      <button class="button button-primary button-wide" type="submit" disabled={pending}>
        Create group
      </button>
    </form>
  );
}

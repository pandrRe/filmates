import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "octane";
import * as valibot from "valibot";
import { readSession, signIn, signUp } from "../authentication/session";
import { describeError } from "../describeError";

const SignInSearch = valibot.object({
  next: valibot.optional(valibot.pipe(valibot.string(), valibot.startsWith("/")), "/"),
});

export const Route = createFileRoute("/sign-in")({
  validateSearch: SignInSearch,
  beforeLoad: ({ search }) => {
    if (readSession().status === "signedIn") {
      throw redirect({ to: search.next });
    }
  },
  component: SignInPage,
});

type Flow = "signIn" | "signUp";

function SignInPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();

  const [flow, setFlow] = useState<Flow>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setFailure(null);
    setPending(true);
    try {
      await (flow === "signUp" ? signUp({ name, email, password }) : signIn({ email, password }));
      navigate({ to: next });
    } catch (error) {
      setFailure(describeError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <main class="page">
      <h1 class="wordmark">Filmates</h1>
      <p class="label">{flow === "signUp" ? "Create an account" : "Sign in"}</p>

      <form class="form" onSubmit={submit}>
        {flow === "signUp" && (
          <label class="field">
            <span class="label">Name</span>
            <input
              value={name}
              onInput={(event) => setName(event.currentTarget.value)}
              autoComplete="name"
              required
            />
          </label>
        )}

        <label class="field">
          <span class="label">Email</span>
          <input
            type="email"
            value={email}
            onInput={(event) => setEmail(event.currentTarget.value)}
            autoComplete="email"
            required
          />
        </label>

        <label class="field">
          <span class="label">Password</span>
          <input
            type="password"
            value={password}
            onInput={(event) => setPassword(event.currentTarget.value)}
            autoComplete={flow === "signUp" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </label>

        {failure !== null && <p class="failure">{failure}</p>}

        <button class="action" type="submit" disabled={pending}>
          {flow === "signUp" ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        class="label switch"
        type="button"
        onClick={() => {
          setFailure(null);
          setFlow(flow === "signUp" ? "signIn" : "signUp");
        }}
      >
        {flow === "signUp" ? "I already have an account" : "I need an account"}
      </button>
    </main>
  );
}

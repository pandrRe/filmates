import * as valibot from "valibot";
import { api } from "../../convex/_generated/api";
import { convexClient } from "../convex/client";

const STORAGE_KEY = "filmates.session";

const StoredSession = valibot.object({
  token: valibot.pipe(valibot.string(), valibot.minLength(1)),
  refreshToken: valibot.pipe(valibot.string(), valibot.minLength(1)),
});

const SignInResult = valibot.object({ tokens: valibot.nullable(StoredSession) });

type StoredSession = valibot.InferOutput<typeof StoredSession>;

export type Session = { status: "signedOut" } | { status: "signedIn" };

export type Credentials = { email: string; password: string };

export type Registration = Credentials & { name: string };

let stored = readStoredSession();
let session: Session = stored === null ? { status: "signedOut" } : { status: "signedIn" };

function readStoredSession(): StoredSession | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  const parsed = valibot.safeParse(
    valibot.pipe(valibot.string(), valibot.parseJson(), StoredSession),
    raw,
  );
  if (!parsed.success) {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return parsed.output;
}

function write(next: StoredSession | null): void {
  stored = next;
  session = next === null ? { status: "signedOut" } : { status: "signedIn" };
  if (next === null) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  convexClient.setAuth(fetchToken);
}

async function refresh(): Promise<string | null> {
  if (stored === null) {
    return null;
  }
  const result = await convexClient.action(api.auth.signIn, { refreshToken: stored.refreshToken });
  const parsed = valibot.safeParse(SignInResult, result);
  if (!parsed.success || parsed.output.tokens === null) {
    write(null);
    window.location.assign("/sign-in");
    return null;
  }
  write(parsed.output.tokens);
  return parsed.output.tokens.token;
}

function fetchToken({ forceRefreshToken }: { forceRefreshToken: boolean }): Promise<string | null> {
  if (stored === null) {
    return Promise.resolve(null);
  }
  return forceRefreshToken ? refresh() : Promise.resolve(stored.token);
}

function keepSignedIn(result: unknown): void {
  const parsed = valibot.parse(SignInResult, result);
  if (parsed.tokens === null) {
    throw new Error("sign in returned no session");
  }
  write(parsed.tokens);
}

export function readSession(): Session {
  return session;
}

export async function signUp(registration: Registration): Promise<void> {
  keepSignedIn(
    await convexClient.action(api.auth.signIn, {
      provider: "password",
      params: { ...registration, flow: "signUp" },
    }),
  );
}

export async function signIn(credentials: Credentials): Promise<void> {
  keepSignedIn(
    await convexClient.action(api.auth.signIn, {
      provider: "password",
      params: { ...credentials, flow: "signIn" },
    }),
  );
}

export async function signOut(): Promise<void> {
  await convexClient.action(api.auth.signOut, {});
  write(null);
}

convexClient.setAuth(fetchToken);

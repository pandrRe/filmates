import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "octane";
import * as valibot from "valibot";
import { api } from "../../convex/_generated/api";
import type { FilmSearchResult } from "../../convex/tmdb";
import { readSession } from "../authentication/session";
import { convexClient } from "../convex/client";
import { describeError } from "../describeError";
import { FilmPoster } from "../films/FilmPoster";

const DEBOUNCE_MILLISECONDS = 200;

type Search =
  | { status: "empty" }
  | { status: "searching" }
  | { status: "failed"; message: string }
  | { status: "ready"; results: Array<FilmSearchResult> };

const AddFilmSearch = valibot.object({
  title: valibot.optional(valibot.pipe(valibot.string(), valibot.maxLength(80)), ""),
});

export const Route = createFileRoute("/g/$groupId/add")({
  validateSearch: AddFilmSearch,
  beforeLoad: ({ params }) => {
    if (readSession().status === "signedOut") {
      throw redirect({ to: "/sign-in", search: { next: `/g/${params.groupId}/add` } });
    }
  },
  component: AddFilmPage,
});

function useDebounced(value: string): string {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), DEBOUNCE_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [value]);

  return settled;
}

function useSearch(query: string): Search {
  const [search, setSearch] = useState<Search>({ status: "empty" });

  useEffect(() => {
    if (query.trim().length === 0) {
      setSearch({ status: "empty" });
      return;
    }
    let abandoned = false;
    setSearch({ status: "searching" });
    convexClient
      .action(api.films.search, { query })
      .then((results) => {
        if (!abandoned) {
          setSearch({ status: "ready", results });
        }
      })
      .catch((error: unknown) => {
        if (!abandoned) {
          setSearch({ status: "failed", message: describeError(error) });
        }
      });
    return () => {
      abandoned = true;
    };
  }, [query]);

  return search;
}

function AddFilmPage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState(Route.useSearch().title);
  const search = useSearch(useDebounced(title));
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingTmdbId, setPendingTmdbId] = useState<number | null>(null);

  async function post(result: FilmSearchResult) {
    setNotice(null);
    setPendingTmdbId(result.tmdbId);
    try {
      const posted = await convexClient.action(api.films.post, {
        groupId,
        tmdbId: result.tmdbId,
      });
      if (posted.status === "alreadyPosted") {
        setNotice(`${result.title} is already in this group`);
        return;
      }
      navigate({ to: "/g/$groupId", params: { groupId } });
    } catch (error) {
      setNotice(describeError(error));
    } finally {
      setPendingTmdbId(null);
    }
  }

  return (
    <main class="page">
      <header class="page-head">
        <Link class="label" to="/g/$groupId" params={{ groupId }}>
          Back
        </Link>
      </header>

      <h1 class="wordmark">Add film</h1>

      <label class="field">
        <span class="label">Title</span>
        <input
          value={title}
          onInput={(event) => setTitle(event.currentTarget.value)}
          autoComplete="off"
          maxLength={80}
        />
      </label>

      {notice !== null && <p class="failure">{notice}</p>}
      {search.status === "searching" && <p class="muted">Searching</p>}
      {search.status === "failed" && <p class="failure">{search.message}</p>}
      {search.status === "ready" && search.results.length === 0 && (
        <p class="muted">Nothing found.</p>
      )}
      {search.status === "ready" && (
        <ul class="rows">
          {search.results.map((result) => (
            <li key={result.tmdbId}>
              <button
                class="film-row"
                type="button"
                disabled={pendingTmdbId !== null}
                onClick={() => void post(result)}
              >
                <FilmPoster title={result.title} posterPath={result.posterPath} />
                <span class="film-title">
                  <span>{result.title}</span>
                  <span class="label">{result.year === null ? "" : result.year}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

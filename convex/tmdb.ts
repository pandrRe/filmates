import * as valibot from "valibot";
import { requireEnvironmentVariable } from "./environment";

const BASE_URL = "https://api.themoviedb.org/3";
const SEARCH_LANGUAGE = "en-US";
const RELEASE_YEAR = /^(\d{4})/;

export type FilmSearchResult = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
};

export type Film = FilmSearchResult & {
  runtime: number | null;
  director: string | null;
};

const TmdbTitle = valibot.pipe(valibot.string(), valibot.minLength(1));

const TmdbSearchResponse = valibot.object({
  results: valibot.array(
    valibot.object({
      id: valibot.number(),
      title: TmdbTitle,
      release_date: valibot.optional(valibot.string()),
      poster_path: valibot.nullish(valibot.string()),
    }),
  ),
});

const TmdbFilmResponse = valibot.object({
  id: valibot.number(),
  title: TmdbTitle,
  release_date: valibot.optional(valibot.string()),
  poster_path: valibot.nullish(valibot.string()),
  runtime: valibot.nullish(valibot.number()),
  credits: valibot.object({
    crew: valibot.array(valibot.object({ job: valibot.string(), name: valibot.string() })),
  }),
});

function readYear(releaseDate: string | undefined): number | null {
  const matched = RELEASE_YEAR.exec(releaseDate ?? "");
  return matched === null ? null : Number(matched[1]);
}

function readRuntime(runtime: number | null | undefined): number | null {
  return runtime === null || runtime === undefined || runtime === 0 ? null : runtime;
}

function readDirector(crew: Array<{ job: string; name: string }>): string | null {
  return crew.find((member) => member.job === "Director")?.name ?? null;
}

async function request(path: string, parameters: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${requireEnvironmentVariable("TMDB_API_KEY")}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`the film database answered ${response.status} for ${path}`);
  }
  return await response.json();
}

export async function searchFilms(query: string): Promise<Array<FilmSearchResult>> {
  const response = valibot.parse(
    TmdbSearchResponse,
    await request("/search/movie", {
      query,
      language: SEARCH_LANGUAGE,
      include_adult: "false",
      page: "1",
    }),
  );
  return response.results.map((result) => ({
    tmdbId: result.id,
    title: result.title,
    year: readYear(result.release_date),
    posterPath: result.poster_path ?? null,
  }));
}

export async function fetchFilm(tmdbId: number): Promise<Film> {
  const film = valibot.parse(
    TmdbFilmResponse,
    await request(`/movie/${tmdbId}`, {
      language: SEARCH_LANGUAGE,
      append_to_response: "credits",
    }),
  );
  return {
    tmdbId: film.id,
    title: film.title,
    year: readYear(film.release_date),
    posterPath: film.poster_path ?? null,
    runtime: readRuntime(film.runtime),
    director: readDirector(film.credits.crew),
  };
}

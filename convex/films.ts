import { v } from "convex/values";
import * as valibot from "valibot";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId } from "./authentication";
import { requireMemberId } from "./memberships";
import { fetchFilm, searchFilms, type Film, type FilmSearchResult } from "./tmdb";

const CACHE_LIFETIME_MILLISECONDS = 24 * 60 * 60 * 1000;
const REPEATED_SPACE = /\s+/g;

const SearchQuery = valibot.pipe(
  valibot.string(),
  valibot.trim(),
  valibot.transform((value) => value.replace(REPEATED_SPACE, " ").toLowerCase()),
  valibot.minLength(1),
  valibot.maxLength(80),
);

const searchResultFields = {
  tmdbId: v.number(),
  title: v.string(),
  year: v.union(v.number(), v.null()),
  posterPath: v.union(v.string(), v.null()),
};

const filmFields = {
  ...searchResultFields,
  runtime: v.union(v.number(), v.null()),
  director: v.union(v.string(), v.null()),
};

export type GroupFilm = {
  id: Id<"groupFilms">;
  film: Film;
  score: number;
  postedAt: number;
};

export type PostResult =
  | { status: "posted"; groupFilmId: Id<"groupFilms"> }
  | { status: "alreadyPosted"; groupFilmId: Id<"groupFilms"> };

function findFilmByTmdbId(
  ctx: QueryCtx | MutationCtx,
  tmdbId: number,
): Promise<Doc<"films"> | null> {
  return ctx.db
    .query("films")
    .withIndex("by_tmdbId", (q) => q.eq("tmdbId", tmdbId))
    .unique();
}

function toFilm(film: Doc<"films">): Film {
  return {
    tmdbId: film.tmdbId,
    title: film.title,
    year: film.year,
    runtime: film.runtime,
    director: film.director,
    posterPath: film.posterPath,
  };
}

function compareRank(left: Doc<"groupFilms">, right: Doc<"groupFilms">): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  return left._creationTime - right._creationTime;
}

export const readSearchCache = internalQuery({
  args: { query: v.string() },
  handler: async (ctx, args): Promise<Array<FilmSearchResult> | null> => {
    const cached = await ctx.db
      .query("tmdbSearchCache")
      .withIndex("by_query", (q) => q.eq("query", args.query))
      .unique();
    if (cached === null || cached.fetchedAt + CACHE_LIFETIME_MILLISECONDS < Date.now()) {
      return null;
    }
    return cached.results;
  },
});

export const writeSearchCache = internalMutation({
  args: { query: v.string(), results: v.array(v.object(searchResultFields)) },
  handler: async (ctx, args): Promise<null> => {
    const cached = await ctx.db
      .query("tmdbSearchCache")
      .withIndex("by_query", (q) => q.eq("query", args.query))
      .unique();
    const entry = { query: args.query, results: args.results, fetchedAt: Date.now() };
    if (cached === null) {
      await ctx.db.insert("tmdbSearchCache", entry);
    } else {
      await ctx.db.patch(cached._id, entry);
    }
    return null;
  },
});

export const readFilmByTmdbId = internalQuery({
  args: { tmdbId: v.number() },
  handler: async (ctx, args): Promise<Film | null> => {
    const film = await findFilmByTmdbId(ctx, args.tmdbId);
    return film === null ? null : toFilm(film);
  },
});

export const writePost = internalMutation({
  args: { groupId: v.id("groups"), film: v.object(filmFields) },
  handler: async (ctx, args): Promise<PostResult> => {
    const postedBy = await requireMemberId(ctx, args.groupId);
    const known = await findFilmByTmdbId(ctx, args.film.tmdbId);
    const filmId = known === null ? await ctx.db.insert("films", args.film) : known._id;
    const posted = await ctx.db
      .query("groupFilms")
      .withIndex("by_group_film", (q) => q.eq("groupId", args.groupId).eq("filmId", filmId))
      .unique();
    if (posted !== null) {
      return { status: "alreadyPosted", groupFilmId: posted._id };
    }
    const groupFilmId = await ctx.db.insert("groupFilms", {
      groupId: args.groupId,
      filmId,
      postedBy,
      score: 0,
    });
    return { status: "posted", groupFilmId };
  },
});

export const search = action({
  args: { query: v.string() },
  handler: async (ctx, args): Promise<Array<FilmSearchResult>> => {
    await requireUserId(ctx);
    const normalizedQuery = valibot.parse(SearchQuery, args.query);
    const cached = await ctx.runQuery(internal.films.readSearchCache, {
      query: normalizedQuery,
    });
    if (cached !== null) {
      return cached;
    }
    const results = await searchFilms(normalizedQuery);
    await ctx.runMutation(internal.films.writeSearchCache, {
      query: normalizedQuery,
      results,
    });
    return results;
  },
});

export const post = action({
  args: { groupId: v.id("groups"), tmdbId: v.number() },
  handler: async (ctx, args): Promise<PostResult> => {
    await ctx.runQuery(internal.memberships.currentMemberId, { groupId: args.groupId });
    const known = await ctx.runQuery(internal.films.readFilmByTmdbId, { tmdbId: args.tmdbId });
    const film = known ?? (await fetchFilm(args.tmdbId));
    return await ctx.runMutation(internal.films.writePost, { groupId: args.groupId, film });
  },
});

export const listForGroup = query({
  args: { groupId: v.string() },
  handler: async (ctx, args): Promise<Array<GroupFilm>> => {
    const groupId = ctx.db.normalizeId("groups", args.groupId);
    if (groupId === null) {
      throw new Error(`${args.groupId} is not a group`);
    }
    await requireMemberId(ctx, groupId);
    const groupFilms = await ctx.db
      .query("groupFilms")
      .withIndex("by_group_score", (q) => q.eq("groupId", groupId))
      .collect();

    return await Promise.all(
      groupFilms.toSorted(compareRank).map(async (groupFilm) => {
        const film = await ctx.db.get(groupFilm.filmId);
        if (film === null) {
          throw new Error(`film ${groupFilm.filmId} does not exist`);
        }
        return {
          id: groupFilm._id,
          film: toFilm(film),
          score: groupFilm.score,
          postedAt: groupFilm._creationTime,
        };
      }),
    );
  },
});

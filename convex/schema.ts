import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  groups: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    memberLimit: v.number(),
  }),

  memberships: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_user", ["groupId", "userId"]),

  invites: defineTable({
    groupId: v.id("groups"),
    token: v.string(),
    expiresAt: v.number(),
    revoked: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_group", ["groupId"]),

  films: defineTable({
    tmdbId: v.number(),
    title: v.string(),
    year: v.union(v.number(), v.null()),
    runtime: v.union(v.number(), v.null()),
    director: v.union(v.string(), v.null()),
    posterPath: v.union(v.string(), v.null()),
  }).index("by_tmdbId", ["tmdbId"]),

  groupFilms: defineTable({
    groupId: v.id("groups"),
    filmId: v.id("films"),
    postedBy: v.id("users"),
    score: v.number(),
  })
    .index("by_group_score", ["groupId", "score"])
    .index("by_group_film", ["groupId", "filmId"]),

  votes: defineTable({
    groupFilmId: v.id("groupFilms"),
    userId: v.id("users"),
    value: v.union(v.literal(1), v.literal(-1)),
  })
    .index("by_groupFilm", ["groupFilmId"])
    .index("by_groupFilm_user", ["groupFilmId", "userId"]),

  seenMarks: defineTable({
    groupFilmId: v.id("groupFilms"),
    userId: v.id("users"),
  })
    .index("by_groupFilm", ["groupFilmId"])
    .index("by_groupFilm_user", ["groupFilmId", "userId"]),

  tmdbSearchCache: defineTable({
    query: v.string(),
    results: v.array(
      v.object({
        tmdbId: v.number(),
        title: v.string(),
        year: v.union(v.number(), v.null()),
        posterPath: v.union(v.string(), v.null()),
      }),
    ),
    fetchedAt: v.number(),
  }).index("by_query", ["query"]),
});

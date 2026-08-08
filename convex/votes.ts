import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireMemberId } from "./memberships";

export type Vote = "up" | "down" | "none";

function voteValue(direction: "up" | "down"): 1 | -1 {
  return direction === "up" ? 1 : -1;
}

export function readVote(vote: Doc<"votes"> | null): Vote {
  if (vote === null) {
    return "none";
  }
  return vote.value === 1 ? "up" : "down";
}

export function findVote(
  ctx: QueryCtx | MutationCtx,
  groupFilmId: Id<"groupFilms">,
  userId: Id<"users">,
): Promise<Doc<"votes"> | null> {
  return ctx.db
    .query("votes")
    .withIndex("by_groupFilm_user", (q) => q.eq("groupFilmId", groupFilmId).eq("userId", userId))
    .unique();
}

export const cast = mutation({
  args: {
    groupFilmId: v.id("groupFilms"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args): Promise<null> => {
    const groupFilm = await ctx.db.get(args.groupFilmId);
    if (groupFilm === null) {
      throw new Error(`${args.groupFilmId} is not a posted film`);
    }
    const userId = await requireMemberId(ctx, groupFilm.groupId);
    const existing = await findVote(ctx, args.groupFilmId, userId);
    const value = voteValue(args.direction);

    if (existing === null) {
      await ctx.db.insert("votes", { groupFilmId: args.groupFilmId, userId, value });
      await ctx.db.patch(groupFilm._id, { score: groupFilm.score + value });
      return null;
    }
    if (existing.value === value) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(groupFilm._id, { score: groupFilm.score - value });
      return null;
    }
    await ctx.db.patch(existing._id, { value });
    await ctx.db.patch(groupFilm._id, { score: groupFilm.score - existing.value + value });
    return null;
  },
});

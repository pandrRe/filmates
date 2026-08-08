import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireMemberId } from "./memberships";

export function findSeenMark(
  ctx: QueryCtx | MutationCtx,
  groupFilmId: Id<"groupFilms">,
  userId: Id<"users">,
): Promise<Doc<"seenMarks"> | null> {
  return ctx.db
    .query("seenMarks")
    .withIndex("by_groupFilm_user", (q) => q.eq("groupFilmId", groupFilmId).eq("userId", userId))
    .unique();
}

export function listSeenMarks(
  ctx: QueryCtx | MutationCtx,
  groupFilmId: Id<"groupFilms">,
): Promise<Array<Doc<"seenMarks">>> {
  return ctx.db
    .query("seenMarks")
    .withIndex("by_groupFilm", (q) => q.eq("groupFilmId", groupFilmId))
    .collect();
}

export const toggle = mutation({
  args: { groupFilmId: v.id("groupFilms") },
  handler: async (ctx, args): Promise<null> => {
    const groupFilm = await ctx.db.get(args.groupFilmId);
    if (groupFilm === null) {
      throw new Error(`${args.groupFilmId} is not a posted film`);
    }
    const userId = await requireMemberId(ctx, groupFilm.groupId);
    const mark = await findSeenMark(ctx, args.groupFilmId, userId);
    if (mark === null) {
      await ctx.db.insert("seenMarks", { groupFilmId: args.groupFilmId, userId });
    } else {
      await ctx.db.delete(mark._id);
    }
    return null;
  },
});

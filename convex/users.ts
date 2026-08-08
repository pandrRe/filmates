import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export type Member = {
  id: Id<"users">;
  name: string;
};

export function toMember(user: Doc<"users">): Member {
  if (user.name === undefined) {
    throw new Error(`user ${user._id} has no name`);
  }
  return { id: user._id, name: user.name };
}

export async function readMember(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Member> {
  const user = await ctx.db.get(userId);
  if (user === null) {
    throw new Error(`user ${userId} does not exist`);
  }
  return toMember(user);
}

export const currentMember = query({
  args: {},
  handler: async (ctx): Promise<Member | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await readMember(ctx, userId);
  },
});

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId } from "./authentication";

export type Membership = { groupId: Id<"groups">; memberId: Id<"users"> };

export function findMembership(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
): Promise<Doc<"memberships"> | null> {
  return ctx.db
    .query("memberships")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();
}

export function listMemberships(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
): Promise<Array<Doc<"memberships">>> {
  return ctx.db
    .query("memberships")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
}

export async function requireMemberId(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  const membership = await findMembership(ctx, groupId, userId);
  if (membership === null) {
    throw new Error("not a member of this group");
  }
  return userId;
}

export async function requireMembership(
  ctx: QueryCtx | MutationCtx,
  rawGroupId: string,
): Promise<Membership> {
  const groupId = ctx.db.normalizeId("groups", rawGroupId);
  if (groupId === null) {
    throw new Error(`${rawGroupId} is not a group`);
  }
  return { groupId, memberId: await requireMemberId(ctx, groupId) };
}

export const currentMembership = internalQuery({
  args: { groupId: v.string() },
  handler: (ctx, args): Promise<Membership> => requireMembership(ctx, args.groupId),
});

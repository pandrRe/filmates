import { v } from "convex/values";
import * as valibot from "valibot";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./authentication";
import { listMemberships, requireMembership } from "./memberships";
import { readMember, type Member } from "./users";

const GroupName = valibot.pipe(
  valibot.string(),
  valibot.trim(),
  valibot.minLength(1),
  valibot.maxLength(40),
);

const MemberLimit = valibot.pipe(
  valibot.number(),
  valibot.integer(),
  valibot.minValue(1),
  valibot.maxValue(25),
);

export type GroupSummary = {
  id: Id<"groups">;
  name: string;
  memberLimit: number;
  memberCount: number;
};

export type GroupDetail = GroupSummary & {
  ownerId: Id<"users">;
  members: Array<Member>;
};

export const create = mutation({
  args: { name: v.string(), memberLimit: v.number() },
  handler: async (ctx, args): Promise<Id<"groups">> => {
    const ownerId = await requireUserId(ctx);
    const groupId = await ctx.db.insert("groups", {
      name: valibot.parse(GroupName, args.name),
      memberLimit: valibot.parse(MemberLimit, args.memberLimit),
      ownerId,
    });
    await ctx.db.insert("memberships", { groupId, userId: ownerId });
    return groupId;
  },
});

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx): Promise<Array<GroupSummary>> => {
    const userId = await requireUserId(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return await Promise.all(
      memberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId);
        if (group === null) {
          throw new Error(`group ${membership.groupId} does not exist`);
        }
        const members = await listMemberships(ctx, group._id);
        return {
          id: group._id,
          name: group.name,
          memberLimit: group.memberLimit,
          memberCount: members.length,
        };
      }),
    );
  },
});

export const get = query({
  args: { groupId: v.string() },
  handler: async (ctx, args): Promise<GroupDetail> => {
    const { groupId } = await requireMembership(ctx, args.groupId);
    const group = await ctx.db.get(groupId);
    if (group === null) {
      throw new Error(`group ${groupId} does not exist`);
    }
    const memberships = await listMemberships(ctx, group._id);
    const members = await Promise.all(
      memberships.map((membership) => readMember(ctx, membership.userId)),
    );
    return {
      id: group._id,
      name: group.name,
      memberLimit: group.memberLimit,
      memberCount: members.length,
      ownerId: group.ownerId,
      members,
    };
  },
});

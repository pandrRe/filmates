import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId } from "./authentication";
import { findMembership, listMemberships, requireMemberId } from "./memberships";

const INVITE_LIFETIME_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

export type InvitePreview =
  | { status: "unknown" }
  | { status: "closed" }
  | { status: "full"; groupName: string }
  | {
      status: "open";
      groupId: Id<"groups">;
      groupName: string;
      memberCount: number;
      memberLimit: number;
    };

function createToken(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function isActive(invite: Doc<"invites">, now: number): boolean {
  return !invite.revoked && invite.expiresAt > now;
}

function findInviteByToken(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<"invites"> | null> {
  return ctx.db
    .query("invites")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

export const issue = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args): Promise<string> => {
    await requireMemberId(ctx, args.groupId);
    const now = Date.now();
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    const active = invites.find((invite) => isActive(invite, now));
    if (active !== undefined) {
      return active.token;
    }

    const token = createToken();
    await ctx.db.insert("invites", {
      groupId: args.groupId,
      token,
      expiresAt: now + INVITE_LIFETIME_MILLISECONDS,
      revoked: false,
    });
    return token;
  },
});

export const revoke = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args): Promise<null> => {
    await requireMemberId(ctx, args.groupId);
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    await Promise.all(
      invites
        .filter((invite) => !invite.revoked)
        .map((invite) => ctx.db.patch(invite._id, { revoked: true })),
    );
    return null;
  },
});

export const preview = query({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<InvitePreview> => {
    const invite = await findInviteByToken(ctx, args.token);
    if (invite === null) {
      return { status: "unknown" };
    }
    if (!isActive(invite, Date.now())) {
      return { status: "closed" };
    }

    const group = await ctx.db.get(invite.groupId);
    if (group === null) {
      throw new Error(`group ${invite.groupId} does not exist`);
    }

    const memberships = await listMemberships(ctx, group._id);
    if (memberships.length >= group.memberLimit) {
      return { status: "full", groupName: group.name };
    }

    return {
      status: "open",
      groupId: group._id,
      groupName: group.name,
      memberCount: memberships.length,
      memberLimit: group.memberLimit,
    };
  },
});

export const redeem = mutation({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<Id<"groups">> => {
    const userId = await requireUserId(ctx);
    const invite = await findInviteByToken(ctx, args.token);
    if (invite === null) {
      throw new Error("this invite link is not valid");
    }
    if (!isActive(invite, Date.now())) {
      throw new Error("this invite link is closed");
    }

    const group = await ctx.db.get(invite.groupId);
    if (group === null) {
      throw new Error(`group ${invite.groupId} does not exist`);
    }

    const existing = await findMembership(ctx, group._id, userId);
    if (existing !== null) {
      return group._id;
    }

    const memberships = await listMemberships(ctx, group._id);
    if (memberships.length >= group.memberLimit) {
      throw new Error(`${group.name} is full`);
    }

    await ctx.db.insert("memberships", { groupId: group._id, userId });
    return group._id;
  },
});

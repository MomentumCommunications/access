import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { isBulletinVisibleToAudience } from "../shared/bulletin-audience";
import { getCurrentUserOrThrow } from "./users";

async function getCurrentAudience(ctx: QueryCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  const groupIds = user.group || [];
  const groups = await Promise.all(
    groupIds.map((groupId) => ctx.db.get(groupId)),
  );
  return {
    user,
    groupIds,
    groupNames: groups.flatMap((group) => (group ? [group.name] : [])),
  };
}

function canManageBulletins(user: {
  role?: string;
  roles?: string[];
}) {
  return user.role === "admin" || user.roles?.includes("admin") === true;
}

async function requireBulletinAdmin(ctx: QueryCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  if (!canManageBulletins(user)) {
    throw new Error("Administrator access required");
  }
  return user;
}

export const createBulletin = mutation({
  args: {
    title: v.string(),
    team: v.array(v.string()),
    date: v.optional(v.string()),
    endDate: v.optional(v.string()),
    body: v.string(),
    image: v.optional(v.string()),
    audience: v.optional(v.literal("all")),
    groups: v.optional(v.array(v.id("groups"))),
  },
  handler: async (ctx, args) => {
    await requireBulletinAdmin(ctx);
    const audienceAll = args.audience === "all";
    const newBulletinId = await ctx.db.insert("bulletin", {
      title: args.title,
      body: args.body,
      pinned: false,
      audience: args.audience,
      group: audienceAll ? [] : args.team, // Keep old field for backward compatibility
      groups: audienceAll ? [] : args.groups, // New field with group IDs
      date: args.date,
      endDate: args.endDate,
      image: args.image,
    });
    return newBulletinId;
  },
});

export const getBulletin = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const audience = await getCurrentAudience(ctx);
    const bulletinId = ctx.db.normalizeId("bulletin", args.id);
    const bulletin = bulletinId ? await ctx.db.get(bulletinId) : null;
    if (!bulletin || canManageBulletins(audience.user)) return bulletin;

    return isBulletinVisibleToAudience(
      bulletin,
      audience.groupIds,
      audience.groupNames,
    )
      ? bulletin
      : null;
  },
});

export const getMyBulletins = query({
  args: {},
  handler: async (ctx) => {
    const { groupIds, groupNames } = await getCurrentAudience(ctx);
    const bulletins = await ctx.db.query("bulletin").collect();

    return bulletins
      .filter((bulletin) =>
        isBulletinVisibleToAudience(bulletin, groupIds, groupNames),
      )
      .sort((a, b) => {
        const aDate = a.date
          ? new Date(a.date).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bDate = b.date
          ? new Date(b.date).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aDate - bDate || a._creationTime - b._creationTime;
      })
      .map((bulletin) => ({
        _id: bulletin._id,
        _creationTime: bulletin._creationTime,
        title: bulletin.title,
        subtitle: bulletin.subtitle,
        venue: bulletin.venue,
        body: bulletin.body,
        pinned: bulletin.pinned,
        group: bulletin.group,
        groups: bulletin.groups,
        audience: bulletin.audience,
        date: bulletin.date,
        endDate: bulletin.endDate,
        image: bulletin.image,
      }));
  },
});

export const getAllBulletins = query({
  handler: async (ctx) => {
    await requireBulletinAdmin(ctx);
    const bulletins = await ctx.db.query("bulletin").collect();

    // sort by date
    const sortedBulletins = bulletins.sort((a, b) => {
      const aDate = a.date ? new Date(a.date) : new Date();
      const bDate = b.date ? new Date(b.date) : new Date();
      return aDate.getTime() - bDate.getTime();
    });

    return sortedBulletins.map((b) => {
      return {
        _id: b._id,
        title: b.title,
        body: b.body,
        pinned: b.pinned,
        group: b.group,
        groups: b.groups,
        audience: b.audience,
        date: b.date,
        endDate: b.endDate,
        image: b.image,
        hidden: b.hidden,
      };
    });
  },
});

export const hideBulletin = mutation({
  args: { id: v.id("bulletin") },
  handler: async (ctx, args) => {
    await requireBulletinAdmin(ctx);
    await ctx.db.patch(args.id, { hidden: true });
  },
});

export const unhideBulletin = mutation({
  args: { id: v.id("bulletin") },
  handler: async (ctx, args) => {
    await requireBulletinAdmin(ctx);
    await ctx.db.patch(args.id, { hidden: false });
  },
});

export const deleteBulletin = mutation({
  args: { id: v.id("bulletin") },
  handler: async (ctx, args) => {
    await requireBulletinAdmin(ctx);
    return await ctx.db.delete(args.id);
  },
});

export const editBulletin = mutation({
  args: {
    id: v.id("bulletin"),
    title: v.string(),
    body: v.string(),
    date: v.string(),
    endDate: v.optional(v.string()),
    group: v.array(v.string()),
    groups: v.optional(v.array(v.id("groups"))),
    audience: v.optional(v.literal("all")),
  },
  handler: async (ctx, args) => {
    await requireBulletinAdmin(ctx);
    const audienceAll = args.audience === "all";
    const updates = {
      title: args.title,
      body: args.body,
      date: args.date,
      audience: args.audience,
      group: audienceAll ? [] : args.group, // Keep old field for backward compatibility
      groups: audienceAll ? [] : args.groups, // New field with group IDs
    };

    if (args.endDate !== undefined) {
      return await ctx.db.patch(args.id, {
        ...updates,
        endDate: args.endDate,
      });
    }

    return await ctx.db.patch(args.id, {
      ...updates,
    });
  },
});

export const attachImage = mutation({
  args: { storageId: v.id("_storage"), bulletin: v.id("bulletin") },
  handler: async (ctx, args) => {
    await requireBulletinAdmin(ctx);
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      return;
    }
    await ctx.db.patch(args.bulletin, { image: url });
  },
});

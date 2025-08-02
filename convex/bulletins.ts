import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new task with the given text
export const createBulletin = mutation({
  args: {
    title: v.string(),
    team: v.array(v.string()),
    date: v.optional(v.string()),
    body: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const newBulletinId = await ctx.db.insert("bulletin", {
      title: args.title,
      body: args.body,
      pinned: false,
      group: args.team,
      date: args.date,
      image: args.image,
    });
    return newBulletinId;
  },
});

export const getAllBulletins = query({
  handler: async (ctx) => {
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
        date: b.date,
        image: b.image,
      };
    });
  },
});

export const hideBulletin = mutation({
  args: { id: v.id("bulletin") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { hidden: true });
  },
});

export const unhideBulletin = mutation({
  args: { id: v.id("bulletin") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { hidden: false });
  },
});

export const getBulletinsByPassword = query({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    const groups = await ctx.db.query("groups").collect();
    const thisGroup = groups.find((g) => g.password === args.password);

    if (!thisGroup) {
      return [];
    }

    const bulletins = await ctx.db
      .query("bulletin")
      .filter((q) => q.not(q.eq(q.field("hidden"), true)))
      .collect();

    const filteredBulletins = bulletins.filter((b) =>
      b.group?.includes(thisGroup.name),
    );

    const sortedBulletins = filteredBulletins.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateA.getTime() - dateB.getTime();
    });

    const futureBulletins = sortedBulletins.filter(
      (b) => new Date(b.date || 0) > new Date(),
    );

    return futureBulletins;
  },
});

export const getBulletinsByGroup = query({
  args: { group: v.string() },
  handler: async (ctx, args) => {
    const bulletins = await ctx.db.query("bulletin").collect();

    return bulletins.filter((b) => b.group?.includes(args.group));
  },
});

// TODO: make a query that can take a group argument for filtering
// dynamically pulling groups from the database
export const getMdpBulletins = query({
  handler: async (ctx) => {
    // Filter for bulletins containing group "MDP"
    const bulletins = await ctx.db.query("bulletin").order("desc").collect();

    return bulletins.filter((b) => b.group?.includes("mdp"));
  },
});

export const getMdp2Bulletins = query({
  handler: async (ctx) => {
    const bulletins = await ctx.db.query("bulletin").collect();

    return bulletins.filter((b) => b.group?.includes("mdp2"));
  },
});

export const deleteBulletin = mutation({
  args: { id: v.id("bulletin") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.id);
  },
});

export const editBulletin = mutation({
  args: {
    id: v.id("bulletin"),
    title: v.string(),
    body: v.string(),
    date: v.string(),
    group: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, {
      title: args.title,
      body: args.body,
      date: args.date,
      group: args.group,
    });
  },
});

export const attachImage = mutation({
  args: { storageId: v.id("_storage"), bulletin: v.id("bulletin") },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      return;
    }
    await ctx.db.patch(args.bulletin, { image: url });
  },
});

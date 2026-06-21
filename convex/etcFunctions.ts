import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

function isAdmin(user: { role?: string; roles?: string[] }) {
  return user.role === "admin" || user.roles?.includes("admin") === true;
}

async function requireAdmin(ctx: QueryCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  if (!isAdmin(user)) {
    throw new Error("Administrator access required");
  }
}

export const getGroups = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const groups = await ctx.db.query("groups").collect();
    return groups;
  },
});

export const getGroupLabels = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const groups = isAdmin(user)
      ? await ctx.db.query("groups").collect()
      : await Promise.all(
          (user.group || []).map((groupId) => ctx.db.get(groupId)),
        );
    return groups.flatMap((group) =>
      group ? [{ _id: group._id, name: group.name }] : [],
    );
  },
});

export const assignGroups = mutation({
  args: {
    user: v.id("users"),
    groups: v.array(v.id("groups")),
  },
  handler: async (ctx, { user, groups }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(user, { group: groups });
  },
});

export const addGroup = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    password: v.string(),
    info: v.optional(v.string()),
    document: v.optional(v.id("_storage")),
    color: v.optional(v.string()),
    managedEnrollment: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { name, description, password, info, document, color, managedEnrollment },
  ) => {
    await requireAdmin(ctx);
    await ctx.db.insert("groups", {
      name,
      description,
      password,
      info,
      document,
      color,
      managedEnrollment: managedEnrollment === true,
    });
  },
});

export const editGroup = mutation({
  args: {
    name: v.string(),
    group: v.id("groups"),
    password: v.optional(v.string()),
    info: v.optional(v.string()),
    document: v.optional(v.id("_storage")),
    color: v.optional(v.string()),
    managedEnrollment: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { group, name, password, info, document, color, managedEnrollment },
  ) => {
    await requireAdmin(ctx);
    await ctx.db.patch(group, {
      name,
      info,
      password,
      document,
      color,
      managedEnrollment: managedEnrollment === true,
    });
  },
});

export const deleteGroup = mutation({
  args: { group: v.id("groups") },
  handler: async (ctx, { group }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(group);
  },
});

export const getUrlForImage = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const url = await ctx.storage.getUrl(storageId);
    return url;
  },
});

export const getMyGroupDocuments = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const groupIds = user.group || [];
    const groups = await Promise.all(groupIds.map((id) => ctx.db.get(id)));
    const groupsWithDocuments = groups.filter((group) => group?.document);

    const documentsWithUrls = await Promise.all(
      groupsWithDocuments.map(async (group) => {
        if (!group?.document) return null;
        const url = await ctx.storage.getUrl(group.document);
        return {
          groupId: group._id,
          groupName: group.name,
          documentUrl: url,
        };
      }),
    );

    return documentsWithUrls.filter((doc) => doc !== null);
  },
});

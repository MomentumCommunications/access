import { query } from "./_generated/server";

export const getGroups = query({
  args: {},
  handler: async (ctx) => {
    const groups = await ctx.db.query("groups").collect();
    return groups;
  },
});

import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";
import { ResendOTPEmailVerification } from "./ResendOTPEmailVerification";
import { resolveUserRoles, highestUserRole } from "./lib/roles";

function normalizedEmails(email: string | string[] | undefined) {
  if (!email) return [];
  return (Array.isArray(email) ? email : [email]).map((value) =>
    value.trim().toLowerCase(),
  );
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const {
        emailVerified,
        phoneVerified,
        ...profile
      } = args.profile;
      const profileUpdates = {
        ...profile,
        ...(emailVerified ? { emailVerificationTime: Date.now() } : {}),
        ...(phoneVerified ? { phoneVerificationTime: Date.now() } : {}),
      };

      if (args.existingUserId) {
        await ctx.db.patch(args.existingUserId, {
          ...(typeof profile.email === "string" ? { email: profile.email } : {}),
          ...(emailVerified ? { emailVerificationTime: Date.now() } : {}),
          ...(phoneVerified ? { phoneVerificationTime: Date.now() } : {}),
        });
        return args.existingUserId;
      }

      const email =
        typeof profile.email === "string"
          ? profile.email.trim().toLowerCase()
          : null;
      let importedUser = null;

      if (email && args.type === "credentials") {
        const users = await ctx.db.query("users").collect();
        const candidates = [];

        for (const user of users) {
          if (!normalizedEmails(user.email).includes(email)) continue;

          const account = await ctx.db
            .query("authAccounts")
            .withIndex("userIdAndProvider", (q) =>
              q.eq("userId", user._id),
            )
            .first();

          if (!account) candidates.push(user);
        }

        importedUser = candidates.length === 1 ? candidates[0] : null;
      }

      const userId = importedUser
        ? importedUser._id
        : await ctx.db.insert("users", {
            ...profileUpdates,
            role: "member",
            roles: ["member"],
          });

      const importedContacts = email
        ? (await ctx.db.query("studentContacts").collect()).filter(
            (contact) =>
              !contact.user &&
              contact.inviteEmail?.trim().toLowerCase() === email,
          )
        : [];

      for (const contact of importedContacts) {
        await ctx.db.patch(contact._id, {
          user: userId,
          inviteEmail: undefined,
        });
      }

      const matchedImportedRecord =
        Boolean(importedUser) || importedContacts.length > 0;

      const existingOnboarding = await ctx.db
        .query("onboarding")
        .withIndex("byUser", (q) => q.eq("user", userId))
        .unique();
      const onboardingIsComplete =
        existingOnboarding?.currentStep === "complete" ||
        existingOnboarding?.completedAt !== undefined;

      const assignedRoles = importedUser
        ? resolveUserRoles(importedUser)
        : (["member"] as const);

      await ctx.db.patch(userId, {
        ...profileUpdates,
        role: highestUserRole([...assignedRoles]),
        roles: [...assignedRoles],
        onboardingStatus: onboardingIsComplete ? "complete" : "pending",
        onboardingSource: matchedImportedRecord ? "imported" : "new",
        ...(onboardingIsComplete
          ? {
              onboardingCompletedAt:
                existingOnboarding.completedAt ?? Date.now(),
            }
          : {}),
      });

      if (!existingOnboarding) {
        await ctx.db.insert("onboarding", {
          user: userId,
          currentStep: "profile",
          matchedImportedRecord,
          createdStudentIds: [],
          startedAt: Date.now(),
        });
      }

      return userId;
    },
  },
  providers: [
    Password({
      reset: ResendOTPPasswordReset,
      verify: ResendOTPEmailVerification,
      profile(params) {
        return {
          email: params.email as string,
          name:
            typeof params.name === "string" && params.name.trim().length > 0
              ? params.name.trim()
              : (params.email as string),
        };
      },
    }),
  ],
});

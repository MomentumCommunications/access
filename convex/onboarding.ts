import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import { highestUserRole, resolveUserRoles } from "./lib/roles";
import { ensureDefaultHouseholdBilling } from "./lib/householdBilling";
import {
  isWorkforceAccount,
  nextOnboardingDestination,
  shouldProvisionCustomerBilling,
} from "../shared/account-invitations";

const onboardingStepValidator = v.union(
  v.literal("profile"),
  v.literal("students"),
  v.literal("review"),
  v.literal("contract"),
  v.literal("complete"),
);

const RECREATIONAL_CONTRACT_TYPE = "recreational";
const RECREATIONAL_CONTRACT_VERSION = "1";

const studentGenderValidator = v.union(
  v.literal(""),
  v.literal("Female"),
  v.literal("Male"),
);

type DbCtx = QueryCtx | MutationCtx;

async function getOnboarding(ctx: DbCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  const onboarding = await ctx.db
    .query("onboarding")
    .withIndex("byUser", (q) => q.eq("user", user._id))
    .unique();
  return { user, onboarding };
}

async function getConnectedStudents(
  ctx: DbCtx,
  userId: Id<"users">,
) {
  const contacts = await ctx.db
    .query("studentContacts")
    .withIndex("byUser", (q) => q.eq("user", userId))
    .collect();

  return (
    await Promise.all(
      contacts.map(async (contact) => {
        const student = await ctx.db.get(contact.student);
        return student ? { contact, student } : null;
      }),
    )
  ).filter((row) => row !== null);
}

export const getState = query({
  args: {},
  handler: async (ctx) => {
    const { user, onboarding } = await getOnboarding(ctx);
    const students = await getConnectedStudents(ctx, user._id);

    return {
      user,
      onboarding,
      students,
    };
  },
});

export const ensureState = mutation({
  args: {},
  handler: async (ctx) => {
    const { user, onboarding } = await getOnboarding(ctx);
    if (onboarding) {
      if (
        onboarding.currentStep === "complete" ||
        onboarding.completedAt !== undefined
      ) {
        await ctx.db.patch(user._id, {
          onboardingStatus: "complete",
          onboardingCompletedAt:
            onboarding.completedAt ?? user.onboardingCompletedAt ?? Date.now(),
        });
      }
      return onboarding._id;
    }

    await ctx.db.patch(user._id, {
      onboardingStatus: "pending",
      onboardingSource: "new",
    });

    return await ctx.db.insert("onboarding", {
      user: user._id,
      currentStep: "profile",
      matchedImportedRecord: false,
      createdStudentIds: [],
      startedAt: Date.now(),
    });
  },
});

export const saveProfile = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, onboarding } = await getOnboarding(ctx);
    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    const roles = resolveUserRoles(user);
    const students = await getConnectedStudents(ctx, user._id);
    const workforce = isWorkforceAccount(roles);
    const destination = nextOnboardingDestination({
      roles,
      connectedStudentCount: students.length,
    });
    const provisionCustomerBilling = shouldProvisionCustomerBilling({
      onboardingSource: user.onboardingSource,
      roles,
    });
    const now = Date.now();

    if (!firstName || firstName.length > 80) {
      throw new Error("First name must be between 1 and 80 characters.");
    }
    if (!lastName || lastName.length > 80) {
      throw new Error("Last name must be between 1 and 80 characters.");
    }
    await ctx.db.patch(user._id, {
      firstName,
      lastName,
      phone: args.phone.trim() || undefined,
      role: highestUserRole(roles),
      roles,
      onboardingStatus: workforce ? "complete" : "pending",
      ...(workforce ? { onboardingCompletedAt: now } : {}),
    });
    if (provisionCustomerBilling) {
      await ensureDefaultHouseholdBilling(ctx, {
        userId: user._id,
        firstName,
        lastName,
      });
    }
    if (onboarding) {
      await ctx.db.patch(onboarding._id, {
        currentStep: workforce
          ? "complete"
          : destination === "/register/review"
            ? "review"
            : "students",
        ...(workforce ? { completedAt: now } : {}),
      });
    }
    return {
      userId: user._id,
      destination,
      provisionCustomerBilling,
    };
  },
});

export const completeProfileStep = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found.");
    }
    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("byUser", (q) => q.eq("user", userId))
      .unique();
    if (onboarding) {
      await ctx.db.patch(onboarding._id, { currentStep: "students" });
    } else {
      await ctx.db.insert("onboarding", {
        user: userId,
        currentStep: "students",
        matchedImportedRecord: user.onboardingSource === "imported",
        createdStudentIds: [],
        startedAt: Date.now(),
      });
    }
  },
});

export const addStudent = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    preferredName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: studentGenderValidator,
    school: v.string(),
    allergies: v.string(),
    recital: v.boolean(),
    relationship: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, onboarding } = await getOnboarding(ctx);
    if (!onboarding) throw new Error("Onboarding has not been started.");

    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    if (!firstName || !lastName) {
      throw new Error("First and last name are required.");
    }

    const student = await ctx.db.insert("students", {
      firstName,
      lastName,
      preferredName: args.preferredName?.trim() || undefined,
      dateOfBirth: args.dateOfBirth,
      gender: args.gender,
      school: args.school.trim(),
      allergies: args.allergies.trim(),
      recital: args.recital,
      status: "active",
    });

    await ctx.db.insert("studentContacts", {
      student,
      user: user._id,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.name,
      relationship: args.relationship?.trim() || undefined,
      canManage: true,
      isPrimary: true,
    });

    await ctx.db.patch(onboarding._id, {
      currentStep: "students",
      createdStudentIds: [...onboarding.createdStudentIds, student],
    });

    return student;
  },
});

export const removeStudent = mutation({
  args: { student: v.id("students") },
  handler: async (ctx, { student }) => {
    const { user, onboarding } = await getOnboarding(ctx);
    if (!onboarding?.createdStudentIds.includes(student)) {
      throw new Error("This student cannot be removed during onboarding.");
    }

    const contacts = await ctx.db
      .query("studentContacts")
      .withIndex("byStudent", (q) => q.eq("student", student))
      .collect();
    const ownedContact = contacts.find((contact) => contact.user === user._id);
    if (!ownedContact || contacts.length !== 1) {
      throw new Error("This student is already connected to another account.");
    }

    const enrollments = await ctx.db
      .query("classEnrollments")
      .withIndex("byStudent", (q) => q.eq("student", student))
      .first();
    const attendance = await ctx.db
      .query("attendanceRecords")
      .withIndex("byStudent", (q) => q.eq("student", student))
      .first();

    if (enrollments || attendance) {
      throw new Error("This student already has studio records.");
    }

    await ctx.db.delete(ownedContact._id);
    await ctx.db.delete(student);
    await ctx.db.patch(onboarding._id, {
      createdStudentIds: onboarding.createdStudentIds.filter(
        (studentId) => studentId !== student,
      ),
    });
  },
});

export const setStep = mutation({
  args: { step: onboardingStepValidator },
  handler: async (ctx, { step }) => {
    const { onboarding } = await getOnboarding(ctx);
    if (!onboarding) throw new Error("Onboarding has not been started.");
    await ctx.db.patch(onboarding._id, { currentStep: step });
  },
});

export const recordContractSignature = mutation({
  args: {
    docusealSubmissionId: v.optional(v.string()),
  },
  handler: async (ctx, { docusealSubmissionId }) => {
    const { user, onboarding } = await getOnboarding(ctx);
    if (!onboarding) throw new Error("Onboarding has not been started.");

    await ctx.db.patch(user._id, {
      contractTypeSigned: RECREATIONAL_CONTRACT_TYPE,
      contractVersionSigned: RECREATIONAL_CONTRACT_VERSION,
      contractSignedAt: Date.now(),
      docusealSubmissionId: docusealSubmissionId?.trim() || undefined,
    });
    await ctx.db.patch(onboarding._id, { currentStep: "contract" });
  },
});

export const complete = mutation({
  args: {},
  handler: async (ctx) => {
    const { user, onboarding } = await getOnboarding(ctx);
    if (!onboarding) throw new Error("Onboarding has not been started.");

    const roles = resolveUserRoles(user);
    const workforce = isWorkforceAccount(roles);
    const students = await getConnectedStudents(ctx, user._id);
    if (!workforce && students.length === 0) {
      throw new Error("Add at least one student before completing onboarding.");
    }
    if (
      !workforce &&
      (!user.contractTypeSigned ||
        !user.contractVersionSigned ||
        !user.contractSignedAt)
    ) {
      throw new Error("Complete the client agreement before finishing.");
    }

    const completedAt = Date.now();
    await ctx.db.patch(user._id, {
      role: highestUserRole(roles),
      roles,
      onboardingStatus: "complete",
      onboardingCompletedAt: completedAt,
    });
    await ctx.db.patch(onboarding._id, {
      currentStep: "complete",
      completedAt,
    });
  },
});

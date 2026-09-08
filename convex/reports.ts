import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { hasUserRole, resolveUserRoles } from "./lib/roles";
import { getCurrentUserOrThrow } from "./users";
import { buildEnrollmentReportsDashboard } from "../shared/admin-reports";
import { isWorkforceAccount } from "../shared/account-invitations";
import {
  incompleteOnboardingStep,
  isDesertedTrial,
} from "../shared/onboarding-report";

async function requireAdmin(ctx: Parameters<typeof getCurrentUserOrThrow>[0]) {
  const user = await getCurrentUserOrThrow(ctx);
  if (!hasUserRole(user, "admin")) throw new Error("Unauthorized");
  return user;
}

function accountName(user: {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string | string[];
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const email = Array.isArray(user.email) ? user.email[0] : user.email;
  return fullName || user.name || email || "Unnamed account";
}

function primaryEmail(email?: string | string[]) {
  const value = Array.isArray(email) ? email[0] : email;
  return value?.trim() || undefined;
}

export const adminEnrollmentDashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const enrollments = await ctx.db.query("classEnrollments").collect();
    const classIds = [...new Set(enrollments.map((row) => row.classId))];
    const classes = await Promise.all(
      classIds.map(async (classId) => ctx.db.get(classId)),
    );
    const classesById = new Map(
      classes
        .filter((classItem) => classItem !== null)
        .map((classItem) => [classItem._id, classItem]),
    );

    return buildEnrollmentReportsDashboard(
      enrollments.map((enrollment) => {
        const classItem = classesById.get(enrollment.classId);
        return {
          enrollmentId: enrollment._id,
          classId: enrollment.classId,
          classTitle: classItem?.title ?? "Unknown class",
          classStatus: classItem?.status,
          studentId: enrollment.student,
          status: enrollment.status,
          startDate: enrollment.startDate,
          endDate: enrollment.endDate,
          classStartDate: classItem?.startDate,
          classEndDate: classItem?.endDate,
          createdAt: enrollment._creationTime,
        };
      }),
    );
  },
});

export const adminOnboardingReport = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [users, onboardingRows, approvedTrials] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("onboarding").collect(),
      ctx.db
        .query("trialRequests")
        .withIndex("byStatus", (q) => q.eq("status", "approved"))
        .collect(),
    ]);
    const onboardingByUser = new Map(
      onboardingRows.map((row) => [row.user, row]),
    );

    const incompleteOnboarding = users
      .flatMap((user) => {
        if (isWorkforceAccount(resolveUserRoles(user))) return [];
        const onboarding = onboardingByUser.get(user._id);
        const step = incompleteOnboardingStep(
          user.onboardingStatus,
          onboarding?.currentStep,
        );
        if (!step) return [];
        return [
          {
            userId: user._id,
            name: accountName(user),
            email: primaryEmail(user.email),
            phone: user.phone?.trim() || undefined,
            source: user.onboardingSource,
            step,
            startedAt: onboarding?.startedAt ?? user._creationTime,
          },
        ];
      })
      .sort((left, right) => left.startedAt - right.startedAt);

    const attendanceRows = await Promise.all(
      approvedTrials.map(async (trial) => ({
        trial,
        attendance: await ctx.db
          .query("attendanceRecords")
          .withIndex("bySessionStudent", (q) =>
            q.eq("session", trial.sessionId).eq("student", trial.studentId),
          )
          .first(),
      })),
    );
    const absentTrials = attendanceRows.filter(({ trial, attendance }) =>
      isDesertedTrial(trial.status, attendance?.status),
    );
    const desertedTrials = await Promise.all(
      absentTrials.map(async ({ trial, attendance }) => {
        const [student, requester, classItem, session] = await Promise.all([
          ctx.db.get(trial.studentId),
          ctx.db.get(trial.requestedBy),
          ctx.db.get(trial.classId),
          ctx.db.get(trial.sessionId),
        ]);
        return {
          trialRequestId: trial._id,
          studentId: trial.studentId,
          studentName: student
            ? student.preferredName ||
              `${student.firstName} ${student.lastName}`.trim()
            : "Missing student",
          requesterId: trial.requestedBy,
          requesterName: requester ? accountName(requester) : "Missing contact",
          requesterEmail: primaryEmail(requester?.email),
          requesterPhone: requester?.phone?.trim() || undefined,
          classId: trial.classId,
          classTitle: classItem?.title || "Missing class",
          sessionId: trial.sessionId,
          sessionDate: session?.date,
          sessionStartTime: session?.startTime,
          sessionEndTime: session?.endTime,
          absenceReason: attendance?.reason,
          markedAbsentAt: attendance?.markedAt,
          requestedAt: trial.createdAt,
          followUpNotes: trial.followUpNotes,
        };
      }),
    );
    desertedTrials.sort(
      (left, right) =>
        (right.sessionDate || "").localeCompare(left.sessionDate || "") ||
        (right.sessionStartTime || "").localeCompare(
          left.sessionStartTime || "",
        ),
    );

    return { incompleteOnboarding, desertedTrials };
  },
});

export const adminUpdateTrialFollowUpNotes = mutation({
  args: {
    trialRequestId: v.id("trialRequests"),
    notes: v.string(),
  },
  handler: async (ctx, { trialRequestId, notes }) => {
    await requireAdmin(ctx);
    const trial = await ctx.db.get(trialRequestId);
    if (!trial) throw new Error("Trial request not found.");
    const cleanedNotes = notes.trim();
    if (cleanedNotes.length > 2000) {
      throw new Error("Follow-up notes must be 2000 characters or fewer.");
    }
    await ctx.db.patch(trialRequestId, {
      followUpNotes: cleanedNotes || undefined,
      updatedAt: Date.now(),
    });
    return { notes: cleanedNotes || undefined };
  },
});

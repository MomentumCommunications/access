import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import { hasUserRole } from "./lib/roles";
import { calculateAgeOnDate, classMatchesAge } from "./lib/age";
import { todayValue } from "./lib/scheduling";
import { classVisibleToStudentGroup } from "../shared/class-enrollment-policy";
import { resolvedClassEnrollmentOpen } from "../shared/class-enrollment-selection";
import { occupiesSessionCapacity } from "../shared/per-session-signup";
import {
  isEligibleTrialSession,
  trialRequestNextStatus,
  validatePaidTrialPrice,
} from "../shared/trials";
import {
  pendingTrialNotification,
  trialOutcomeNotification,
} from "../shared/notifications";
import {
  createAdminNotifications,
  createNotifications,
} from "./lib/notifications";
import { recordActivityEvent } from "./lib/activityLog";

const trialStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("cancelled"),
);

const trialReviewActionValidator = v.union(
  v.literal("approve"),
  v.literal("reject"),
);

type TrialCtx = QueryCtx | MutationCtx;

async function requireAdmin(ctx: TrialCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  if (!hasUserRole(user, "admin")) throw new Error("Unauthorized");
  return user;
}

function studentName(student: Doc<"students">) {
  return (
    student.preferredName || `${student.firstName} ${student.lastName}`.trim()
  );
}

async function managedStudent(
  ctx: TrialCtx,
  userId: Id<"users">,
  studentId: Id<"students">,
) {
  const contacts = await ctx.db
    .query("studentContacts")
    .withIndex("byUser", (q) => q.eq("user", userId))
    .collect();
  const contact = contacts.find(
    (candidate) =>
      candidate.student === studentId && candidate.canManage,
  );
  const student = contact ? await ctx.db.get(studentId) : null;
  return student?.status === "active" ? student : null;
}

function assertTrialAccountReady(user: Doc<"users">) {
  if (
    user.onboardingStatus !== "complete" ||
    !user.contractTypeSigned ||
    !user.contractVersionSigned ||
    !user.contractSignedAt
  ) {
    throw new Error(
      "Complete onboarding and the client agreement before requesting a trial.",
    );
  }
}

async function requesterHousehold(ctx: TrialCtx, userId: Id<"users">) {
  const membership = await ctx.db
    .query("householdMembers")
    .withIndex("byUser", (q) => q.eq("userId", userId))
    .first();
  if (!membership || !(await ctx.db.get(membership.householdId))) {
    throw new Error(
      "Your household billing setup is incomplete. Please contact the studio.",
    );
  }
  return membership.householdId;
}

async function validateTrialClassForStudent(
  ctx: TrialCtx,
  classItem: Doc<"classes">,
  student: Doc<"students">,
) {
  if (
    classItem.status !== "published" ||
    !resolvedClassEnrollmentOpen(classItem.enrollmentOpen)
  ) {
    throw new Error("This class is not available for trial requests.");
  }
  if (
    !classVisibleToStudentGroup({
      studentGroupId: student.groupId,
      visibleToGroupIds: classItem.visibleToGroupIds,
    })
  ) {
    throw new Error("This class is not available for this student.");
  }
  const age = calculateAgeOnDate(
    student.dateOfBirth,
    todayValue(classItem.timezone),
  );
  if (!classMatchesAge(classItem, age)) {
    throw new Error("This class does not match the student's age.");
  }
}

async function hasActiveTrialForClass(
  ctx: TrialCtx,
  studentId: Id<"students">,
  classId: Id<"classes">,
) {
  const requests = await ctx.db
    .query("trialRequests")
    .withIndex("byStudent", (q) => q.eq("studentId", studentId))
    .collect();
  return requests.some(
    (request) =>
      request.classId === classId &&
      (request.status === "pending" || request.status === "approved"),
  );
}

async function upcomingSessions(ctx: TrialCtx, classItem: Doc<"classes">) {
  const today = todayValue(classItem.timezone);
  return (
    await ctx.db
      .query("sessions")
      .withIndex("byClass", (q) => q.eq("classId", classItem._id))
      .collect()
  )
    .filter((session) =>
      isEligibleTrialSession({
        sessionClassId: session.classId,
        requestedClassId: classItem._id,
        sessionDate: session.date,
        today,
        active: session.active,
        status: session.status,
      }),
    )
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        (left.startTime || "").localeCompare(right.startTime || ""),
    );
}

export const listMyStudents = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    assertTrialAccountReady(user);
    const contacts = await ctx.db
      .query("studentContacts")
      .withIndex("byUser", (q) => q.eq("user", user._id))
      .collect();
    const rows = await Promise.all(
      contacts
        .filter((contact) => contact.canManage)
        .map(async (contact) => {
          const student = await ctx.db.get(contact.student);
          if (!student || student.status !== "active") return null;
          return {
            id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            preferredName: student.preferredName,
            dateOfBirth: student.dateOfBirth,
            photoUrl: student.photo
              ? await ctx.storage.getUrl(student.photo)
              : null,
          };
        }),
    );
    return rows.filter((row) => row !== null);
  },
});

export const listAvailableClasses = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const user = await getCurrentUserOrThrow(ctx);
    assertTrialAccountReady(user);
    const student = await managedStudent(ctx, user._id, studentId);
    if (!student) throw new Error("Student not found.");
    const classes = await ctx.db
      .query("classes")
      .withIndex("byStatus", (q) => q.eq("status", "published"))
      .collect();
    const activeTrialClassIds = new Set(
      (
        await ctx.db
          .query("trialRequests")
          .withIndex("byStudent", (q) => q.eq("studentId", studentId))
          .collect()
      )
        .filter(
          (request) =>
            request.status === "pending" || request.status === "approved",
        )
        .map((request) => request.classId),
    );
    const rows = await Promise.all(
      classes.map(async (classItem) => {
        try {
          await validateTrialClassForStudent(ctx, classItem, student);
        } catch {
          return null;
        }
        if (activeTrialClassIds.has(classItem._id)) {
          return null;
        }
        const sessions = await upcomingSessions(ctx, classItem);
        if (sessions.length === 0) return null;
        return {
          classItem: {
            id: classItem._id,
            title: classItem.title,
            description: classItem.description,
            scheduleSummary: classItem.scheduleSummary,
            location: classItem.location,
            startTime: classItem.startTime,
            endTime: classItem.endTime,
            suggestedTrialPriceCents: classItem.perSessionPriceCents,
          },
          nextSessionDate: sessions[0].date,
          sessionCount: sessions.length,
        };
      }),
    );
    return rows.filter((row) => row !== null);
  },
});

export const getClassRequestView = query({
  args: { classId: v.id("classes"), studentId: v.id("students") },
  handler: async (ctx, { classId, studentId }) => {
    const user = await getCurrentUserOrThrow(ctx);
    assertTrialAccountReady(user);
    const [student, classItem] = await Promise.all([
      managedStudent(ctx, user._id, studentId),
      ctx.db.get(classId),
    ]);
    if (!student || !classItem) return null;
    await validateTrialClassForStudent(ctx, classItem, student);
    const existingRequests = await ctx.db
      .query("trialRequests")
      .withIndex("byStudent", (q) => q.eq("studentId", studentId))
      .collect();
    const existing = existingRequests
      .filter((request) => request.classId === classId)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    return {
      student: {
        id: student._id,
        name: studentName(student),
      },
      classItem: {
        id: classItem._id,
        title: classItem.title,
        description: classItem.description,
        scheduleSummary: classItem.scheduleSummary,
        location: classItem.location,
        suggestedTrialPriceCents: classItem.perSessionPriceCents,
      },
      sessions: (await upcomingSessions(ctx, classItem)).map((session) => ({
        id: session._id,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        location: session.location,
      })),
      existingRequest: existing
        ? {
            id: existing._id,
            status: existing.status,
            sessionId: existing.sessionId,
          }
        : null,
    };
  },
});

export const submit = mutation({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, { studentId, classId, sessionId }) => {
    const user = await getCurrentUserOrThrow(ctx);
    assertTrialAccountReady(user);
    const [student, classItem, session] = await Promise.all([
      managedStudent(ctx, user._id, studentId),
      ctx.db.get(classId),
      ctx.db.get(sessionId),
    ]);
    if (!student || !classItem || !session) {
      throw new Error("The selected trial is unavailable.");
    }
    await validateTrialClassForStudent(ctx, classItem, student);
    if (
      !isEligibleTrialSession({
        sessionClassId: session.classId,
        requestedClassId: classId,
        sessionDate: session.date,
        today: todayValue(classItem.timezone),
        active: session.active,
        status: session.status,
      })
    ) {
      throw new Error("The selected session is unavailable.");
    }
    if (await hasActiveTrialForClass(ctx, studentId, classId)) {
      throw new Error("This student already has an active trial request for this class.");
    }
    const existingSignup = await ctx.db
      .query("classSessionSignups")
      .withIndex("bySessionStudent", (q) =>
        q.eq("session", sessionId).eq("student", studentId),
      )
      .unique();
    if (existingSignup && occupiesSessionCapacity(existingSignup.status)) {
      throw new Error("This student is already connected to that session.");
    }
    const enrollment = await ctx.db
      .query("classEnrollments")
      .withIndex("byClassStudent", (q) =>
        q.eq("classId", classId).eq("student", studentId),
      )
      .unique();
    if (
      enrollment &&
      (enrollment.status === "enrolled" || enrollment.status === "pending") &&
      (!enrollment.startDate || enrollment.startDate <= session.date) &&
      (!enrollment.endDate || enrollment.endDate >= session.date)
    ) {
      throw new Error("This student is already connected to this class.");
    }
    const householdId = await requesterHousehold(ctx, user._id);
    const now = Date.now();
    const trialRequestId = await ctx.db.insert("trialRequests", {
      requestedBy: user._id,
      householdId,
      studentId,
      classId,
      sessionId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await createAdminNotifications(
      ctx,
      pendingTrialNotification({
        trialRequestId,
        requestedBy: user._id,
        studentName: studentName(student),
        className: classItem.title,
        sessionDate: session.date,
      }),
      user._id,
    );
    await recordActivityEvent(ctx, {
      entityType: "trialRequest",
      entityId: trialRequestId,
      actorId: user._id,
      eventType: "trial_requested",
      summary: `${studentName(student)} requested a paid trial for ${classItem.title}.`,
      metadata: { studentId, classId, sessionId, householdId },
    });
    return trialRequestId;
  },
});

export const adminList = query({
  args: { status: v.optional(trialStatusValidator) },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx);
    const requests = status
      ? await ctx.db
          .query("trialRequests")
          .withIndex("byStatus", (q) => q.eq("status", status))
          .collect()
      : await ctx.db.query("trialRequests").collect();
    const rows = await Promise.all(
      requests.map(async (request) => {
        const [student, classItem, session, requester, household] =
          await Promise.all([
            ctx.db.get(request.studentId),
            ctx.db.get(request.classId),
            ctx.db.get(request.sessionId),
            ctx.db.get(request.requestedBy),
            ctx.db.get(request.householdId),
          ]);
        if (!student || !classItem || !session || !requester) return null;
        const payers = await ctx.db
          .query("householdPayers")
          .withIndex("byHousehold", (q) =>
            q.eq("householdId", request.householdId),
          )
          .collect();
        const primary = payers.find(
          (payer) => payer.active && payer.isPrimary,
        );
        const payerUser = primary ? await ctx.db.get(primary.userId) : null;
        return {
          request,
          student,
          classItem,
          session,
          requester,
          household,
          billing: {
            hasPrimaryPayer: Boolean(primary),
            stripeCustomerReady: Boolean(payerUser?.stripeCustomerId),
            suggestedPriceCents: classItem.perSessionPriceCents,
          },
        };
      }),
    );
    return rows
      .filter((row) => row !== null)
      .sort((a, b) => b.request.createdAt - a.request.createdAt);
  },
});

export const adminGetBillingAccount = query({
  args: { trialRequestId: v.id("trialRequests") },
  handler: async (ctx, { trialRequestId }) => {
    await requireAdmin(ctx);
    const request = await ctx.db.get(trialRequestId);
    if (
      !request ||
      (request.status !== "pending" && request.status !== "approved")
    ) {
      throw new Error("Pending or approved trial request not found.");
    }
    const payers = await ctx.db
      .query("householdPayers")
      .withIndex("byHousehold", (q) =>
        q.eq("householdId", request.householdId),
      )
      .collect();
    const primary = payers.find((payer) => payer.active && payer.isPrimary);
    if (!primary) {
      throw new Error("The household does not have an active primary payer.");
    }
    const account = await ctx.db.get(primary.userId);
    if (!account) throw new Error("The household payer account is missing.");
    const [student, classItem, session] = await Promise.all([
      ctx.db.get(request.studentId),
      ctx.db.get(request.classId),
      ctx.db.get(request.sessionId),
    ]);
    if (!student || !classItem || !session) {
      throw new Error("The trial request references missing records.");
    }
    return {
      account,
      autopayEnabled: primary.autopayEnabled,
      request: {
        id: request._id,
        status: request.status,
        stripeInvoiceId: request.stripeInvoiceId,
        unitPriceCents: request.unitPriceCents,
        sessionSignupId: request.sessionSignupId,
      },
      studentName: studentName(student),
      className: classItem.title,
      sessionDate: session.date,
    };
  },
});

export const adminRecordTrialDraftInvoice = mutation({
  args: {
    trialRequestId: v.id("trialRequests"),
    stripeInvoiceId: v.string(),
    unitPriceCents: v.number(),
  },
  handler: async (
    ctx,
    { trialRequestId, stripeInvoiceId, unitPriceCents },
  ) => {
    const admin = await requireAdmin(ctx);
    const request = await ctx.db.get(trialRequestId);
    if (
      !request ||
      (request.status !== "pending" && request.status !== "approved")
    ) {
      throw new Error("Pending or approved trial request not found.");
    }
    const price = validatePaidTrialPrice(unitPriceCents);
    if (
      request.stripeInvoiceId &&
      request.stripeInvoiceId !== stripeInvoiceId
    ) {
      throw new Error("This trial already has a different Stripe invoice.");
    }
    if (
      request.unitPriceCents !== undefined &&
      request.unitPriceCents !== price
    ) {
      throw new Error(
        "This trial already has a draft invoice at a different price.",
      );
    }
    await ctx.db.patch(trialRequestId, {
      stripeInvoiceId,
      unitPriceCents: price,
      billingStatus: "draft_invoice",
      updatedAt: Date.now(),
    });
    await recordActivityEvent(ctx, {
      entityType: "trialRequest",
      entityId: trialRequestId,
      actorId: admin._id,
      eventType: "trial_draft_invoice_created",
      summary: "Created a Stripe draft invoice for a paid trial.",
      metadata: { stripeInvoiceId, unitPriceCents: price },
    });
    return null;
  },
});

export const adminReview = mutation({
  args: {
    trialRequestId: v.id("trialRequests"),
    action: trialReviewActionValidator,
    unitPriceCents: v.optional(v.number()),
  },
  handler: async (ctx, { trialRequestId, action, unitPriceCents }) => {
    const admin = await requireAdmin(ctx);
    const request = await ctx.db.get(trialRequestId);
    if (!request) throw new Error("Trial request not found.");
    const nextStatus = trialRequestNextStatus(request.status, action);
    const [student, classItem, session] = await Promise.all([
      ctx.db.get(request.studentId),
      ctx.db.get(request.classId),
      ctx.db.get(request.sessionId),
    ]);
    if (!student || !classItem || !session) {
      throw new Error("The trial request references missing records.");
    }
    const now = Date.now();
    let signupId = request.sessionSignupId;
    if (action === "approve") {
      const price = validatePaidTrialPrice(unitPriceCents ?? 0);
      if (!request.stripeInvoiceId) {
        throw new Error("Create the Stripe draft invoice before approval.");
      }
      if (
        request.unitPriceCents !== undefined &&
        request.unitPriceCents !== price
      ) {
        throw new Error("The approval price does not match the draft invoice.");
      }
      const payers = await ctx.db
        .query("householdPayers")
        .withIndex("byHousehold", (q) =>
          q.eq("householdId", request.householdId),
        )
        .collect();
      const primary = payers.find((payer) => payer.active && payer.isPrimary);
      const payerAccount = primary ? await ctx.db.get(primary.userId) : null;
      if (!payerAccount?.stripeCustomerId) {
        throw new Error("Prepare the household Stripe customer before approval.");
      }
      if (!session.active || session.status === "cancelled") {
        throw new Error("The selected session is no longer available.");
      }
      const existing = await ctx.db
        .query("classSessionSignups")
        .withIndex("bySessionStudent", (q) =>
          q.eq("session", request.sessionId).eq("student", request.studentId),
        )
        .unique();
      if (existing && existing.status !== "cancelled") {
        throw new Error("The student is already connected to this session.");
      }
      if (existing) {
        signupId = existing._id;
        await ctx.db.patch(existing._id, {
          classId: request.classId,
          requestedBy: request.requestedBy,
          status: "enrolled",
          unitPriceCents: price,
          trialRequestId,
          updatedAt: now,
        });
      } else {
        signupId = await ctx.db.insert("classSessionSignups", {
          classId: request.classId,
          session: request.sessionId,
          student: request.studentId,
          requestedBy: request.requestedBy,
          status: "enrolled",
          unitPriceCents: price,
          trialRequestId,
          createdAt: now,
          updatedAt: now,
        });
      }
      await ctx.db.patch(trialRequestId, {
        status: nextStatus,
        unitPriceCents: price,
        billingStatus: "draft_invoice",
        sessionSignupId: signupId,
        reviewedBy: admin._id,
        reviewedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(trialRequestId, {
        status: nextStatus,
        reviewedBy: admin._id,
        reviewedAt: now,
        updatedAt: now,
      });
    }
    await createNotifications(ctx, {
      recipientUserIds: [request.requestedBy],
      event: trialOutcomeNotification({
        trialRequestId,
        actorUserId: admin._id,
        outcome: nextStatus,
        studentName: studentName(student),
        className: classItem.title,
        sessionDate: session.date,
      }),
    });
    await recordActivityEvent(ctx, {
      entityType: "trialRequest",
      entityId: trialRequestId,
      actorId: admin._id,
      eventType: action === "approve" ? "trial_approved" : "trial_rejected",
      summary: `${studentName(student)}'s paid trial for ${classItem.title} was ${nextStatus}.`,
      metadata: {
        studentId: request.studentId,
        classId: request.classId,
        sessionId: request.sessionId,
        signupId,
        stripeInvoiceId: request.stripeInvoiceId,
        unitPriceCents: action === "approve" ? unitPriceCents : undefined,
      },
    });
    return { status: nextStatus, signupId };
  },
});

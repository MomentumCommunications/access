import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { hasUserRole } from "./lib/roles";
import { buildPrivateChargeSnapshot } from "./lib/billing/privatePricing";
import { syncGeneratedPrivateLessons } from "./lib/privateScheduling";
import { getCurrentUserOrThrow } from "./users";
import {
  privateParticipantPatch,
  privateParticipantTransition,
} from "../shared/private-lesson-status";

const weekdayValidator = v.union(
  v.literal("sunday"),
  v.literal("monday"),
  v.literal("tuesday"),
  v.literal("wednesday"),
  v.literal("thursday"),
  v.literal("friday"),
  v.literal("saturday"),
);

const schedulePromptValidator = v.object({
  startDate: v.string(),
  endDate: v.string(),
  startTime: v.string(),
  weekdays: v.array(weekdayValidator),
  timezone: v.string(),
});

const lessonStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("completed"),
  v.literal("cancelled"),
);

const studentStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("attended"),
  v.literal("excused"),
  v.literal("no_show"),
  v.literal("cancelled"),
);

type DbCtx = QueryCtx | MutationCtx;
type SchedulePrompt = Doc<"privates">["schedulePrompt"];

function cleanOptionalText(value?: string) {
  return value?.trim() || undefined;
}

function validateTextLengths(name: string, notes?: string) {
  if (name.length > 120) {
    throw new Error("Private name must be 120 characters or fewer.");
  }
  if (notes && notes.length > 2000) {
    throw new Error("Notes must be 2000 characters or fewer.");
  }
}

function validateNotes(notes?: string) {
  if (notes && notes.length > 2000) {
    throw new Error("Notes must be 2000 characters or fewer.");
  }
}

function validateDuration(durationMinutes: number) {
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 480
  ) {
    throw new Error("Duration must be a whole number between 1 and 480.");
  }
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validateSchedulePrompt(schedule: SchedulePrompt) {
  if (!isIsoDate(schedule.startDate) || !isIsoDate(schedule.endDate)) {
    throw new Error("Private schedule dates must use valid YYYY-MM-DD values.");
  }
  if (schedule.endDate < schedule.startDate) {
    throw new Error("The schedule end date must be on or after its start date.");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.startTime)) {
    throw new Error("The schedule start time must use HH:MM military time.");
  }
  if (schedule.weekdays.length === 0) {
    throw new Error("Select at least one weekday.");
  }
  if (new Set(schedule.weekdays).size !== schedule.weekdays.length) {
    throw new Error("Schedule weekdays cannot contain duplicates.");
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: schedule.timezone }).format();
  } catch {
    throw new Error("The schedule timezone is invalid.");
  }
}

async function requireAdmin(ctx: DbCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  if (!hasUserRole(user, "admin")) {
    throw new Error("Unauthorized");
  }
  return user;
}

async function requirePrivateAccess(
  ctx: DbCtx,
  privateId: Id<"privates">,
) {
  const user = await getCurrentUserOrThrow(ctx);
  const privateSeries = await ctx.db.get(privateId);
  if (!privateSeries) {
    throw new Error("Private not found.");
  }
  if (
    !hasUserRole(user, "admin") &&
    privateSeries.instructorId !== user._id
  ) {
    throw new Error("Unauthorized");
  }
  return { user, privateSeries };
}

async function requireLessonAccess(
  ctx: DbCtx,
  privateLessonId: Id<"privateLessons">,
) {
  const lesson = await ctx.db.get(privateLessonId);
  if (!lesson) {
    throw new Error("Private lesson not found.");
  }
  const access = await requirePrivateAccess(ctx, lesson.privateId);
  return { ...access, lesson };
}

async function validateInstructor(
  ctx: DbCtx,
  instructorId: Id<"users">,
) {
  const instructor = await ctx.db.get(instructorId);
  if (
    !instructor ||
    (!hasUserRole(instructor, "staff") && !hasUserRole(instructor, "admin"))
  ) {
    throw new Error("The selected instructor must be a staff member.");
  }
}

async function validateStudents(
  ctx: DbCtx,
  studentIds: Id<"students">[],
) {
  if (studentIds.length > 3) {
    throw new Error("A private lesson can include at most three students.");
  }
  if (new Set(studentIds).size !== studentIds.length) {
    throw new Error("A student can only be added to a lesson once.");
  }
  const students = await Promise.all(
    studentIds.map((studentId) => ctx.db.get(studentId)),
  );
  if (students.some((student) => !student)) {
    throw new Error("One or more selected students no longer exist.");
  }
}

async function insertLessonStudents(
  ctx: MutationCtx,
  privateLessonId: Id<"privateLessons">,
  studentIds: Id<"students">[],
  status: "scheduled" | "cancelled" = "scheduled",
) {
  await validateStudents(ctx, studentIds);
  await Promise.all(
    studentIds.map((studentId) =>
      ctx.db.insert("privateLessonStudents", {
        privateLessonId,
        studentId,
        status,
        billable: false,
      }),
    ),
  );
}

export const adminListPrivates = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const privateSeries = await ctx.db.query("privates").collect();
    return await Promise.all(
      privateSeries.map(async (series) => {
        const lessons = await ctx.db
          .query("privateLessons")
          .withIndex("byPrivate", (q) => q.eq("privateId", series._id))
          .collect();
        return {
          private: series,
          instructor: await ctx.db.get(series.instructorId),
          lessonCount: lessons.length,
          nextLessonStartsAt: lessons
            .filter(
              (lesson) =>
                lesson.status === "scheduled" &&
                lesson.startsAt >= Date.now(),
            )
            .sort((a, b) => a.startsAt - b.startsAt)[0]?.startsAt,
        };
      }),
    );
  },
});

export const getPrivate = query({
  args: { privateId: v.id("privates") },
  handler: async (ctx, { privateId }) => {
    const { privateSeries } = await requirePrivateAccess(ctx, privateId);
    const lessons = await ctx.db
      .query("privateLessons")
      .withIndex("byPrivate", (q) => q.eq("privateId", privateId))
      .collect();

    return {
      private: privateSeries,
      instructor: await ctx.db.get(privateSeries.instructorId),
      defaultStudents: await Promise.all(
        (privateSeries.studentIds || []).map((studentId) =>
          ctx.db.get(studentId),
        ),
      ),
      lessons: await Promise.all(
        lessons
          .sort((a, b) => a.startsAt - b.startsAt)
          .map(async (lesson) => {
            const participation = await ctx.db
              .query("privateLessonStudents")
              .withIndex("byPrivateLesson", (q) =>
                q.eq("privateLessonId", lesson._id),
              )
              .collect();
            return {
              lesson,
              students: await Promise.all(
                participation.map(async (row) => ({
                  participation: row,
                  student: await ctx.db.get(row.studentId),
                })),
              ),
            };
          }),
      ),
    };
  },
});

export const getPrivateLesson = query({
  args: { privateLessonId: v.id("privateLessons") },
  handler: async (ctx, { privateLessonId }) => {
    const { lesson, privateSeries } = await requireLessonAccess(
      ctx,
      privateLessonId,
    );
    const participation = await ctx.db
      .query("privateLessonStudents")
      .withIndex("byPrivateLesson", (q) =>
        q.eq("privateLessonId", privateLessonId),
      )
      .collect();

    return {
      lesson,
      private: privateSeries,
      instructor: await ctx.db.get(privateSeries.instructorId),
      availableStudents: await ctx.db.query("students").collect(),
      students: await Promise.all(
        participation.map(async (row) => ({
          participation: row,
          student: await ctx.db.get(row.studentId),
        })),
      ),
    };
  },
});

export const listMyPrivateLessons = query({
  args: {
    startsAtOrAfter: v.optional(v.number()),
    startsBefore: v.optional(v.number()),
  },
  handler: async (ctx, { startsAtOrAfter, startsBefore }) => {
    const user = await getCurrentUserOrThrow(ctx);
    if (!hasUserRole(user, "staff") && !hasUserRole(user, "admin")) {
      throw new Error("Unauthorized");
    }

    const privateSeries = hasUserRole(user, "admin")
      ? await ctx.db.query("privates").collect()
      : await ctx.db
          .query("privates")
          .withIndex("byInstructor", (q) => q.eq("instructorId", user._id))
          .collect();

    const rows = (
      await Promise.all(
        privateSeries.map(async (series) => {
          const lessons = await ctx.db
            .query("privateLessons")
            .withIndex("byPrivate", (q) => q.eq("privateId", series._id))
            .collect();
          return await Promise.all(
            lessons
              .filter(
                (lesson) =>
                  (startsAtOrAfter === undefined ||
                    lesson.startsAt >= startsAtOrAfter) &&
                  (startsBefore === undefined ||
                    lesson.startsAt < startsBefore),
              )
              .map(async (lesson) => ({
                private: series,
                lesson,
                students: await Promise.all(
                  (
                    await ctx.db
                      .query("privateLessonStudents")
                      .withIndex("byPrivateLesson", (q) =>
                        q.eq("privateLessonId", lesson._id),
                      )
                      .collect()
                  ).map(async (participation) => ({
                    participation,
                    student: await ctx.db.get(participation.studentId),
                  })),
                ),
              })),
          );
        }),
      )
    ).flat();

    return rows.sort((a, b) => a.lesson.startsAt - b.lesson.startsAt);
  },
});

export const adminCreatePrivate = mutation({
  args: {
    name: v.string(),
    instructorId: v.id("users"),
    studentIds: v.array(v.id("students")),
    defaultDurationMinutes: v.number(),
    schedulePrompt: schedulePromptValidator,
    isActive: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    if (!name) {
      throw new Error("Private name is required.");
    }
    validateTextLengths(name, args.notes);
    validateDuration(args.defaultDurationMinutes);
    validateSchedulePrompt(args.schedulePrompt);
    await validateInstructor(ctx, args.instructorId);
    await validateStudents(ctx, args.studentIds);
    if (args.studentIds.length === 0) {
      throw new Error("Select at least one student.");
    }

    const privateId = await ctx.db.insert("privates", {
      ...args,
      name,
      notes: cleanOptionalText(args.notes),
    });
    const privateSeries = await ctx.db.get(privateId);
    if (privateSeries) {
      await syncGeneratedPrivateLessons(ctx, privateSeries);
    }
    return privateId;
  },
});

export const adminUpdatePrivate = mutation({
  args: {
    privateId: v.id("privates"),
    name: v.string(),
    instructorId: v.id("users"),
    studentIds: v.array(v.id("students")),
    defaultDurationMinutes: v.number(),
    schedulePrompt: schedulePromptValidator,
    isActive: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { privateId, ...patch }) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(privateId))) {
      throw new Error("Private not found.");
    }
    const name = patch.name.trim();
    if (!name) {
      throw new Error("Private name is required.");
    }
    validateTextLengths(name, patch.notes);
    validateDuration(patch.defaultDurationMinutes);
    validateSchedulePrompt(patch.schedulePrompt);
    await validateInstructor(ctx, patch.instructorId);
    await validateStudents(ctx, patch.studentIds);
    if (patch.studentIds.length === 0) {
      throw new Error("Select at least one student.");
    }

    await ctx.db.patch(privateId, {
      ...patch,
      name,
      notes: cleanOptionalText(patch.notes),
    });
    const privateSeries = await ctx.db.get(privateId);
    if (privateSeries) {
      return await syncGeneratedPrivateLessons(ctx, privateSeries);
    }
    return { created: 0, updated: 0, removed: 0 };
  },
});

export const adminGeneratePrivateLessons = mutation({
  args: { privateId: v.id("privates") },
  handler: async (ctx, { privateId }) => {
    await requireAdmin(ctx);
    const privateSeries = await ctx.db.get(privateId);
    if (!privateSeries) {
      throw new Error("Private not found.");
    }
    return await syncGeneratedPrivateLessons(ctx, privateSeries);
  },
});

export const adminCreatePrivateLesson = mutation({
  args: {
    privateId: v.id("privates"),
    startsAt: v.number(),
    durationMinutes: v.optional(v.number()),
    status: v.optional(lessonStatusValidator),
    notes: v.optional(v.string()),
    studentIds: v.array(v.id("students")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const privateSeries = await ctx.db.get(args.privateId);
    if (!privateSeries) {
      throw new Error("Private not found.");
    }
    const durationMinutes =
      args.durationMinutes ?? privateSeries.defaultDurationMinutes;
    validateDuration(durationMinutes);
    if (!Number.isFinite(args.startsAt)) {
      throw new Error("Lesson start time is invalid.");
    }
    validateNotes(args.notes);
    await validateStudents(ctx, args.studentIds);

    const duplicate = await ctx.db
      .query("privateLessons")
      .withIndex("byPrivateStartsAt", (q) =>
        q.eq("privateId", args.privateId).eq("startsAt", args.startsAt),
      )
      .first();
    if (duplicate) {
      throw new Error("A lesson already exists at that time.");
    }

    const privateLessonId = await ctx.db.insert("privateLessons", {
      privateId: args.privateId,
      startsAt: args.startsAt,
      durationMinutes,
      status: args.status || "scheduled",
      generatedFromSchedule: false,
      notes: cleanOptionalText(args.notes),
    });
    await insertLessonStudents(
      ctx,
      privateLessonId,
      args.studentIds,
      args.status === "cancelled" ? "cancelled" : "scheduled",
    );
    return privateLessonId;
  },
});

export const updatePrivateLesson = mutation({
  args: {
    privateLessonId: v.id("privateLessons"),
    startsAt: v.number(),
    durationMinutes: v.number(),
    status: lessonStatusValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { privateLessonId, ...patch }) => {
    const { lesson } = await requireLessonAccess(ctx, privateLessonId);
    validateDuration(patch.durationMinutes);
    if (!Number.isFinite(patch.startsAt)) {
      throw new Error("Lesson start time is invalid.");
    }
    validateNotes(patch.notes);

    const duplicate = await ctx.db
      .query("privateLessons")
      .withIndex("byPrivateStartsAt", (q) =>
        q.eq("privateId", lesson.privateId).eq("startsAt", patch.startsAt),
      )
      .first();
    if (duplicate && duplicate._id !== privateLessonId) {
      throw new Error("A lesson already exists at that time.");
    }

    const participantTransition = privateParticipantTransition(
      lesson.status,
      patch.status,
    );
    const students =
      participantTransition === "preserve"
        ? []
        : await ctx.db
            .query("privateLessonStudents")
            .withIndex("byPrivateLesson", (q) =>
              q.eq("privateLessonId", privateLessonId),
            )
            .collect();
    const privateSeries =
      participantTransition === "mark_attended_billable"
        ? await ctx.db.get(lesson.privateId)
        : null;
    const snapshot =
      participantTransition === "mark_attended_billable" && privateSeries
        ? await buildPrivateChargeSnapshot(ctx, privateSeries, {
            ...lesson,
            durationMinutes: patch.durationMinutes,
          })
        : null;
    const participantPatch = privateParticipantPatch(
      participantTransition,
      snapshot
        ? {
            appliedPrivateRateId: snapshot.appliedPrivateRateId,
            appliedPriceCents: snapshot.appliedPriceCents,
          }
        : null,
    );

    await ctx.db.patch(privateLessonId, {
      ...patch,
      generatedFromSchedule: false,
      notes: cleanOptionalText(patch.notes),
    });

    if (participantPatch) {
      await Promise.all(
        students.map((student) =>
          ctx.db.patch(student._id, participantPatch),
        ),
      );
    }
  },
});

export const addPrivateLessonStudent = mutation({
  args: {
    privateLessonId: v.id("privateLessons"),
    studentId: v.id("students"),
  },
  handler: async (ctx, { privateLessonId, studentId }) => {
    const { lesson } = await requireLessonAccess(ctx, privateLessonId);
    if (lesson.status === "cancelled") {
      throw new Error("Students cannot be added to a cancelled lesson.");
    }
    await validateStudents(ctx, [studentId]);
    const existingStudents = await ctx.db
      .query("privateLessonStudents")
      .withIndex("byPrivateLesson", (q) =>
        q.eq("privateLessonId", privateLessonId),
      )
      .collect();
    if (existingStudents.length >= 3) {
      throw new Error("A private lesson can include at most three students.");
    }
    if (existingStudents.some((row) => row.studentId === studentId)) {
      throw new Error("That student is already on this lesson.");
    }
    const rowId = await ctx.db.insert("privateLessonStudents", {
      privateLessonId,
      studentId,
      status: "scheduled",
      billable: false,
    });
    await ctx.db.patch(privateLessonId, {
      participantsManuallyEdited: true,
    });
    return rowId;
  },
});

export const removePrivateLessonStudent = mutation({
  args: {
    privateLessonId: v.id("privateLessons"),
    studentId: v.id("students"),
  },
  handler: async (ctx, { privateLessonId, studentId }) => {
    await requireLessonAccess(ctx, privateLessonId);
    const row = await ctx.db
      .query("privateLessonStudents")
      .withIndex("byPrivateLessonStudent", (q) =>
        q.eq("privateLessonId", privateLessonId).eq("studentId", studentId),
      )
      .unique();
    if (row) {
      await ctx.db.delete(row._id);
      await ctx.db.patch(privateLessonId, {
        participantsManuallyEdited: true,
      });
    }
  },
});

export const updatePrivateLessonStudent = mutation({
  args: {
    privateLessonStudentId: v.id("privateLessonStudents"),
    status: studentStatusValidator,
    billable: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { privateLessonStudentId, ...patch }) => {
    const row = await ctx.db.get(privateLessonStudentId);
    if (!row) {
      throw new Error("Private lesson student record not found.");
    }
    const { lesson } = await requireLessonAccess(ctx, row.privateLessonId);
    if (lesson.status === "cancelled" && patch.status !== "cancelled") {
      throw new Error("Students on a cancelled lesson must remain cancelled.");
    }
    if (patch.status === "cancelled" && patch.billable) {
      throw new Error("Cancelled participation cannot be billable.");
    }
    validateNotes(patch.notes);
    const shouldSnapshot =
      patch.billable &&
      (!row.billable ||
        row.appliedPrivateRateId === undefined ||
        row.appliedPriceCents === undefined);
    const privateSeries = shouldSnapshot
      ? await ctx.db.get(lesson.privateId)
      : null;
    const snapshot =
      shouldSnapshot && privateSeries
        ? await buildPrivateChargeSnapshot(ctx, privateSeries, lesson)
        : null;
    await ctx.db.patch(privateLessonStudentId, {
      ...patch,
      appliedPrivateRateId: patch.billable
        ? snapshot?.appliedPrivateRateId || row.appliedPrivateRateId
        : undefined,
      appliedPriceCents: patch.billable
        ? snapshot?.appliedPriceCents ?? row.appliedPriceCents
        : undefined,
      notes: cleanOptionalText(patch.notes),
    });
  },
});

export const adminListBillablePrivateLessonStudents = query({
  args: {
    startsAtOrAfter: v.number(),
    startsBefore: v.number(),
  },
  handler: async (ctx, { startsAtOrAfter, startsBefore }) => {
    await requireAdmin(ctx);
    if (startsBefore <= startsAtOrAfter) {
      throw new Error("Billing range end must be after its start.");
    }
    const billableRows = await ctx.db
      .query("privateLessonStudents")
      .withIndex("byBillable", (q) => q.eq("billable", true))
      .collect();

    const rows = (
      await Promise.all(
        billableRows.map(async (participation) => {
          const lesson = await ctx.db.get(participation.privateLessonId);
          if (
            !lesson ||
            lesson.status !== "completed" ||
            lesson.startsAt < startsAtOrAfter ||
            lesson.startsAt >= startsBefore ||
            participation.status === "scheduled" ||
            participation.status === "cancelled"
          ) {
            return null;
          }
          const privateSeries = await ctx.db.get(lesson.privateId);
          return {
            participation,
            lesson,
            private: privateSeries,
            student: await ctx.db.get(participation.studentId),
            instructor: privateSeries
              ? await ctx.db.get(privateSeries.instructorId)
              : null,
          };
        }),
      )
    ).filter((row) => row !== null);

    return rows.sort((a, b) => a.lesson.startsAt - b.lesson.startsAt);
  },
});

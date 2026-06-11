import { fromZonedTime } from "date-fns-tz";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  expandRecurringSchedule,
  type RecurringSchedule,
} from "./scheduling.ts";

const MAX_GENERATED_LESSONS = 500;

export function expandPrivateLessonStarts(
  schedule: RecurringSchedule,
  holidays: Doc<"holidays">[],
) {
  const timezone = schedule.timezone || "America/New_York";
  const starts = expandRecurringSchedule(schedule, holidays).map((date) =>
    fromZonedTime(`${date}T${schedule.startTime}:00`, timezone).getTime(),
  );

  if (starts.some((startsAt) => !Number.isFinite(startsAt))) {
    throw new Error("The private schedule contains an invalid date or time.");
  }
  if (starts.length > MAX_GENERATED_LESSONS) {
    throw new Error(
      `A private schedule cannot generate more than ${MAX_GENERATED_LESSONS} lessons.`,
    );
  }

  return starts;
}

async function getLessonStudents(
  ctx: MutationCtx,
  lesson: Id<"privateLessons">,
) {
  return await ctx.db
    .query("privateLessonStudents")
    .withIndex("byPrivateLesson", (q) => q.eq("privateLessonId", lesson))
    .collect();
}

function hasParticipantState(
  rows: Doc<"privateLessonStudents">[],
) {
  return rows.some(
    (row) =>
      row.status !== "scheduled" ||
      row.billable ||
      !!row.notes,
  );
}

async function syncLessonStudents(
  ctx: MutationCtx,
  lessonId: Id<"privateLessons">,
  desiredStudentIds: Id<"students">[],
) {
  const rows = await getLessonStudents(ctx, lessonId);
  const desired = new Set(desiredStudentIds);
  let changed = false;

  for (const row of rows) {
    if (!desired.has(row.studentId)) {
      await ctx.db.delete(row._id);
      changed = true;
    } else {
      desired.delete(row.studentId);
    }
  }

  for (const studentId of desired) {
    await ctx.db.insert("privateLessonStudents", {
      privateLessonId: lessonId,
      studentId,
      status: "scheduled",
      billable: false,
    });
    changed = true;
  }

  return changed;
}

export async function syncGeneratedPrivateLessons(
  ctx: MutationCtx,
  privateSeries: Doc<"privates">,
) {
  if (!privateSeries.isActive) {
    return { created: 0, updated: 0, removed: 0 };
  }

  const holidays = await ctx.db.query("holidays").collect();
  const now = Date.now();
  const allDesiredStarts = new Set(
    expandPrivateLessonStarts(privateSeries.schedulePrompt, holidays),
  );
  const desiredStarts = new Set(
    [...allDesiredStarts].filter((startsAt) => startsAt >= now),
  );
  const lessons = await ctx.db
    .query("privateLessons")
    .withIndex("byPrivate", (q) => q.eq("privateId", privateSeries._id))
    .collect();

  let created = 0;
  let updated = 0;
  let removed = 0;
  const defaultStudentIds = privateSeries.studentIds || [];

  for (const lesson of lessons) {
    if (desiredStarts.has(lesson.startsAt)) {
      desiredStarts.delete(lesson.startsAt);
    }

    if (
      !lesson.generatedFromSchedule ||
      lesson.startsAt < now ||
      lesson.status !== "scheduled"
    ) {
      continue;
    }

    const participantRows = await getLessonStudents(ctx, lesson._id);
    const participantStateIsProtected =
      lesson.participantsManuallyEdited ||
      hasParticipantState(participantRows);

    if (!allDesiredStarts.has(lesson.startsAt)) {
      if (participantStateIsProtected) {
        continue;
      }
      await Promise.all(
        participantRows.map((row) => ctx.db.delete(row._id)),
      );
      await ctx.db.delete(lesson._id);
      removed += 1;
      continue;
    }

    if (lesson.durationMinutes !== privateSeries.defaultDurationMinutes) {
      await ctx.db.patch(lesson._id, {
        durationMinutes: privateSeries.defaultDurationMinutes,
      });
      updated += 1;
    }

    if (
      !participantStateIsProtected &&
      (await syncLessonStudents(ctx, lesson._id, defaultStudentIds))
    ) {
      updated += 1;
    }
  }

  for (const startsAt of desiredStarts) {
    const privateLessonId = await ctx.db.insert("privateLessons", {
      privateId: privateSeries._id,
      startsAt,
      durationMinutes: privateSeries.defaultDurationMinutes,
      status: "scheduled",
      generatedFromSchedule: true,
    });
    await Promise.all(
      defaultStudentIds.map((studentId) =>
        ctx.db.insert("privateLessonStudents", {
          privateLessonId,
          studentId,
          status: "scheduled",
          billable: false,
        }),
      ),
    );
    created += 1;
  }

  return { created, updated, removed };
}

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  absenceWeekResult,
  attendanceWeek,
  reconcileAbsenceWeeks,
  shiftDate,
} from "../shared/absence-alerts";
import {
  isAttendanceClassEligible,
  isAttendanceEnrollmentExpectedOnDate,
  zonedDateTimeParts,
} from "../shared/staff-attendance";
import { resolvedClassEnrollmentMode } from "../shared/per-session-signup";
import {
  adminNotificationRecipients,
  createNotifications,
} from "./lib/notifications";

/** No attendance-write hooks or recurring subscriptions: this runs once weekly. */
export const checkWeeklyAbsences = internalMutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, { now }) => {
    const timestamp = now ?? Date.now();
    const end = attendanceWeek(zonedDateTimeParts(new Date(timestamp)).date);
    const recentWeeks = [-21, -14, -7].map((days) => shiftDate(end, days));
    const start = recentWeeks[0];
    const students = new Map<Id<"students">, Doc<"students"> | null>();
    const classes = new Map<Id<"classes">, Doc<"classes"> | null>();
    const enrollments = new Map<Id<"classes">, Doc<"classEnrollments">[]>();
    type Status = Doc<"attendanceRecords">["status"] | undefined;
    const outcomes = new Map<Id<"students">, Map<string, Status[]>>();
    let sessionCount = 0;
    let attendanceCount = 0;

    async function getStudent(id: Id<"students">) {
      if (!students.has(id)) students.set(id, await ctx.db.get(id));
      return students.get(id);
    }

    async function loadRange(from: string, until: string) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("byDate", (q) => q.gte("date", from).lt("date", until))
        .collect();
      sessionCount += sessions.length;
      for (const session of sessions) {
        if (!session.active || session.status === "cancelled") continue;
        if (!classes.has(session.classId)) {
          classes.set(session.classId, await ctx.db.get(session.classId));
        }
        const classItem = classes.get(session.classId);
        if (!classItem || !isAttendanceClassEligible(classItem)) continue;
        const perSession =
          resolvedClassEnrollmentMode(classItem.enrollmentMode) ===
          "per_session";
        if (!perSession && !enrollments.has(session.classId)) {
          enrollments.set(
            session.classId,
            await ctx.db
              .query("classEnrollments")
              .withIndex("byClass", (q) => q.eq("classId", session.classId))
              .collect(),
          );
        }
        const [signups, additions, records] = await Promise.all([
          ctx.db
            .query("classSessionSignups")
            .withIndex("bySession", (q) => q.eq("session", session._id))
            .collect(),
          ctx.db
            .query("sessionStudents")
            .withIndex("bySession", (q) => q.eq("session", session._id))
            .collect(),
          ctx.db
            .query("attendanceRecords")
            .withIndex("bySession", (q) => q.eq("session", session._id))
            .collect(),
        ]);
        attendanceCount += records.length;
        const roster = new Set<Id<"students">>();
        for (const enrollment of enrollments.get(session.classId) || []) {
          if (
            !perSession &&
            isAttendanceEnrollmentExpectedOnDate(
              enrollment,
              (await getStudent(enrollment.student))?.status,
              session.date,
            )
          )
            roster.add(enrollment.student);
        }
        for (const signup of signups) {
          if (
            (perSession || signup.trialRequestId !== undefined) &&
            (signup.status === "enrolled" || signup.status === "pending")
          ) {
            roster.add(signup.student);
          }
        }
        for (const addition of additions) roster.add(addition.student);
        // Actual attendance still accounts for a student if their roster was edited later.
        for (const record of records) {
          if (record.status !== "absent") roster.add(record.student);
        }
        const attendance = new Map(
          records.map((record) => [record.student, record.status]),
        );
        const week = attendanceWeek(session.date);
        for (const student of roster) {
          if ((await getStudent(student))?.status !== "active") continue;
          const studentWeeks =
            outcomes.get(student) ?? new Map<string, Status[]>();
          const statuses = studentWeeks.get(week) ?? [];
          statuses.push(attendance.get(student));
          studentWeeks.set(week, statuses);
          outcomes.set(student, studentWeeks);
        }
      }
    }

    // Bootstrap from three completed calendar weeks. Subsequent runs retain teaching
    // weeks across closures, and reread recent data to pick up late marking/corrections.
    await loadRange(start, end);
    const candidates = [...outcomes.keys()];
    const states = new Map(
      await Promise.all(
        candidates.map(
          async (student) =>
            [
              student,
              await ctx.db
                .query("absenceAlertStates")
                .withIndex("byStudent", (q) => q.eq("student", student))
                .unique(),
            ] as const,
        ),
      ),
    );
    // Revalidate saved weeks too: holiday gaps must not freeze stale attendance.
    // At most three additional week ranges per candidate, shared across students.
    const olderWeeks = new Set(
      [...states.values()].flatMap((state) =>
        (state?.weeks ?? [])
          .filter(({ week }) => week < start)
          .map(({ week }) => week),
      ),
    );
    for (const week of [...olderWeeks].sort())
      await loadRange(week, shiftDate(week, 7));

    let recipients: Id<"users">[] | undefined;
    let alertCount = 0;
    for (const student of candidates) {
      const previous = states.get(student);
      const weeksToRefresh = new Set([
        ...recentWeeks,
        ...(previous?.weeks ?? []).map(({ week }) => week),
      ]);
      const refreshed = [...weeksToRefresh].map((week) => ({
        week,
        result: absenceWeekResult(outcomes.get(student)?.get(week) ?? []),
      }));
      const { shouldAlert, ...next } = reconcileAbsenceWeeks(
        previous ?? { weeks: [] },
        refreshed,
      );
      if (shouldAlert) {
        recipients ??= await adminNotificationRecipients(ctx);
        const studentDoc = students.get(student)!;
        await createNotifications(ctx, {
          recipientUserIds: recipients,
          createdAt: timestamp,
          event: {
            type: "attendance.absence_streak",
            title: "Three weeks of absences",
            body: `${studentDoc.firstName} ${studentDoc.lastName} missed all expected classes for three teaching weeks.`,
            href: `/admin/students/${student}/report`,
            dedupeKey: `attendance.absence_streak:${student}:${next.lastAlertStartWeek}`,
            entityType: "student",
            entityId: student,
            metadata: { weeks: next.weeks.map(({ week }) => week) },
          },
        });
        alertCount++;
      }
      const needsState =
        next.lastAlertStartWeek ||
        next.weeks.some((week) => week.result === "absent");
      if (previous && !needsState) {
        await ctx.db.delete(previous._id);
      } else if (previous) {
        if (
          previous.lastAlertStartWeek !== next.lastAlertStartWeek ||
          JSON.stringify(previous.weeks) !== JSON.stringify(next.weeks)
        ) {
          await ctx.db.patch(previous._id, next);
        }
      } else if (needsState) {
        await ctx.db.insert("absenceAlertStates", { student, ...next });
      }
    }
    return {
      studentCount: candidates.length,
      sessionCount,
      attendanceCount,
      alertCount,
    };
  },
});

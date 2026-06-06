import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

type DbCtx = QueryCtx | MutationCtx;

type ClassSchedule = Pick<
  Doc<"classes">,
  | "_id"
  | "location"
  | "assignedStaff"
  | "startDate"
  | "endDate"
  | "startTime"
  | "endTime"
  | "weekdays"
  | "timezone"
  | "scheduleVersion"
>;

export function hasCompleteSchedule(classItem: ClassSchedule) {
  return (
    !!classItem.startDate &&
    !!classItem.endDate &&
    !!classItem.startTime &&
    !!classItem.endTime &&
    !!classItem.weekdays?.length
  );
}

function dateFromValue(date: string) {
  return new Date(`${date}T12:00:00`);
}

function formatDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function todayValue(timezone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function isDateBetween(
  date: string,
  startDate?: string,
  endDate?: string,
) {
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

function isDateInHoliday(date: string, holidays: Doc<"holidays">[]) {
  return holidays.some(
    (holiday) => date >= holiday.startDate && date <= holiday.endDate,
  );
}

export function expandClassSchedule(
  classItem: ClassSchedule,
  holidays: Doc<"holidays">[],
) {
  if (!hasCompleteSchedule(classItem)) {
    return [];
  }

  const dates: string[] = [];
  const end = dateFromValue(classItem.endDate!);

  for (
    let cursor = dateFromValue(classItem.startDate!);
    cursor <= end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const date = formatDateValue(cursor);
    const weekday = WEEKDAYS[cursor.getDay()];
    if (
      classItem.weekdays?.includes(weekday) &&
      !isDateInHoliday(date, holidays)
    ) {
      dates.push(date);
    }
  }

  return dates;
}

export function isGeneratedSessionProtected(
  session: Pick<Doc<"sessions">, "date" | "hasManualOverride">,
  today: string,
  hasAttendance: boolean,
) {
  return session.date < today || !!session.hasManualOverride || hasAttendance;
}

async function sessionHasAttendance(ctx: DbCtx, session: Id<"sessions">) {
  const attendance = await ctx.db
    .query("attendanceRecords")
    .withIndex("bySession", (q) => q.eq("session", session))
    .first();
  return !!attendance;
}

export async function syncGeneratedSessionsForClass(
  ctx: MutationCtx,
  classItem: ClassSchedule,
) {
  if (!hasCompleteSchedule(classItem)) {
    return;
  }

  const holidays = await ctx.db.query("holidays").collect();
  const desiredDates = new Set(expandClassSchedule(classItem, holidays));
  const today = todayValue(classItem.timezone);
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("byClass", (q) => q.eq("classId", classItem._id))
    .collect();
  const generatedSessions = sessions.filter(
    (session) => session.source === "generated",
  );

  for (const session of generatedSessions) {
    const hasAttendance = await sessionHasAttendance(ctx, session._id);
    if (isGeneratedSessionProtected(session, today, hasAttendance)) {
      continue;
    }

    if (!desiredDates.has(session.date)) {
      await ctx.db.patch(session._id, { active: false });
      continue;
    }

    await ctx.db.patch(session._id, {
      active: true,
      scheduleVersion: classItem.scheduleVersion,
      startTime: classItem.startTime,
      endTime: classItem.endTime,
      location: classItem.location,
      assignedStaff: classItem.assignedStaff,
    });
    desiredDates.delete(session.date);
  }

  for (const date of desiredDates) {
    const duplicate = sessions.find(
      (session) => session.source === "generated" && session.date === date,
    );
    if (duplicate) {
      continue;
    }

    await ctx.db.insert("sessions", {
      classId: classItem._id,
      date,
      active: true,
      source: "generated",
      scheduleVersion: classItem.scheduleVersion,
      hasManualOverride: false,
      startTime: classItem.startTime,
      endTime: classItem.endTime,
      location: classItem.location,
      assignedStaff: classItem.assignedStaff,
      status: "scheduled",
    });
  }
}

export async function syncAllGeneratedSessions(ctx: MutationCtx) {
  const classes = await ctx.db.query("classes").collect();
  for (const classItem of classes) {
    await syncGeneratedSessionsForClass(ctx, classItem);
  }
}

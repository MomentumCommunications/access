export type WeeklyClassHoursInput = {
  studentId: string;
  enrollmentStatus: string;
  enrollmentStartDate?: string;
  enrollmentEndDate?: string;
  classStatus: string;
  classStartDate?: string;
  classEndDate?: string;
  startTime?: string;
  endTime?: string;
  weekdays?: string[];
};

export type StudentWeeklyMinutes = {
  studentId: string;
  weeklyMinutes: number;
};

export type WeeklyClassMinuteSegment = {
  startDate: string;
  endDate: string;
  days: number;
  weeklyMinutes: number;
};

export type StudentWeeklyMinuteSegments = {
  studentId: string;
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  segments: WeeklyClassMinuteSegment[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    return null;
  }
  return timestamp;
}

function requireIsoDate(value: string, label: string) {
  const timestamp = parseIsoDate(value);
  if (timestamp === null) {
    throw new Error(`${label} must be a valid YYYY-MM-DD date.`);
  }
  return timestamp;
}

function formatIsoDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  return formatIsoDate(requireIsoDate(value, "Date") + days * DAY_MS);
}

function inclusiveDays(startDate: string, endDate: string) {
  return (
    (requireIsoDate(endDate, "End date") -
      requireIsoDate(startDate, "Start date")) /
      DAY_MS +
    1
  );
}

function hasValidDateBoundaries(row: WeeklyClassHoursInput) {
  return [
    row.enrollmentStartDate,
    row.enrollmentEndDate,
    row.classStartDate,
    row.classEndDate,
  ].every((value) => value === undefined || parseIsoDate(value) !== null);
}

function isWithinDateRange(
  date: string,
  startDate?: string,
  endDate?: string,
) {
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

function timeToMinutes(value?: string) {
  const match = value?.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function classWeeklyMinutes(
  classItem: Pick<
    WeeklyClassHoursInput,
    "startTime" | "endTime" | "weekdays"
  >,
) {
  const start = timeToMinutes(classItem.startTime);
  const end = timeToMinutes(classItem.endTime);
  const meetingCount = new Set(classItem.weekdays || []).size;

  if (start === null || end === null || end <= start || meetingCount === 0) {
    return 0;
  }

  return (end - start) * meetingCount;
}

function hasEligibleStatus(row: WeeklyClassHoursInput) {
  return (
    row.enrollmentStatus === "enrolled" ||
    (row.enrollmentStatus === "dropped" && !!row.enrollmentEndDate)
  );
}

export function shouldCountForWeeklyTuition(
  row: WeeklyClassHoursInput,
  asOfDate: string,
) {
  return (
    parseIsoDate(asOfDate) !== null &&
    hasEligibleStatus(row) &&
    row.classStatus !== "archived" &&
    hasValidDateBoundaries(row) &&
    isWithinDateRange(
      asOfDate,
      row.enrollmentStartDate,
      row.enrollmentEndDate,
    ) &&
    isWithinDateRange(asOfDate, row.classStartDate, row.classEndDate) &&
    classWeeklyMinutes(row) > 0
  );
}

export function calculateWeeklyClassMinutes(
  rows: WeeklyClassHoursInput[],
  asOfDate: string,
): StudentWeeklyMinutes[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    if (!shouldCountForWeeklyTuition(row, asOfDate)) continue;
    totals.set(
      row.studentId,
      (totals.get(row.studentId) || 0) + classWeeklyMinutes(row),
    );
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([studentId, weeklyMinutes]) => ({ studentId, weeklyMinutes }));
}

function maximumDate(...dates: Array<string | undefined>) {
  return dates.filter((date) => date !== undefined).sort().at(-1);
}

function minimumDate(...dates: Array<string | undefined>) {
  return dates.filter((date) => date !== undefined).sort().at(0);
}

function activeIntervalWithinPeriod(
  row: WeeklyClassHoursInput,
  periodStart: string,
  periodEnd: string,
) {
  if (
    !hasEligibleStatus(row) ||
    row.classStatus === "archived" ||
    !hasValidDateBoundaries(row) ||
    classWeeklyMinutes(row) === 0
  ) {
    return null;
  }

  const startDate =
    maximumDate(
      periodStart,
      row.enrollmentStartDate,
      row.classStartDate,
    ) || periodStart;
  const endDate =
    minimumDate(periodEnd, row.enrollmentEndDate, row.classEndDate) ||
    periodEnd;

  return startDate <= endDate ? { startDate, endDate } : null;
}

export function calculateWeeklyClassMinuteSegments(
  rows: WeeklyClassHoursInput[],
  periodStart: string,
  periodEnd: string,
): StudentWeeklyMinuteSegments[] {
  const startTimestamp = requireIsoDate(periodStart, "periodStart");
  const endTimestamp = requireIsoDate(periodEnd, "periodEnd");
  if (endTimestamp < startTimestamp) {
    throw new Error("periodEnd must be on or after periodStart.");
  }

  const periodEndExclusive = addDays(periodEnd, 1);
  const rowsByStudent = new Map<string, WeeklyClassHoursInput[]>();

  for (const row of rows) {
    if (!activeIntervalWithinPeriod(row, periodStart, periodEnd)) continue;
    const studentRows = rowsByStudent.get(row.studentId) || [];
    studentRows.push(row);
    rowsByStudent.set(row.studentId, studentRows);
  }

  return [...rowsByStudent.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([studentId, studentRows]) => {
      const boundaries = new Set([periodStart, periodEndExclusive]);

      for (const row of studentRows) {
        const interval = activeIntervalWithinPeriod(
          row,
          periodStart,
          periodEnd,
        );
        if (!interval) continue;
        boundaries.add(interval.startDate);
        boundaries.add(addDays(interval.endDate, 1));
      }

      const sortedBoundaries = [...boundaries].sort();
      const segments: WeeklyClassMinuteSegment[] = [];

      for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
        const startDate = sortedBoundaries[index];
        const endDate = addDays(sortedBoundaries[index + 1], -1);
        const weeklyMinutes = studentRows.reduce(
          (total, row) =>
            shouldCountForWeeklyTuition(row, startDate)
              ? total + classWeeklyMinutes(row)
              : total,
          0,
        );
        const previous = segments.at(-1);

        if (previous?.weeklyMinutes === weeklyMinutes) {
          previous.endDate = endDate;
          previous.days = inclusiveDays(previous.startDate, endDate);
        } else {
          segments.push({
            startDate,
            endDate,
            days: inclusiveDays(startDate, endDate),
            weeklyMinutes,
          });
        }
      }

      return {
        studentId,
        periodStart,
        periodEnd,
        periodDays: inclusiveDays(periodStart, periodEnd),
        segments,
      };
    });
}

export function weeklyMinutesToHours(weeklyMinutes: number) {
  return weeklyMinutes / 60;
}

export const absenceReasonLabels: Record<string, string> = {
  sick: "Sick",
  injured: "Injured",
  homework: "Homework",
  vacation: "Vacation",
  "school-event": "School event",
  "no-ride": "No ride",
};

export type AttendanceReportRow = {
  studentId: string;
  name: string;
  preferredName?: string;
  groupId?: string;
  present: number;
  absent: number;
  makeups: number;
  reasons: Record<string, number>;
};
export type AttendanceViewRow = AttendanceReportRow & {
  groupName: string;
  rate: number | null;
  topReason: string;
};
export const attendanceSortKeys = [
  "name",
  "groupName",
  "rate",
  "present",
  "absent",
  "makeups",
  "topReason",
] as const;
export type AttendanceSortKey = (typeof attendanceSortKeys)[number];
export type AttendanceReportSearch = {
  start?: string;
  end?: string;
  season?: string;
  group?: string;
  q?: string;
  sort?: AttendanceSortKey;
  order?: "asc" | "desc";
};

export function parseAttendanceReportSearch(
  search: Record<string, unknown>,
): AttendanceReportSearch {
  const result: AttendanceReportSearch = {};
  for (const key of ["start", "end", "season", "group", "q"] as const) {
    if (typeof search[key] === "string") result[key] = search[key];
  }
  if (attendanceSortKeys.includes(search.sort as AttendanceSortKey))
    result.sort = search.sort as AttendanceSortKey;
  if (search.order === "asc" || search.order === "desc")
    result.order = search.order;
  return result;
}

export function isAttendanceDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function attendanceRangeError(start: string, end: string) {
  if (!isAttendanceDate(start) || !isAttendanceDate(end))
    return "Enter valid start and end dates.";
  if (start > end) return "Start date must be on or before end date.";
  return null;
}

export function defaultAttendanceRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  const end = `${part("year")}-${part("month")}-${part("day")}`;
  const start = new Date(`${end}T00:00:00Z`);
  const day = start.getUTCDate();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 4);
  const lastDay = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  start.setUTCDate(Math.min(day, lastDay));
  return { start: start.toISOString().slice(0, 10), end };
}

export function attendanceSeasonRange(season: {
  _id: string;
  startDate: string;
  endDate: string;
}) {
  return { start: season.startDate, end: season.endDate, season: season._id };
}

export type AttendanceSessionInput = {
  date: string;
  active: boolean;
  status: string;
  records: { student: string; status: string; reason?: string }[];
  addedStudentIds: string[];
};

export function buildAttendanceReport(
  students: {
    _id: string;
    firstName: string;
    lastName: string;
    preferredName?: string;
    groupId?: string;
    status: string;
  }[],
  sessions: AttendanceSessionInput[],
  range: { start: string; end: string },
): AttendanceReportRow[] {
  const error = attendanceRangeError(range.start, range.end);
  if (error) throw new Error(error);
  const rows = new Map<string, AttendanceReportRow>(
    students
      .filter((student) => student.status === "active")
      .map((student) => [
        student._id,
        {
          studentId: student._id,
          name: `${student.firstName} ${student.lastName}`.trim(),
          preferredName: student.preferredName,
          groupId: student.groupId,
          present: 0,
          absent: 0,
          makeups: 0,
          reasons: {},
        },
      ]),
  );
  for (const session of sessions) {
    if (
      !session.active ||
      session.status === "cancelled" ||
      session.date < range.start ||
      session.date > range.end
    )
      continue;
    const additions = new Set(session.addedStudentIds);
    for (const record of session.records) {
      const row = rows.get(record.student);
      if (!row) continue;
      if (record.status === "present" || record.status === "late") {
        row.present++;
        if (additions.has(record.student)) row.makeups++;
      } else if (record.status === "absent") {
        row.absent++;
        if (
          record.reason &&
          Object.hasOwn(absenceReasonLabels, record.reason)
        ) {
          row.reasons[record.reason] = (row.reasons[record.reason] ?? 0) + 1;
        }
      }
    }
  }
  return [...rows.values()];
}

export function attendanceRate(present: number, absent: number) {
  return present + absent === 0 ? null : (present / (present + absent)) * 100;
}
export function formatAttendanceRate(rate: number | null) {
  return rate === null ? "-" : `${rate.toFixed(1)}%`;
}
export function topAbsenceReason(reasons: Record<string, number>) {
  const highest = Math.max(0, ...Object.values(reasons));
  return highest === 0
    ? ""
    : Object.entries(reasons)
        .filter(([, count]) => count === highest)
        .map(([reason]) => absenceReasonLabels[reason])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .join(", ");
}

export function attendanceReportView(
  rows: AttendanceReportRow[],
  groups: { _id: string; name: string }[],
  search: AttendanceReportSearch,
): AttendanceViewRow[] {
  const names = new Map(groups.map((group) => [group._id, group.name]));
  const query = search.q?.trim().toLocaleLowerCase() ?? "";
  const sort = search.sort ?? "rate";
  const direction = search.order === "asc" ? 1 : -1;
  return rows
    .filter((row) => {
      if (
        search.group === "none"
          ? !!row.groupId
          : search.group && row.groupId !== search.group
      )
        return false;
      return `${row.name} ${row.preferredName ?? ""}`
        .toLocaleLowerCase()
        .includes(query);
    })
    .map((row) => ({
      ...row,
      groupName: row.groupId
        ? (names.get(row.groupId) ?? "Unknown group")
        : "No group",
      rate: attendanceRate(row.present, row.absent),
      topReason: topAbsenceReason(row.reasons),
    }))
    .sort((a, b) => {
      // Keep students without counted attendance last in either rate direction.
      if (sort === "rate" && (a.rate === null || b.rate === null)) {
        if (a.rate !== b.rate) return a.rate === null ? 1 : -1;
      }
      const left = a[sort];
      const right = b[sort];
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left ?? "").localeCompare(String(right ?? ""));
      return (
        comparison * direction ||
        a.name.localeCompare(b.name) ||
        a.studentId.localeCompare(b.studentId)
      );
    });
}

export function attendanceReportTotals(rows: AttendanceReportRow[]) {
  const present = rows.reduce((sum, row) => sum + row.present, 0);
  const absent = rows.reduce((sum, row) => sum + row.absent, 0);
  return {
    present,
    absent,
    rate: attendanceRate(present, absent),
    students: rows.length,
  };
}

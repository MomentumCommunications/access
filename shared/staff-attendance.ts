export type StaffAttendanceSessionAccess = {
  isAdmin?: boolean;
  showAll: boolean;
  canAccess: boolean;
};

export type StaffAttendanceSessionState = {
  active: boolean;
  date: string;
  enrollmentCount: number;
  attendanceCount: number;
};

export type AttendanceReminderSessionState = StaffAttendanceSessionState & {
  status?: "scheduled" | "cancelled" | "completed";
  endTime?: string;
};

export type AttendanceSessionOccurrence = {
  _id?: string;
  date: string;
  startTime?: string;
};

export type AttendanceEnrollment = {
  status: string;
  startDate?: string;
  endDate?: string;
};

function isValidIsoDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

export function isAttendanceEnrollmentExpectedOnDate(
  enrollment: AttendanceEnrollment,
  studentStatus: string | undefined,
  sessionDate: string,
) {
  if (!studentStatus) return false;
  const withinEnrollmentDates =
    (!enrollment.startDate || sessionDate >= enrollment.startDate) &&
    (!enrollment.endDate || sessionDate <= enrollment.endDate);

  if (enrollment.status === "dropped") {
    return isValidIsoDate(enrollment.endDate) && withinEnrollmentDates;
  }

  return (
    studentStatus === "active" &&
    (enrollment.status === "enrolled" || enrollment.status === "pending") &&
    withinEnrollmentDates
  );
}

export function countRosterAttendance<StudentId>(
  attendanceStudentIds: StudentId[],
  rosterStudentIds: ReadonlySet<StudentId>,
) {
  return new Set(
    attendanceStudentIds.filter((studentId) =>
      rosterStudentIds.has(studentId),
    ),
  ).size;
}

export function compareAttendanceSessionsByOccurrence(
  left: AttendanceSessionOccurrence,
  right: AttendanceSessionOccurrence,
) {
  return (
    left.date.localeCompare(right.date) ||
    (left.startTime || "").localeCompare(right.startTime || "") ||
    (left._id || "").localeCompare(right._id || "")
  );
}

export function isAttendanceClassEligible(
  classItem: { status?: string } | null | undefined,
) {
  return Boolean(classItem && classItem.status !== "archived");
}

export function canViewStaffAttendanceSession({
  isAdmin = false,
  showAll,
  canAccess,
}: StaffAttendanceSessionAccess) {
  return isAdmin || showAll || canAccess;
}

export function isIncompleteAttendanceSession(
  row: StaffAttendanceSessionState,
) {
  return row.enrollmentCount !== row.attendanceCount;
}

export function matchesStaffAttendanceMode(
  row: StaffAttendanceSessionState,
  {
    date,
    incomplete,
    today,
  }: {
    date: string;
    incomplete: boolean;
    today: string;
  },
) {
  if (!row.active) return false;
  if (!incomplete) return row.date === date;
  return row.date < today && isIncompleteAttendanceSession(row);
}

function timeToMinutes(value: string | undefined) {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function zonedDateTimeParts(
  now: Date,
  timezone = "America/New_York",
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    weekday: value("weekday"),
    hour,
    minute,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

export function isWeekdayIncompleteAttendanceSweepTime(
  now: Date,
  timezone = "America/New_York",
) {
  const parts = zonedDateTimeParts(now, timezone);
  return (
    parts.hour === 21 &&
    parts.weekday !== "Sat" &&
    parts.weekday !== "Sun"
  );
}

export function isIncompleteAttendanceReminderEligible(
  row: AttendanceReminderSessionState,
  {
    today,
    minutesSinceMidnight,
  }: {
    today: string;
    minutesSinceMidnight: number;
  },
) {
  if (!row.active || row.status === "cancelled") return false;
  if (!isIncompleteAttendanceSession(row)) return false;
  if (row.date < today) return true;
  if (row.date > today) return false;
  const endMinutes = timeToMinutes(row.endTime);
  return endMinutes !== null && endMinutes <= minutesSinceMidnight;
}

export function attendanceReminderRecipientIds({
  sessionAssignedStaff,
  sessionSubstitute,
  classAssignedStaff,
}: {
  sessionAssignedStaff?: string[];
  sessionSubstitute?: string;
  classAssignedStaff?: string[];
}) {
  return [
    ...new Set([
      ...(sessionAssignedStaff || []),
      ...(sessionSubstitute ? [sessionSubstitute] : []),
      ...(classAssignedStaff || []),
    ]),
  ];
}

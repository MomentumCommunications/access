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

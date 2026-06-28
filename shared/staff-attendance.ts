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

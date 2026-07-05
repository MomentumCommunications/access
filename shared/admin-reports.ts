export type EnrollmentReportStatus =
  | "pending"
  | "enrolled"
  | "waitlisted"
  | "dropped"
  | "declined";

export type EnrollmentReportRow = {
  enrollmentId: string;
  classId: string;
  classTitle: string;
  classStatus?: "draft" | "published" | "archived";
  studentId: string;
  status: EnrollmentReportStatus;
  startDate?: string;
  endDate?: string;
  classStartDate?: string;
  classEndDate?: string;
  createdAt: number;
};

export type MonthlyEnrollmentMetric = {
  month: string;
  label: string;
  activeEnrollments: number;
  activeStudents: number;
  requests: number;
};

export type EnrollmentStatusCount = {
  status: EnrollmentReportStatus;
  count: number;
};

export type ClassEnrollmentRanking = {
  classId: string;
  classTitle: string;
  count: number;
};

export type EnrollmentReportsDashboard = {
  months: MonthlyEnrollmentMetric[];
  statusCounts: EnrollmentStatusCount[];
  topClassesByActiveEnrollments: ClassEnrollmentRanking[];
  topClassesByWaitlist: ClassEnrollmentRanking[];
  kpis: {
    currentActiveEnrollments: number;
    currentActiveStudents: number;
    currentPendingRequests: number;
    currentWaitlistedEnrollments: number;
  };
};

export const ENROLLMENT_REPORT_STATUSES: EnrollmentReportStatus[] = [
  "pending",
  "enrolled",
  "waitlisted",
  "declined",
  "dropped",
];

const ACTIVE_HISTORY_STATUSES = new Set<EnrollmentReportStatus>([
  "enrolled",
  "dropped",
]);

const OPEN_END_DATE = "9999-12-31";

export function buildEnrollmentReportsDashboard(
  rows: EnrollmentReportRow[],
  options: { now?: Date; monthCount?: number } = {},
): EnrollmentReportsDashboard {
  const now = options.now ?? new Date();
  const monthCount = options.monthCount ?? 12;
  const today = dateKey(now);
  const months = getRecentMonthKeys(now, monthCount);
  const requestCounts = countRequestsByMonth(rows);

  const monthlyMetrics = months.map((month) => {
    const monthStart = `${month}-01`;
    const monthEnd = monthEndDate(month);
    const activeRows = rows.filter(
      (row) =>
        ACTIVE_HISTORY_STATUSES.has(row.status) &&
        enrollmentOverlapsRange(row, monthStart, monthEnd),
    );
    const activeStudents = new Set(activeRows.map((row) => row.studentId));

    return {
      month,
      label: monthLabel(month),
      activeEnrollments: activeRows.length,
      activeStudents: activeStudents.size,
      requests: requestCounts.get(month) ?? 0,
    };
  });

  const statusCounts = ENROLLMENT_REPORT_STATUSES.map((status) => ({
    status,
    count: rows.filter((row) => row.status === status).length,
  }));

  const currentActiveRows = rows.filter(
    (row) =>
      row.status === "enrolled" &&
      row.classStatus !== "archived" &&
      enrollmentOverlapsRange(row, today, today),
  );
  const currentActiveStudents = new Set(
    currentActiveRows.map((row) => row.studentId),
  );
  const currentPendingRequests = rows.filter(
    (row) => row.status === "pending",
  ).length;
  const currentWaitlistedRows = rows.filter(
    (row) => row.status === "waitlisted" && row.classStatus !== "archived",
  );

  return {
    months: monthlyMetrics,
    statusCounts,
    topClassesByActiveEnrollments: rankClasses(currentActiveRows),
    topClassesByWaitlist: rankClasses(currentWaitlistedRows),
    kpis: {
      currentActiveEnrollments: currentActiveRows.length,
      currentActiveStudents: currentActiveStudents.size,
      currentPendingRequests,
      currentWaitlistedEnrollments: currentWaitlistedRows.length,
    },
  };
}

export function enrollmentOverlapsRange(
  row: EnrollmentReportRow,
  rangeStart: string,
  rangeEnd: string,
) {
  const start = resolveEnrollmentStart(row);
  const end = resolveEnrollmentEnd(row);
  return start <= rangeEnd && end >= rangeStart;
}

function resolveEnrollmentStart(row: EnrollmentReportRow) {
  return row.startDate ?? row.classStartDate ?? dateKey(new Date(row.createdAt));
}

function resolveEnrollmentEnd(row: EnrollmentReportRow) {
  return row.endDate ?? row.classEndDate ?? OPEN_END_DATE;
}

function countRequestsByMonth(rows: EnrollmentReportRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const month = monthKey(new Date(row.createdAt));
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return counts;
}

function rankClasses(rows: EnrollmentReportRow[], limit = 8) {
  const counts = new Map<string, ClassEnrollmentRanking>();
  for (const row of rows) {
    const existing = counts.get(row.classId);
    if (existing) {
      existing.count += 1;
      continue;
    }
    counts.set(row.classId, {
      classId: row.classId,
      classTitle: row.classTitle,
      count: 1,
    });
  }

  return [...counts.values()]
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.classTitle.localeCompare(right.classTitle),
    )
    .slice(0, limit);
}

function getRecentMonthKeys(now: Date, monthCount: number) {
  const months: string[] = [];
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  cursor.setUTCMonth(cursor.getUTCMonth() - Math.max(0, monthCount - 1));

  for (let index = 0; index < monthCount; index += 1) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function monthEndDate(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, monthNumber, 0));
  return dateKey(end);
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

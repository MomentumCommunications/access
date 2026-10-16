export type AbsenceWeek = {
  week: string;
  result: "absent" | "reset" | "unknown";
};

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Monday–Sunday teaching weeks, using the studio's local date. */
export function attendanceWeek(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDate(date, -((day + 6) % 7));
}

export function absenceWeekResult(
  statuses: Array<"present" | "late" | "excused" | "absent" | undefined>,
): AbsenceWeek["result"] | undefined {
  if (!statuses.length) return undefined;
  if (statuses.some((status) => status && status !== "absent")) return "reset";
  if (statuses.some((status) => status === undefined)) return "unknown";
  return "absent";
}

export function reconcileAbsenceWeeks(
  previous: { weeks: AbsenceWeek[]; lastAlertStartWeek?: string },
  refreshed: Array<{ week: string; result: AbsenceWeek["result"] | undefined }>,
) {
  const byWeek = new Map(previous.weeks.map((week) => [week.week, week]));
  let lastAlertStartWeek = previous.lastAlertStartWeek;
  for (const week of refreshed) {
    byWeek.delete(week.week);
    if (week.result)
      byWeek.set(week.week, { week: week.week, result: week.result });
    // A correction inside the notified streak also accounts for that absence.
    if (
      week.result === "reset" &&
      lastAlertStartWeek &&
      week.week >= lastAlertStartWeek
    ) {
      lastAlertStartWeek = undefined;
    }
  }
  const weeks = [...byWeek.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-3);
  const shouldAlert =
    !lastAlertStartWeek &&
    weeks.length === 3 &&
    weeks.every((week) => week.result === "absent");
  return {
    weeks,
    lastAlertStartWeek: shouldAlert ? weeks[0].week : lastAlertStartWeek,
    shouldAlert,
  };
}

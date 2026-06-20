export type TuitionMonthSource = {
  enrollmentStartDate?: string;
  enrollmentEndDate?: string;
  classStartDate?: string;
  classEndDate?: string;
};

function monthKey(value: string) {
  return value.slice(0, 7);
}

function addMonths(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

export function billingMonthPeriod(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Billing month must use YYYY-MM format.");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  if (
    start.getUTCFullYear() !== year ||
    start.getUTCMonth() !== monthNumber - 1
  ) {
    throw new Error("Billing month must be valid.");
  }
  const end = new Date(Date.UTC(year, monthNumber, 0));
  return {
    periodStart: `${month}-01`,
    periodEnd: `${end.getUTCFullYear()}-${String(
      end.getUTCMonth() + 1,
    ).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`,
  };
}

export function availableTuitionMonths(
  sources: TuitionMonthSource[],
  currentMonth: string,
) {
  if (sources.length === 0) return [];

  const ranges = sources.map((source) => {
    const start =
      source.enrollmentStartDate || source.classStartDate || `${currentMonth}-01`;
    const proposedEnd =
      source.enrollmentEndDate || source.classEndDate || `${currentMonth}-01`;
    const end = proposedEnd < start ? start : proposedEnd;
    return {
      start: monthKey(start),
      end: monthKey(end),
    };
  });
  const earliest = ranges
    .map((range) => range.start)
    .sort((left, right) => left.localeCompare(right))[0];
  const latest = ranges
    .map((range) => range.end)
    .sort((left, right) => right.localeCompare(left))[0];

  const months: string[] = [];
  for (
    let month = earliest;
    month <= latest;
    month = addMonths(month, 1)
  ) {
    if (
      ranges.some((range) => range.start <= month && range.end >= month)
    ) {
      months.push(month);
    }
  }
  return months;
}

export function resolveTuitionPlanMonth({
  availableMonths,
  requestedMonth,
  currentMonth,
}: {
  availableMonths: string[];
  requestedMonth?: string;
  currentMonth: string;
}) {
  if (availableMonths.length === 0) return undefined;
  if (requestedMonth && availableMonths.includes(requestedMonth)) {
    return requestedMonth;
  }
  if (availableMonths.includes(currentMonth)) return currentMonth;
  return (
    [...availableMonths]
      .filter((month) => month <= currentMonth)
      .sort((left, right) => right.localeCompare(left))[0] ||
    availableMonths[0]
  );
}

export function tuitionMonthNavigation(
  availableMonths: string[],
  selectedMonth?: string,
) {
  const index = selectedMonth
    ? availableMonths.indexOf(selectedMonth)
    : -1;
  return {
    previousMonth: index > 0 ? availableMonths[index - 1] : undefined,
    nextMonth:
      index >= 0 && index < availableMonths.length - 1
        ? availableMonths[index + 1]
        : undefined,
  };
}

export function selectHouseholdTuitionBreakdown<
  T extends { householdId: string },
>(households: T[], householdId: string) {
  return households.find((household) => household.householdId === householdId);
}

export function isPrivateConnectedToHousehold(
  privateStudentIds: string[],
  householdStudentIds: Set<string>,
) {
  return privateStudentIds.some((studentId) =>
    householdStudentIds.has(studentId),
  );
}

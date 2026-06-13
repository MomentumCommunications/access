export type PerSessionChargeRow = {
  signupId: string;
  studentId: string;
  classId: string;
  sessionId: string;
  sessionDate: string;
  unitPriceCents: number;
};

export function aggregatePerSessionCharges(
  rows: PerSessionChargeRow[],
  periodStart: string,
  periodEnd: string,
) {
  const groups = new Map<string, PerSessionChargeRow[]>();
  for (const row of rows) {
    const key = `${row.studentId}:${row.classId}`;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      const sortedRows = [...group].sort(
        (left, right) =>
          left.sessionDate.localeCompare(right.sessionDate) ||
          left.sessionId.localeCompare(right.sessionId) ||
          left.signupId.localeCompare(right.signupId),
      );
      const prices = [
        ...new Set(sortedRows.map((row) => row.unitPriceCents)),
      ].sort((left, right) => left - right);

      return {
        studentId: sortedRows[0].studentId,
        classId: sortedRows[0].classId,
        periodStart,
        periodEnd,
        selectedSessionCount: sortedRows.length,
        perSessionPriceCents: prices.length === 1 ? prices[0] : undefined,
        aggregateAmountCents: sortedRows.reduce(
          (total, row) => total + row.unitPriceCents,
          0,
        ),
        sessionIds: sortedRows.map((row) => row.sessionId),
        warning:
          prices.length > 1
            ? "Selected sessions use different saved prices."
            : undefined,
      };
    })
    .sort(
      (left, right) =>
        left.studentId.localeCompare(right.studentId) ||
        left.classId.localeCompare(right.classId),
    );
}

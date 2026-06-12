import {
  matchTuitionTier,
  type NormalizedTuitionTier,
} from "../../../shared/tuition-pricing.ts";
import {
  calculateWeeklyClassMinuteSegments,
  collectBillingEnrollmentExclusions,
  type BillingEnrollmentExclusion,
  type WeeklyClassHoursInput,
} from "./weeklyClassHours.ts";

export type TuitionCalculationInput = WeeklyClassHoursInput & {
  prorateTuition?: boolean;
};

export type TuitionPeriodSegment = {
  startDate: string;
  endDate: string;
  days: number;
  weeklyMinutes: number;
  tierLabel?: string;
  monthlyAmountCents?: number;
  weightedAmountCents?: number;
};

export type StudentPeriodTuition = {
  studentId: string;
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  segments: TuitionPeriodSegment[];
  totalTuitionCents?: number;
  warning?: string;
};

export type PeriodTuitionCalculation = {
  tuitions: StudentPeriodTuition[];
  excludedEnrollments: BillingEnrollmentExclusion[];
};

function validIsoDate(value?: string) {
  if (value === undefined) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function rangesOverlap(
  periodStart: string,
  periodEnd: string,
  startDate?: string,
  endDate?: string,
) {
  return (!startDate || startDate <= periodEnd) && (!endDate || endDate >= periodStart);
}

function enrollmentOverlapsPeriod(
  row: TuitionCalculationInput,
  periodStart: string,
  periodEnd: string,
) {
  if (
    !validIsoDate(row.enrollmentStartDate) ||
    !validIsoDate(row.enrollmentEndDate)
  ) {
    return false;
  }
  if (
    row.enrollmentStatus !== "enrolled" &&
    !(row.enrollmentStatus === "dropped" && row.enrollmentEndDate)
  ) {
    return false;
  }
  return rangesOverlap(
    periodStart,
    periodEnd,
    row.enrollmentStartDate,
    row.enrollmentEndDate,
  );
}

function rowsForPeriodCalculation(
  rows: TuitionCalculationInput[],
  periodStart: string,
  periodEnd: string,
) {
  return rows.flatMap((row) => {
    if (row.prorateTuition !== false) return [row];
    if (!enrollmentOverlapsPeriod(row, periodStart, periodEnd)) return [];
    return [
      {
        ...row,
        enrollmentStatus: "enrolled",
        enrollmentStartDate: periodStart,
        enrollmentEndDate: periodEnd,
      },
    ];
  });
}

export function calculatePeriodTuitions(
  rows: TuitionCalculationInput[],
  tiers: NormalizedTuitionTier[],
  periodStart: string,
  periodEnd: string,
): StudentPeriodTuition[] {
  const studentSegments = calculateWeeklyClassMinuteSegments(
    rowsForPeriodCalculation(rows, periodStart, periodEnd),
    periodStart,
    periodEnd,
  );

  return studentSegments.map((student) => {
    let weightedAmountNumerator = 0;
    let missingTier = false;
    const segments = student.segments.map((segment) => {
      const tier = matchTuitionTier(tiers, segment.weeklyMinutes);
      if (segment.weeklyMinutes > 0 && !tier) missingTier = true;
      if (!tier) return { ...segment };

      weightedAmountNumerator += tier.monthlyAmountCents * segment.days;
      return {
        ...segment,
        tierLabel: tier.label,
        monthlyAmountCents: tier.monthlyAmountCents,
        weightedAmountCents: Math.round(
          (tier.monthlyAmountCents * segment.days) / student.periodDays,
        ),
      };
    });

    return {
      ...student,
      segments,
      totalTuitionCents: missingTier
        ? undefined
        : Math.round(weightedAmountNumerator / student.periodDays),
      warning: missingTier
        ? "No tuition tier covers part of this student's weekly hours."
        : undefined,
    };
  });
}

export function calculatePeriodTuitionsWithExclusions(
  rows: TuitionCalculationInput[],
  tiers: NormalizedTuitionTier[],
  periodStart: string,
  periodEnd: string,
): PeriodTuitionCalculation {
  return {
    tuitions: calculatePeriodTuitions(rows, tiers, periodStart, periodEnd),
    excludedEnrollments: collectBillingEnrollmentExclusions(rows),
  };
}

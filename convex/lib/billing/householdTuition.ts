export type HouseholdLinkSource =
  | "household"
  | "account_fallback"
  | "student_fallback";

export type HouseholdTuitionStudentInput = {
  studentId: string;
  studentName: string;
  householdId?: string;
  householdName?: string;
  householdLinkSource?: HouseholdLinkSource;
  baseTuitionCents?: number;
  pricingSource?: string;
  warning?: string;
};

export type HouseholdTuitionAdjustment = {
  type: "sibling_discount" | "scholarship" | "package" | "manual";
  label: string;
  amountCents: number;
};

export type HouseholdTuitionResult<
  TStudent extends HouseholdTuitionStudentInput,
> = {
  householdId: string;
  householdName: string;
  householdLinkSource: HouseholdLinkSource;
  students: TStudent[];
  subtotalBaseTuitionCents: number;
  totalTuitionCents: number;
  hasIncompleteTuition: boolean;
  siblingDiscountCandidate: boolean;
  scholarshipCandidates: string[];
  packageCandidates: string[];
  adjustments: HouseholdTuitionAdjustment[];
};

function fallbackHousehold(student: HouseholdTuitionStudentInput) {
  if (student.householdId && student.householdName) {
    return {
      householdId: student.householdId,
      householdName: student.householdName,
      householdLinkSource: student.householdLinkSource || "household",
    };
  }

  return {
    householdId: `student:${student.studentId}`,
    householdName: `${student.studentName} (unlinked)`,
    householdLinkSource: "student_fallback" as const,
  };
}

function compareStudents(
  left: HouseholdTuitionStudentInput,
  right: HouseholdTuitionStudentInput,
) {
  return (
    left.studentName.localeCompare(right.studentName) ||
    left.studentId.localeCompare(right.studentId)
  );
}

export function aggregateHouseholdTuitions<
  TStudent extends HouseholdTuitionStudentInput,
>(students: TStudent[]): HouseholdTuitionResult<TStudent>[] {
  const grouped = new Map<
    string,
    {
      householdName: string;
      householdLinkSource: HouseholdLinkSource;
      students: TStudent[];
    }
  >();

  for (const student of students) {
    const household = fallbackHousehold(student);
    const existing = grouped.get(household.householdId);
    if (existing) {
      existing.students.push(student);
      continue;
    }
    grouped.set(household.householdId, {
      householdName: household.householdName,
      householdLinkSource: household.householdLinkSource,
      students: [student],
    });
  }

  return [...grouped.entries()]
    .map(([householdId, household]) => {
      const sortedStudents = [...household.students].sort(compareStudents);
      const tuitionBearingStudents = sortedStudents.filter(
        (student) =>
          student.baseTuitionCents !== undefined &&
          student.baseTuitionCents > 0,
      );
      const subtotalBaseTuitionCents = sortedStudents.reduce(
        (total, student) => total + (student.baseTuitionCents || 0),
        0,
      );

      return {
        householdId,
        householdName: household.householdName,
        householdLinkSource: household.householdLinkSource,
        students: sortedStudents,
        subtotalBaseTuitionCents,
        totalTuitionCents: subtotalBaseTuitionCents,
        hasIncompleteTuition: sortedStudents.some(
          (student) => student.baseTuitionCents === undefined,
        ),
        siblingDiscountCandidate: tuitionBearingStudents.length >= 2,
        scholarshipCandidates: [],
        packageCandidates: [],
        adjustments: [],
      };
    })
    .sort(
      (left, right) =>
        left.householdName.localeCompare(right.householdName) ||
        left.householdId.localeCompare(right.householdId),
    );
}

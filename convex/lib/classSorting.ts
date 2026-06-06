import type { Doc } from "../_generated/dataModel";

const WEEKDAY_ORDER = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
} as const;

function earliestWeekday(classItem: Doc<"classes">) {
  if (!classItem.weekdays?.length) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(
    ...classItem.weekdays.map((weekday) => WEEKDAY_ORDER[weekday]),
  );
}

function timeInMinutes(time?: string) {
  const match = time?.match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  const hours = Number(match[1]);
  if (hours > 23) {
    return Number.POSITIVE_INFINITY;
  }

  return hours * 60 + Number(match[2]);
}

export function compareClassesBySchedule(
  left: Doc<"classes">,
  right: Doc<"classes">,
) {
  const leftWeekday = earliestWeekday(left);
  const rightWeekday = earliestWeekday(right);
  if (leftWeekday !== rightWeekday) {
    return leftWeekday < rightWeekday ? -1 : 1;
  }

  const leftTime = timeInMinutes(left.startTime);
  const rightTime = timeInMinutes(right.startTime);
  if (leftTime !== rightTime) {
    return leftTime < rightTime ? -1 : 1;
  }

  const titleDifference = left.title.localeCompare(right.title, undefined, {
    sensitivity: "base",
  });
  if (titleDifference !== 0) {
    return titleDifference;
  }

  return left._creationTime - right._creationTime;
}

export function compareRowsByClassSchedule<
  T extends { classItem: Doc<"classes"> | null },
>(left: T, right: T) {
  if (!left.classItem) {
    return right.classItem ? 1 : 0;
  }
  if (!right.classItem) {
    return -1;
  }

  return compareClassesBySchedule(left.classItem, right.classItem);
}

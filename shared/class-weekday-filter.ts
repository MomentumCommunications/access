export const CLASS_WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type ClassWeekday = (typeof CLASS_WEEKDAYS)[number];

export const CLASS_WEEKDAY_LABELS: Record<ClassWeekday, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export function classMatchesWeekday(
  classItem: { weekdays?: readonly string[] },
  weekday?: ClassWeekday,
) {
  return !weekday || classItem.weekdays?.includes(weekday) === true;
}

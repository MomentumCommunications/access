import { formatInTimeZone } from "date-fns-tz";

export type DailyPrivateLessonStatus =
  | "scheduled"
  | "completed"
  | "cancelled";

export function matchesDailyPrivateLesson(
  lesson: {
    startsAt: number;
    status: DailyPrivateLessonStatus;
    timezone: string;
  },
  options: {
    date: string;
    incomplete: boolean;
    now: number;
  },
) {
  if (options.incomplete) {
    return lesson.status === "scheduled" && lesson.startsAt < options.now;
  }
  return (
    formatInTimeZone(lesson.startsAt, lesson.timezone, "yyyy-MM-dd") ===
    options.date
  );
}

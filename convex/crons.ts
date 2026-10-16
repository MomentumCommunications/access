import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();

// 09:00 EST / 10:00 EDT on Monday; the check uses New York calendar weeks.
crons.weekly(
  "weekly student absence alerts",
  { dayOfWeek: "monday", hourUTC: 14, minuteUTC: 0 },
  makeFunctionReference<"mutation", Record<string, never>>(
    "absenceAlerts:checkWeeklyAbsences",
  ),
  {},
);

const sendIncompleteAttendanceReminders = makeFunctionReference<
  "mutation",
  Record<string, never>
>("classes:sendIncompleteAttendanceReminders");

crons.interval(
  "weekday incomplete attendance reminders",
  { hours: 1 },
  sendIncompleteAttendanceReminders,
);

crons.interval(
  "reconcile Stripe subscription autopay",
  { hours: 1 },
  makeFunctionReference<"mutation", { cursor?: string }>("stripeAutopayData:reconcile"),
  {},
);

export default crons;

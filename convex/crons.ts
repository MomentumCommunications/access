import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();

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


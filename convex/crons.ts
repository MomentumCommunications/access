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

export default crons;


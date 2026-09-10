import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  ListChecks,
  PersonStanding,
} from "lucide-react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { api } from "../../../convex/_generated/api";
import type { ReactNode } from "react";
import { RoleGate } from "~/components/role-gate";
import { StudentBirthdaysWidget } from "~/components/student-birthdays-widget";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PushNotificationPrompt } from "~/components/push-notification-controls";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminHome,
});

function AdminHome() {
  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="text-muted-foreground">
            Manage accounts, students, classes, and enrollment workflows.
          </p>
        </div>
        <PushNotificationPrompt />
        <div className="grid gap-4 md:grid-cols-2">
          <PendingEnrollmentsCard />
          <TodaysPrivatesCard />
        </div>
        <Card className="px-6">
          <CardTitle>Quick links</CardTitle>
          <div className="grid gap-4 md:grid-cols-3">
            <QuickLink
              title="Attendance"
              to="/admin/attendance"
              icon={<ListChecks />}
            />
            <QuickLink
              title="Students"
              to="/admin/students"
              icon={<PersonStanding />}
            />
            <QuickLink
              title="Reports"
              to="/admin/reports"
              icon={<BarChart3 />}
            />
          </div>
        </Card>
        <StudentBirthdaysWidget />
      </main>
    </RoleGate>
  );
}

function TodaysPrivatesCard() {
  const date = format(new Date(), "yyyy-MM-dd");
  const rows = useConvexQuery(api.privates.adminDailyPrivateLessonSummary, {
    date,
  });

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Today&apos;s privates</CardTitle>
        <CardDescription>
          {rows === undefined
            ? "Loading today’s schedule..."
            : `${rows.length} private lesson${rows.length === 1 ? "" : "s"} scheduled.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-4">
        {rows !== undefined && rows.length > 0 ? (
          <ul className="divide-y text-sm">
            {rows.map((row) => (
              <li
                key={row.privateLessonId}
                className="flex items-center justify-between gap-4 py-2 first:pt-0"
              >
                <span className="truncate font-medium">{row.name}</span>
                <time className="shrink-0 tabular-nums text-muted-foreground">
                  {formatInTimeZone(row.startsAt, row.timezone, "h:mm a")}
                </time>
              </li>
            ))}
          </ul>
        ) : rows === undefined ? (
          <div className="h-6 w-full animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-sm text-muted-foreground">
            No private lessons scheduled today.
          </p>
        )}
        <Button asChild variant="outline" className="mt-auto self-start">
          <Link to="/admin/privates/daily">
            <CalendarClock />
            Open daily privates
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PendingEnrollmentsCard() {
  const summary = useConvexQuery(api.classes.adminPendingEnrollmentSummary, {});
  const pendingCount = summary?.pendingCount ?? 0;

  return (
    <Card className="rounded-lg">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Pending enrollments</CardTitle>
          <CardDescription>Requests waiting for admin review.</CardDescription>
        </div>
        <div className="text-4xl font-bold tabular-nums">
          {summary === undefined ? "…" : pendingCount}
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/admin/classes/enrollments">
            <ClipboardCheck />
            Review requests
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  title,
  to,
  icon,
}: {
  title: string;
  to:
    | "/admin/attendance"
    | "/admin/accounts"
    | "/admin/students"
    | "/admin/classes"
    | "/admin/reports"
    | "/admin/scheduling";
  icon: ReactNode;
}) {
  return (
    <Button asChild variant="outline">
      <Link to={to}>
        {icon}
        {title}
      </Link>
    </Button>
  );
}

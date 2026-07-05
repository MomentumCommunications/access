import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardCheck,
  ListChecks,
  PersonStanding,
} from "lucide-react";
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
        <PendingEnrollmentsCard />
        <div className="grid gap-4 md:grid-cols-3">
          <AdminCard
            title="Attendance"
            description="Review attendance records."
            to="/admin/attendance"
            icon={<ListChecks />}
          />
          <AdminCard
            title="Students"
            description="Manage student profiles."
            to="/admin/students"
            icon={<PersonStanding />}
          />
          <AdminCard
            title="Reports"
            description="Review enrollment trends and status mix."
            to="/admin/reports"
            icon={<BarChart3 />}
          />
        </div>
        <StudentBirthdaysWidget />
      </main>
    </RoleGate>
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

function AdminCard({
  title,
  description,
  to,
  icon,
}: {
  title: string;
  description: string;
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
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link to={to}>
            {icon}
            Open
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

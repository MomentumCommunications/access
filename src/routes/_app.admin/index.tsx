import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  ListChecks,
  PersonStanding,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { RoleGate } from "~/components/role-gate";
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
        <div className="grid gap-4 md:grid-cols-3">
          <AdminCard
            title="Attendance"
            description="Review attendance records."
            to="/admin/attendance"
            icon={<ListChecks />}
          />
          <AdminCard
            title="Accounts"
            description="Review users and update access roles."
            to="/admin/accounts"
            icon={<Users />}
          />
          <AdminCard
            title="Students"
            description="Manage student profiles."
            to="/admin/students"
            icon={<PersonStanding />}
          />
          <AdminCard
            title="Classes"
            description="Create classes and manage enrollments."
            to="/admin/classes"
            icon={<BookOpen />}
          />
          <AdminCard
            title="Scheduling"
            description="Manage holidays and generated session rules."
            to="/admin/scheduling"
            icon={<CalendarDays />}
          />
        </div>
      </main>
    </RoleGate>
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

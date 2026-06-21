import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ClipboardList } from "lucide-react";
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

export const Route = createFileRoute("/_app/staff/")({
  component: StaffHome,
});

function StaffHome() {
  return (
    <RoleGate allow="staff">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Staff</h1>
          <p className="text-muted-foreground">
            View your assigned classes and take attendance.
          </p>
        </div>
        <PushNotificationPrompt />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Attendance</CardTitle>
              <CardDescription>
                Open today&apos;s sessions and mark students present, late,
                absent, or excused.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/staff/attendance">
                  <CalendarCheck />
                  Take Attendance
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>My Classes</CardTitle>
              <CardDescription>
                Review the classes currently connected to your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/staff/classes">
                  <ClipboardList />
                  View Classes
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </RoleGate>
  );
}

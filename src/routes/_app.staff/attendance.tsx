import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/staff/attendance")({
  component: AttendancePage,
});

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return toDateInputValue(next);
}

function AttendancePage() {
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [showAll, setShowAll] = useState(false);
  const sessions = useConvexQuery(api.classes.staffListSessionsByDate, {
    date,
    showAll,
  });

  return (
    <RoleGate allow="staff">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Attendance</h1>
            <p className="text-muted-foreground">
              Showing your linked sessions unless all sessions are toggled on.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDate((value) => shiftDate(value, -1))}
            >
              <ChevronLeft />
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-auto"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDate((value) => shiftDate(value, 1))}
            >
              <ChevronRight />
            </Button>
            <Label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox
                checked={showAll}
                onCheckedChange={(checked) => setShowAll(checked === true)}
              />
              Show all
            </Label>
          </div>
        </div>
        {sessions === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : sessions.length === 0 ? (
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>No sessions</CardTitle>
              <CardDescription>
                No sessions match this date and filter.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sessions.map((row) => (
              <Card key={row.session._id} className="rounded-lg">
                <CardHeader>
                  <CardTitle>
                    {row.classItem?.title || "Untitled class"}
                  </CardTitle>
                  <CardDescription>
                    {[row.session.startTime, row.session.endTime]
                      .filter(Boolean)
                      .join(" - ") || "Time TBD"}
                    {row.session.location ? ` · ${row.session.location}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">Students</div>
                      <div className="text-xl font-semibold">
                        {row.enrollments.length}
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">Marked</div>
                      <div className="text-xl font-semibold">
                        {row.attendance.length}
                      </div>
                    </div>
                  </div>
                  <Button asChild className="w-full">
                    <Link
                      to="/staff/attendance/$sessionId"
                      params={{ sessionId: row.session._id }}
                    >
                      Open Session
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </RoleGate>
  );
}

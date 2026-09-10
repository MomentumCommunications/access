import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RoleGate } from "~/components/role-gate";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { getAccountName } from "~/lib/account-name";

export const Route = createFileRoute("/_app/admin/privates/daily")({
  component: DailyPrivatesPage,
});

type DailyPrivateRows = FunctionReturnType<
  typeof api.privates.adminListDailyPrivateLessons
>;
type DailyPrivateRow = DailyPrivateRows[number];

function shiftDate(date: string, days: number) {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

const statusLabels = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
} as const;

function statusVariant(status: DailyPrivateRow["lesson"]["status"]) {
  if (status === "completed") return "default" as const;
  if (status === "cancelled") return "outline" as const;
  return "secondary" as const;
}

function DailyPrivateCard({ row }: { row: DailyPrivateRow }) {
  const updateLesson = useConvexMutation(api.privates.updatePrivateLesson);
  const [savingStatus, setSavingStatus] = useState<
    "completed" | "cancelled" | null
  >(null);
  const studentSummary =
    row.students
      .map(({ student }) =>
        student ? `${student.firstName} ${student.lastName}` : "Student not found",
      )
      .join(", ") || "No students";

  async function setStatus(status: "completed" | "cancelled") {
    if (savingStatus || row.lesson.status === status) return;
    setSavingStatus(status);
    try {
      await updateLesson({
        privateLessonId: row.lesson._id,
        startsAt: row.lesson.startsAt,
        durationMinutes: row.lesson.durationMinutes,
        status,
        notes: row.lesson.notes,
      });
      toast.success(
        status === "completed"
          ? "Private lesson marked completed and billable."
          : "Private lesson cancelled.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update private lesson.",
      );
    } finally {
      setSavingStatus(null);
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{row.private.name}</CardTitle>
            <CardDescription>
              {formatInTimeZone(
                row.lesson.startsAt,
                row.private.schedulePrompt.timezone,
                "MMM d, yyyy 'at' h:mm a zzz",
              )}
            </CardDescription>
          </div>
          <Badge variant={statusVariant(row.lesson.status)}>
            {statusLabels[row.lesson.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Instructor</dt>
            <dd className="font-medium">
              {row.instructor ? getAccountName(row.instructor) : "Not found"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Duration</dt>
            <dd className="font-medium">{row.lesson.durationMinutes} min</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Students</dt>
            <dd className="font-medium">{studentSummary}</dd>
          </div>
          {row.lesson.notes ? (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-wrap">{row.lesson.notes}</dd>
            </div>
          ) : null}
        </dl>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            type="button"
            size="sm"
            onClick={() => void setStatus("completed")}
            disabled={savingStatus !== null || row.lesson.status === "completed"}
          >
            {savingStatus === "completed" ? <Spinner /> : <CalendarCheck />}
            {row.lesson.status === "completed" ? "Completed" : "Complete"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void setStatus("cancelled")}
            disabled={savingStatus !== null || row.lesson.status === "cancelled"}
          >
            {savingStatus === "cancelled" ? <Spinner /> : <X />}
            {row.lesson.status === "cancelled" ? "Cancelled" : "Cancel"}
          </Button>
          <Button
            asChild
            type="button"
            size="sm"
            variant="ghost"
            className="col-span-2 sm:ml-auto"
          >
            <Link
              to="/admin/privates/$privateId/$privateLessonId"
              params={{
                privateId: row.private._id,
                privateLessonId: row.lesson._id,
              }}
            >
              <Pencil />
              Edit details
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DailyPrivatesPage() {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [incomplete, setIncomplete] = useState(false);
  const rows = useConvexQuery(api.privates.adminListDailyPrivateLessons, {
    date,
    incomplete,
  });

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Daily privates</h1>
            <p className="text-muted-foreground">
              Track private lesson attendance and billing status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              title="Previous day"
              onClick={() => setDate((value) => shiftDate(value, -1))}
              disabled={incomplete}
            >
              <ChevronLeft />
            </Button>
            <Input
              aria-label="Private lesson date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="min-w-0 flex-1 sm:w-auto sm:flex-none"
              disabled={incomplete}
            />
            <Button
              variant="outline"
              size="icon"
              title="Next day"
              onClick={() => setDate((value) => shiftDate(value, 1))}
              disabled={incomplete}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <span className="text-sm">
            {rows === undefined ? "Loading sessions..." : `${rows.length} sessions`}
          </span>
          <div className="flex items-center gap-2">
            <Switch
              id="incomplete-private-lessons"
              checked={incomplete}
              onCheckedChange={setIncomplete}
            />
            <Label htmlFor="incomplete-private-lessons">Incomplete</Label>
          </div>
        </div>

        {rows === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>No private lessons</CardTitle>
              <CardDescription>
                {incomplete
                  ? "No past private lessons are waiting to be marked."
                  : "No private lessons are scheduled for this date."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <DailyPrivateCard key={row.lesson._id} row={row} />
            ))}
          </div>
        )}
      </main>
    </RoleGate>
  );
}

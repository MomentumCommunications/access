import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";
import { getAccountName } from "~/lib/account-name";
import {
  formatDateTime,
  formatMDYYYY,
  formatTimeRange,
} from "~/lib/date-utils";

export const Route = createFileRoute("/_app/admin/privates/$privateId")({
  component: PrivateDetailPage,
});

type LessonRow = {
  lesson: Doc<"privateLessons">;
  students: Array<{
    participation: Doc<"privateLessonStudents">;
    student: Doc<"students"> | null;
  }>;
};

const columns: ColumnDef<LessonRow>[] = [
  {
    id: "startsAt",
    accessorFn: (row) => row.lesson.startsAt,
    header: "Starts",
    cell: ({ row }) => (
      <Button asChild variant="link" className="h-auto p-0">
        <Link
          to="/admin/privates/$privateId/$privateLessonId"
          params={{
            privateId: row.original.lesson.privateId,
            privateLessonId: row.original.lesson._id,
          }}
        >
          {formatDateTime(row.original.lesson.startsAt)}
        </Link>
      </Button>
    ),
  },
  {
    id: "duration",
    header: "Duration",
    cell: ({ row }) => `${row.original.lesson.durationMinutes} min`,
  },
  {
    id: "students",
    header: "Students",
    cell: ({ row }) =>
      row.original.students
        .map(({ student }) =>
          student ? `${student.firstName} ${student.lastName}` : "Missing",
        )
        .join(", ") || "None",
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.lesson.status === "cancelled"
            ? "outline"
            : row.original.lesson.status === "completed"
              ? "secondary"
              : "default"
        }
      >
        {row.original.lesson.status}
      </Badge>
    ),
  },
  {
    id: "source",
    header: "Source",
    cell: ({ row }) =>
      row.original.lesson.generatedFromSchedule ? "Generated" : "Manual",
  },
];

function PrivateDetailPage() {
  const { privateId } = Route.useParams();
  const data = useConvexQuery(api.privates.getPrivate, { privateId });
  const generateLessons = useConvexMutation(
    api.privates.adminGeneratePrivateLessons,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const schedule = data?.private.schedulePrompt;
  const weekdaySummary =
    schedule?.weekdays
      .map((weekday) => weekday.slice(0, 3))
      .join(", ") || "Not set";

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const result = await generateLessons({ privateId });
      toast.success(
        `Schedule synced: ${result.created} created, ${result.updated} updated, ${result.removed} removed.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to sync schedule.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 lg:p-8">
        {data === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold">{data.private.name}</h1>
              <p className="text-muted-foreground">
                Edit the standing arrangement and manage its lesson history.
              </p>
            </div>
            <Card className="rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Private details</CardTitle>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/admin/privates/$privateId/edit"
                    params={{ privateId }}
                  >
                    <Pencil />
                    Edit
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Instructor
                  </div>
                  <div className="font-medium">
                    {data.instructor
                      ? getAccountName(data.instructor)
                      : "Not found"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Students</div>
                  <div className="font-medium">
                    {data.defaultStudents
                      .filter((student) => student !== null)
                      .map(
                        (student) =>
                          `${student.firstName} ${student.lastName}`,
                      )
                      .join(", ") || "Not set"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Duration</div>
                  <div className="font-medium">
                    {data.private.defaultDurationMinutes} minutes
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge
                    variant={data.private.isActive ? "default" : "outline"}
                  >
                    {data.private.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Days</div>
                  <div className="font-medium capitalize">
                    {weekdaySummary}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Time</div>
                  <div className="font-medium">
                    {formatTimeRange(schedule?.startTime)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Dates</div>
                  <div className="font-medium">
                    {formatMDYYYY(schedule?.startDate)} -{" "}
                    {formatMDYYYY(schedule?.endDate)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Timezone</div>
                  <div className="font-medium">
                    {schedule?.timezone || "Not set"}
                  </div>
                </div>
                {data.private.notes ? (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <div className="text-sm text-muted-foreground">Notes</div>
                    <p className="whitespace-pre-wrap font-medium">
                      {data.private.notes}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
            <section className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Lessons</h2>
                  <p className="text-sm text-muted-foreground">
                    Generated and manually adjusted lesson occurrences.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  <RefreshCw className={isGenerating ? "animate-spin" : ""} />
                  Sync Schedule
                </Button>
              </div>
              <DataTable
                columns={columns}
                data={data.lessons}
                filterColumn="startsAt"
                filterPlaceholder="Filter lessons..."
              />
            </section>
          </>
        )}
      </main>
    </RoleGate>
  );
}

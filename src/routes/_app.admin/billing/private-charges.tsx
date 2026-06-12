import { useConvexQuery } from "@convex-dev/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { getAccountName } from "~/lib/account-name";
import { formatDateTime } from "~/lib/date-utils";

export const Route = createFileRoute(
  "/_app/admin/billing/private-charges",
)({
  component: PrivateChargesPage,
});

type PrivateChargeRow = NonNullable<
  FunctionReturnType<
    typeof api.privates.adminListBillablePrivateLessonStudents
  >[number]
>;

function dateValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function periodDefaults() {
  const now = new Date();
  return {
    start: dateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: dateValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function startTimestamp(date: string) {
  return new Date(`${date}T00:00:00`).getTime();
}

function endExclusiveTimestamp(date: string) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + 1);
  return value.getTime();
}

const columns: ColumnDef<PrivateChargeRow>[] = [
  {
    id: "student",
    accessorFn: (row) =>
      row.student
        ? `${row.student.firstName} ${row.student.lastName}`
        : "",
    header: "Student",
    cell: ({ row }) =>
      row.original.student ? (
        <Link
          className="font-medium underline-offset-4 hover:underline"
          to="/admin/students/$studentId"
          params={{ studentId: row.original.student._id }}
        >
          {row.original.student.firstName} {row.original.student.lastName}
        </Link>
      ) : (
        "Missing student"
      ),
  },
  {
    id: "private",
    header: "Private",
    cell: ({ row }) => row.original.private?.name || "Missing private",
  },
  {
    id: "lesson",
    header: "Lesson",
    cell: ({ row }) => formatDateTime(row.original.lesson.startsAt),
  },
  {
    id: "instructor",
    header: "Instructor",
    cell: ({ row }) =>
      row.original.instructor
        ? getAccountName(row.original.instructor)
        : "Not set",
  },
  {
    id: "duration",
    header: "Duration",
    cell: ({ row }) => `${row.original.lesson.durationMinutes} min`,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => row.original.participation.status,
  },
  {
    id: "billable",
    header: "Billable",
    cell: () => <Badge>Yes</Badge>,
  },
  {
    id: "amount",
    header: "Charge",
    cell: () => "Not configured",
  },
];

function PrivateChargesPage() {
  const defaults = periodDefaults();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const validPeriod = !!startDate && !!endDate && endDate >= startDate;
  const rows = useConvexQuery(
    api.privates.adminListBillablePrivateLessonStudents,
    validPeriod
      ? {
          startsAtOrAfter: startTimestamp(startDate),
          startsBefore: endExclusiveTimestamp(endDate),
        }
      : "skip",
  );

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Private Charges</h1>
          <p className="text-muted-foreground">
            Review completed, billable private lesson participation separately
            from regular tuition.
          </p>
        </div>
        {rows === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            filterColumn="student"
            filterPlaceholder="Filter students..."
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="private-charge-start">Period</Label>
                <Input
                  id="private-charge-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) return;
                    setStartDate(value);
                    if (endDate < value) {
                      setEndDate(value);
                    }
                  }}
                  className="w-40"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  aria-label="Private charge period end"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(event) => {
                    if (event.target.value) {
                      setEndDate(event.target.value);
                    }
                  }}
                  className="w-40"
                />
              </div>
            }
          />
        )}
      </main>
    </RoleGate>
  );
}

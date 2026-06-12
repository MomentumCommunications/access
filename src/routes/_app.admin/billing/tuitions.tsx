import { useConvexQuery } from "@convex-dev/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/admin/billing/tuitions")({
  component: TuitionsPage,
});

type TuitionRow = NonNullable<
  FunctionReturnType<typeof api.billing.adminTuitionReview>[number]
>;

function todayValue() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatHours(minutes: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(minutes / 60);
}

const columns: ColumnDef<TuitionRow>[] = [
  {
    id: "student",
    accessorFn: (row) => `${row.student.firstName} ${row.student.lastName}`,
    header: "Student",
    cell: ({ row }) => (
      <Button asChild variant="link" className="h-auto p-0">
        <Link
          to="/admin/students/$studentId"
          params={{ studentId: row.original.student._id }}
        >
          {row.original.student.firstName} {row.original.student.lastName}
        </Link>
      </Button>
    ),
  },
  {
    accessorKey: "householdName",
    header: "Household",
  },
  {
    accessorKey: "weeklyMinutes",
    header: "Weekly minutes",
  },
  {
    id: "weeklyHours",
    header: "Weekly hours",
    cell: ({ row }) => formatHours(row.original.weeklyMinutes),
  },
  {
    id: "tier",
    header: "Pricing tier",
    cell: () => <Badge variant="outline">Not configured</Badge>,
  },
  {
    id: "tuition",
    header: "Base tuition",
    cell: () => "—",
  },
];

function TuitionsPage() {
  const [asOfDate, setAsOfDate] = useState(todayValue);
  const rows = useConvexQuery(
    api.billing.adminTuitionReview,
    asOfDate ? { asOfDate } : "skip",
  );

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Tuitions</h1>
          <p className="text-muted-foreground">
            Review regular class-hour calculations before pricing is applied.
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
              <div className="flex items-center gap-2">
                <Label htmlFor="tuition-as-of" className="whitespace-nowrap">
                  As of
                </Label>
                <Input
                  id="tuition-as-of"
                  type="date"
                  value={asOfDate}
                  onChange={(event) => {
                    if (event.target.value) {
                      setAsOfDate(event.target.value);
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

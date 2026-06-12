import { useConvexQuery } from "@convex-dev/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/admin/billing/tuitions")({
  component: TuitionsPage,
});

type TuitionReview = FunctionReturnType<
  typeof api.billing.adminPeriodTuitionReview
>;
type TuitionRow = TuitionReview["rows"][number];

function dateValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function periodDefaults() {
  const today = new Date();
  return {
    start: dateValue(new Date(today.getFullYear(), today.getMonth(), 1)),
    end: dateValue(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

function formatHours(minutes: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(minutes / 60);
}

function formatWeeklyHourRange(row: TuitionRow) {
  const values = [
    ...new Set(
      row.segments
        .map((segment) => segment.weeklyMinutes)
        .filter((minutes) => minutes > 0),
    ),
  ].sort((left, right) => left - right);
  if (values.length === 0) return "0";
  if (values.length === 1) return formatHours(values[0]);
  return `${formatHours(values[0])} - ${formatHours(values.at(-1)!)}`;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
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
    id: "weeklyHours",
    header: "Weekly hours",
    cell: ({ row }) => formatWeeklyHourRange(row.original),
  },
  {
    id: "tier",
    header: "Pricing tier",
    cell: ({ row }) => {
      const labels = [
        ...new Set(
          row.original.segments.flatMap((segment) =>
            segment.tierLabel ? [segment.tierLabel] : [],
          ),
        ),
      ];
      return labels.length > 0 ? labels.join(" / ") : "No class hours";
    },
  },
  {
    id: "treatment",
    header: "Treatment",
    cell: ({ row }) => (
      <Badge variant={row.original.isProrated ? "secondary" : "outline"}>
        {row.original.isProrated ? "Prorated" : "Full period"}
      </Badge>
    ),
  },
  {
    id: "tuition",
    header: "Calculated tuition",
    cell: ({ row }) =>
      row.original.totalTuitionCents === undefined ? (
        <span className="text-destructive">
          {row.original.warning || "Unable to calculate"}
        </span>
      ) : (
        <span className="font-medium">
          {formatCurrency(row.original.totalTuitionCents)}
        </span>
      ),
  },
];

function TuitionsPage() {
  return (
    <RoleGate allow="admin">
      <TuitionsAdminPage />
    </RoleGate>
  );
}

function TuitionsAdminPage() {
  const defaults = periodDefaults();
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);
  const validPeriod =
    !!periodStart && !!periodEnd && periodEnd >= periodStart;
  const review = useConvexQuery(
    api.billing.adminPeriodTuitionReview,
    validPeriod ? { periodStart, periodEnd } : "skip",
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Tuitions</h1>
        <p className="text-muted-foreground">
          Review regular tuition by billing period, including enrollment
          proration and mid-period tier changes.
        </p>
      </div>

      {review === undefined ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner className="size-5" />
        </div>
      ) : (
        <>
          {review.excludedEnrollments.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>
                {review.excludedEnrollments.length} enrollment{" "}
                {review.excludedEnrollments.length === 1 ? "needs" : "need"}{" "}
                attention
              </AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  {review.excludedEnrollments.map((exclusion) => (
                    <li key={exclusion.enrollmentId}>
                      {exclusion.studentName}
                      {exclusion.classTitle
                        ? ` in ${exclusion.classTitle}`
                        : ""}
                      : {exclusion.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          {review.pricingSchema === null ? (
            <Alert>
              <AlertTriangle />
              <AlertTitle>No active pricing schema</AlertTitle>
              <AlertDescription>
                Save and activate a pricing schema before calculating tuition.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Using{" "}
                <span className="font-medium text-foreground">
                  {review.pricingSchema.name} version{" "}
                  {review.pricingSchema.version}
                </span>
              </div>
              <DataTable
                columns={columns}
                data={review.rows}
                filterColumn="student"
                filterPlaceholder="Filter students..."
                toolbar={
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="tuition-period-start">
                      Billing period
                    </Label>
                    <Input
                      id="tuition-period-start"
                      type="date"
                      value={periodStart}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (!value) return;
                        setPeriodStart(value);
                        if (periodEnd < value) setPeriodEnd(value);
                      }}
                      className="w-40"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      aria-label="Tuition billing period end"
                      type="date"
                      min={periodStart}
                      value={periodEnd}
                      onChange={(event) => {
                        if (event.target.value) {
                          setPeriodEnd(event.target.value);
                        }
                      }}
                      className="w-40"
                    />
                  </div>
                }
              />
            </>
          )}
        </>
      )}
    </main>
  );
}

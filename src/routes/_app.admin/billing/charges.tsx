import { useConvexQuery } from "@convex-dev/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { CalendarCheck, GraduationCap } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Badge } from "~/components/ui/badge";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs";
import { getAccountName } from "~/lib/account-name";
import { formatDateTime, formatMDYYYY } from "~/lib/date-utils";

export const Route = createFileRoute("/_app/admin/billing/charges")({
  component: ChargesPage,
});

type PrivateChargeRow = NonNullable<
  FunctionReturnType<
    typeof api.billing.adminPeriodChargesReview
  >["privateCharges"][number]
>;
type PerSessionChargeRow = FunctionReturnType<
  typeof api.billing.adminPeriodChargesReview
>["perSessionCharges"][number];

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

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function householdName(row: {
  household: {
    householdName?: string;
    householdLinkWarning?: string;
  };
}) {
  return row.household.householdName || "Not linked";
}

const privateColumns: ColumnDef<PrivateChargeRow>[] = [
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
    id: "household",
    accessorFn: householdName,
    header: "Household",
    cell: ({ row }) => (
      <div>
        <div>{householdName(row.original)}</div>
        {row.original.household.householdLinkWarning ? (
          <div className="max-w-64 text-xs text-amber-700 dark:text-amber-400">
            {row.original.household.householdLinkWarning}
          </div>
        ) : null}
      </div>
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
    cell: () => (
      <span className="text-muted-foreground">Pricing not configured</span>
    ),
  },
];

const perSessionColumns: ColumnDef<PerSessionChargeRow>[] = [
  {
    id: "student",
    accessorFn: (row) =>
      `${row.student.firstName} ${row.student.lastName}`,
    header: "Student",
    cell: ({ row }) => (
      <Link
        className="font-medium underline-offset-4 hover:underline"
        to="/admin/students/$studentId"
        params={{ studentId: row.original.student._id }}
      >
        {row.original.student.firstName} {row.original.student.lastName}
      </Link>
    ),
  },
  {
    id: "household",
    accessorFn: householdName,
    header: "Household",
    cell: ({ row }) => (
      <div>
        <div>{householdName(row.original)}</div>
        {row.original.household.householdLinkWarning ? (
          <div className="max-w-64 text-xs text-amber-700 dark:text-amber-400">
            {row.original.household.householdLinkWarning}
          </div>
        ) : null}
      </div>
    ),
  },
  {
    id: "class",
    accessorFn: (row) => row.classItem.title,
    header: "Class",
    cell: ({ row }) => (
      <Link
        className="font-medium underline-offset-4 hover:underline"
        to="/admin/classes/$classId"
        params={{ classId: row.original.classItem._id }}
      >
        {row.original.classItem.title}
      </Link>
    ),
  },
  {
    id: "period",
    header: "Billing period",
    cell: ({ row }) =>
      `${formatMDYYYY(row.original.periodStart)} - ${formatMDYYYY(
        row.original.periodEnd,
      )}`,
  },
  {
    accessorKey: "selectedSessionCount",
    header: "Sessions",
  },
  {
    id: "unitPrice",
    header: "Base price",
    cell: ({ row }) =>
      row.original.perSessionPriceCents === undefined ? (
        <div>
          <span>Varies</span>
          <div className="text-xs text-amber-700 dark:text-amber-400">
            {row.original.warning}
          </div>
        </div>
      ) : (
        formatCurrency(row.original.perSessionPriceCents)
      ),
  },
  {
    id: "aggregate",
    header: "Charge",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.original.aggregateAmountCents)}
      </span>
    ),
  },
];

function ChargesPage() {
  return (
    <RoleGate allow="admin">
      <ChargesAdminPage />
    </RoleGate>
  );
}

function ChargesAdminPage() {
  const defaults = periodDefaults();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const validPeriod = !!startDate && !!endDate && endDate >= startDate;
  const review = useConvexQuery(
    api.billing.adminPeriodChargesReview,
    validPeriod
      ? {
          periodStart: startDate,
          periodEnd: endDate,
          startsAtOrAfter: startTimestamp(startDate),
          startsBefore: endExclusiveTimestamp(endDate),
        }
      : "skip",
  );
  const totalPerSessionCents = useMemo(
    () =>
      review?.perSessionCharges.reduce(
        (total, row) => total + row.aggregateAmountCents,
        0,
      ) || 0,
    [review?.perSessionCharges],
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Charges</h1>
          <p className="text-muted-foreground">
            Review app-calculated private lesson and per-session class charges
            separately from recurring tuition.
          </p>
        </div>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Billing period</CardTitle>
            <CardDescription>
              Charges shown here are calculated by Access Momentum. Manual
              one-off charges remain in Stripe.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="charge-start">Start</Label>
              <Input
                id="charge-start"
                type="date"
                value={startDate}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  setStartDate(value);
                  if (endDate < value) setEndDate(value);
                }}
                className="w-full sm:w-44"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-end">End</Label>
              <Input
                id="charge-end"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => {
                  if (event.target.value) setEndDate(event.target.value);
                }}
                className="w-full sm:w-44"
              />
            </div>
          </CardContent>
        </Card>
        {review === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <Tabs defaultValue="private" className="gap-4">
            <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
              <TabsTrigger value="private">
                <GraduationCap />
                Private charges
                <Badge variant="secondary">
                  {review.privateCharges.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="per-session">
                <CalendarCheck />
                Per-session classes
                <Badge variant="secondary">
                  {review.perSessionCharges.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="private" className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold">Private charges</h2>
                <p className="text-sm text-muted-foreground">
                  Completed private lesson participation marked billable.
                  Private pricing is not configured yet.
                </p>
              </div>
              <DataTable
                columns={privateColumns}
                data={review.privateCharges}
                filterColumn="student"
                filterPlaceholder="Filter students..."
              />
            </TabsContent>
            <TabsContent value="per-session" className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Per-session class charges
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Confirmed selected sessions grouped by student and class
                    using each signup&apos;s saved price.
                  </p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    Period total:{" "}
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(totalPerSessionCents)}
                  </span>
                </div>
              </div>
              <DataTable
                columns={perSessionColumns}
                data={review.perSessionCharges}
                filterColumn="student"
                filterPlaceholder="Filter students..."
              />
            </TabsContent>
          </Tabs>
        )}
    </main>
  );
}

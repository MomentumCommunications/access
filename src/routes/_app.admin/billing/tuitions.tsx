import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { AlertTriangle, Users } from "lucide-react";
import { useState } from "react";
import { RoleGate } from "~/components/role-gate";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

export const Route = createFileRoute("/_app/admin/billing/tuitions")({
  component: TuitionsPage,
});

type TuitionReview = FunctionReturnType<
  typeof api.billing.adminPeriodTuitionReview
>;
type TuitionRow = TuitionReview["rows"][number];
type HouseholdTuition = TuitionReview["households"][number];

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

function tierLabels(row: TuitionRow) {
  const labels = [
    ...new Set(
      row.segments.flatMap((segment) =>
        segment.tierLabel ? [segment.tierLabel] : [],
      ),
    ),
  ];
  return labels.length > 0 ? labels.join(" / ") : "No class hours";
}

function HouseholdTuitionCard({
  household,
}: {
  household: HouseholdTuition;
}) {
  const linkageWarning = household.students.find(
    (student) => student.householdLinkWarning,
  )?.householdLinkWarning;

  return (
    <Card className="rounded-lg">
      <CardHeader className="gap-3 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" />
              {household.householdName}
            </CardTitle>
            <CardDescription>
              {household.students.length}{" "}
              {household.students.length === 1 ? "student" : "students"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {household.householdLinkSource !== "household" ? (
              <Badge variant="outline">Household link needed</Badge>
            ) : null}
            {household.siblingDiscountCandidate ? (
              <Badge variant="secondary">Sibling discount candidate</Badge>
            ) : null}
            {household.hasIncompleteTuition ? (
              <Badge variant="destructive">Incomplete pricing</Badge>
            ) : null}
          </div>
        </div>
        {linkageWarning ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {linkageWarning}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Weekly hours</TableHead>
              <TableHead>Pricing tier</TableHead>
              <TableHead>Treatment</TableHead>
              <TableHead className="text-right">Base tuition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {household.students.map((student) => (
              <TableRow key={student.student._id}>
                <TableCell>
                  <Button asChild variant="link" className="h-auto p-0">
                    <Link
                      to="/admin/students/$studentId"
                      params={{ studentId: student.student._id }}
                    >
                      {student.student.firstName} {student.student.lastName}
                    </Link>
                  </Button>
                </TableCell>
                <TableCell>{formatWeeklyHourRange(student)}</TableCell>
                <TableCell>{tierLabels(student)}</TableCell>
                <TableCell>
                  <Badge
                    variant={student.isProrated ? "secondary" : "outline"}
                  >
                    {student.isProrated ? "Prorated" : "Full period"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {student.totalTuitionCents === undefined ? (
                    <span className="text-destructive">
                      {student.warning || "Unable to calculate"}
                    </span>
                  ) : (
                    <span className="font-medium">
                      {formatCurrency(student.totalTuitionCents)}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="grid gap-4 border-t p-4 md:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              Scholarships: not evaluated
            </Badge>
            <Badge variant="outline">Packages: not evaluated</Badge>
            <Badge variant="outline">Adjustments: none applied</Badge>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              Base tuition subtotal
            </div>
            <div className="text-xl font-semibold">
              {formatCurrency(household.subtotalBaseTuitionCents)}
            </div>
            {household.hasIncompleteTuition ? (
              <div className="text-xs text-destructive">
                Total excludes unpriced students
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                No adjustments applied
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-4">
        <div className="space-y-2">
          <Label htmlFor="tuition-period-start">Billing period start</Label>
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
            className="w-44"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tuition-period-end">Billing period end</Label>
          <Input
            id="tuition-period-end"
            type="date"
            min={periodStart}
            value={periodEnd}
            onChange={(event) => {
              if (event.target.value) {
                setPeriodEnd(event.target.value);
              }
            }}
            className="w-44"
          />
        </div>
        {!validPeriod ? (
          <p className="text-sm text-destructive">
            End date must be on or after start date.
          </p>
        ) : null}
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
              {review.households.length === 0 ? (
                <Card className="rounded-lg">
                  <CardHeader>
                    <CardTitle>No tuition results</CardTitle>
                    <CardDescription>
                      No regular class enrollments contribute tuition in this
                      billing period.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="space-y-4">
                  {review.households.map((household) => (
                    <HouseholdTuitionCard
                      key={household.householdId}
                      household={household}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

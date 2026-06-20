import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ReceiptText,
  Users,
} from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/tuition-plan")({
  validateSearch: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  }),
  component: TuitionPlanPage,
});

const reasonLabels = {
  scholarship: "Scholarship",
  goodwill: "Goodwill adjustment",
  manual_correction: "Tuition correction",
  waiver: "Waiver",
  surcharge: "Additional tuition",
  other: "Tuition adjustment",
} as const;

function formatCurrency(cents?: number) {
  if (cents === undefined) return "Pricing unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatMonth(month: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
}

function formatHours(minutes: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(minutes / 60);
}

function studentDetail(student: {
  segments: Array<{
    weeklyMinutes: number;
    monthlyAmountCents?: number;
  }>;
  isProrated: boolean;
}) {
  const weeklyMinutes = [
    ...new Set(
      student.segments
        .filter((segment) => segment.monthlyAmountCents !== undefined)
        .map((segment) => segment.weeklyMinutes),
    ),
  ].sort((left, right) => left - right);
  const hours =
    weeklyMinutes.length === 0
      ? undefined
      : weeklyMinutes.length === 1
        ? formatHours(weeklyMinutes[0])
        : `${formatHours(weeklyMinutes[0])}–${formatHours(
            weeklyMinutes.at(-1)!,
          )}`;
  return [
    hours ? `${hours} weekly class hours` : undefined,
    student.isProrated ? "Prorated for this month" : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}

function TuitionPlanPage() {
  const { month } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const plan = useConvexQuery(api.billing.currentHouseholdTuitionPlan, {
    month,
  });

  useEffect(() => {
    if (
      plan?.status === "ready" &&
      plan.selectedMonth &&
      plan.selectedMonth !== month
    ) {
      void navigate({
        search: { month: plan.selectedMonth },
        replace: true,
      });
    }
  }, [month, navigate, plan]);

  if (plan === undefined) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner className="size-5" />
          Loading tuition plan...
        </div>
      </main>
    );
  }

  if (plan.status === "unauthenticated") {
    return (
      <main className="mx-auto w-full max-w-3xl p-4 lg:p-8">
        <h1 className="text-3xl font-bold">Tuition plan</h1>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Sign in to view your household&apos;s monthly tuition breakdown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (plan.status === "missing_household") {
    return (
      <main className="mx-auto w-full max-w-3xl p-4 lg:p-8">
        <h1 className="text-3xl font-bold">Tuition plan</h1>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Household not connected</CardTitle>
            <CardDescription>
              Your account is not connected to a billing household yet. Please
              contact an administrator for help.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const breakdown = plan.breakdown;
  const allAdjustments = breakdown
    ? [
        ...breakdown.students.flatMap((student) =>
          student.adjustments.map((adjustment) => ({
            ...adjustment,
            label: `${reasonLabels[adjustment.reasonCode]} · ${
              student.studentName
            }`,
          })),
        ),
        ...breakdown.siblingAdjustments.map((adjustment, index) => ({
          id: `sibling-${index}`,
          amountCents: adjustment.amountCents,
          applicable: true,
          label: adjustment.label,
          note: undefined,
        })),
        ...breakdown.householdAdjustments.map((adjustment) => ({
          ...adjustment,
          applicable: true,
          label: reasonLabels[adjustment.reasonCode],
        })),
      ]
    : [];

  function selectMonth(nextMonth?: string) {
    if (!nextMonth) return;
    void navigate({ search: { month: nextMonth } });
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Tuition plan</h1>
        <p className="text-muted-foreground">
          See how your household&apos;s monthly tuition is calculated and which
          private lesson arrangements are connected to your account.
        </p>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous billing month"
              disabled={!plan.previousMonth}
              onClick={() => selectMonth(plan.previousMonth)}
            >
              <ChevronLeft />
            </Button>
            <div className="text-center">
              <CardTitle>
                {plan.selectedMonth
                  ? formatMonth(plan.selectedMonth)
                  : "Monthly tuition breakdown"}
              </CardTitle>
              <CardDescription>{plan.householdName}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next billing month"
              disabled={!plan.nextMonth}
              onClick={() => selectMonth(plan.nextMonth)}
            >
              <ChevronRight />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!plan.selectedMonth || !breakdown ? (
            <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center">
              <ReceiptText className="size-8 text-muted-foreground" />
              <p className="font-medium">No monthly tuition breakdown yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Tuition details will appear here when this household has
                billable class enrollment dates.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Household tuition for this month
                </p>
                <p className="text-3xl font-bold">
                  {formatCurrency(breakdown.totalTuitionCents)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This reflects the current tuition basis and adjustments for
                  the selected month. Your final invoice may include separate
                  charges.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="font-semibold">Students</h2>
                {breakdown.students.map((student) => (
                  <div
                    key={student.studentId}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{student.studentName}</p>
                        <p className="text-sm text-muted-foreground">
                          {studentDetail(student) || "Monthly class tuition"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(student.adjustedTuitionCents)}
                        </p>
                        {student.rawBaseTuitionCents !==
                        student.adjustedTuitionCents ? (
                          <p className="text-xs text-muted-foreground line-through">
                            {formatCurrency(student.rawBaseTuitionCents)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {allAdjustments.length > 0 ? (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h2 className="font-semibold">Adjustments</h2>
                    <div className="space-y-2">
                      {allAdjustments.map((adjustment) => (
                        <div
                          key={adjustment.id}
                          className="flex items-start justify-between gap-4 text-sm"
                        >
                          <div>
                            <p>{adjustment.label}</p>
                            {adjustment.note ? (
                              <p className="text-xs text-muted-foreground">
                                {adjustment.note}
                              </p>
                            ) : null}
                            {!adjustment.applicable ? (
                              <Badge variant="outline" className="mt-1">
                                No applicable tuition this month
                              </Badge>
                            ) : null}
                          </div>
                          <span
                            className={
                              adjustment.amountCents < 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : undefined
                            }
                          >
                            {formatCurrency(adjustment.amountCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {breakdown.hasIncompleteTuition ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Some tuition could not be priced from the current enrollment
                  information. Please contact an administrator with questions.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected privates</CardTitle>
          <CardDescription>
            Private lessons are billed separately based on lessons and
            attendance. These are the arrangements currently connected to your
            household.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plan.connectedPrivates.length === 0 ? (
            <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <GraduationCap className="size-7" />
              <p>No connected private lessons.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {plan.connectedPrivates.map((privateSeries) => (
                <div
                  key={privateSeries.privateId}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 size-5 text-muted-foreground" />
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{privateSeries.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {privateSeries.studentNames.join(", ")}
                      </p>
                      <p className="text-sm">
                        Instructor: {privateSeries.instructorName}
                      </p>
                      <p className="text-sm font-medium">
                        Typical private cost per session:{" "}
                        {formatCurrency(
                          privateSeries.typicalSessionCostCents,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {privateSeries.durationMinutes} minutes
                        {privateSeries.pricingLabel
                          ? ` · ${privateSeries.pricingLabel}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

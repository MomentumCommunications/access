import {
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { AlertTriangle, Ban, Pencil, Plus, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  formatPercentFromBasisPoints,
  parseCurrencyToCents,
  parsePercentToBasisPoints,
} from "../../../../shared/tuition-pricing";
import { BillingDateRangePicker } from "~/components/billing-date-range-picker";
import { RoleGate } from "~/components/role-gate";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
import { Textarea } from "~/components/ui/textarea";

export const Route = createFileRoute("/_app/admin/billing/tuitions")({
  component: TuitionsPage,
});

type TuitionReview = FunctionReturnType<
  typeof api.billing.adminPeriodTuitionReview
>;
type TuitionRow = TuitionReview["rows"][number];
type HouseholdTuition = TuitionReview["households"][number];
type BillingAdjustment = HouseholdTuition["billingAdjustments"][number];

const reasonLabels = {
  scholarship: "Scholarship",
  goodwill: "Goodwill",
  manual_correction: "Manual correction",
  waiver: "Waiver",
  surcharge: "Surcharge",
  other: "Other",
} as const;

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
  periodStart,
  periodEnd,
}: {
  household: HouseholdTuition;
  periodStart: string;
  periodEnd: string;
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
                  {student.baseTuitionCents === undefined ? (
                    <span className="text-destructive">
                      {student.warning || "Unable to calculate"}
                    </span>
                  ) : (
                    <div>
                      <span className="font-medium">
                        {formatCurrency(student.baseTuitionCents)}
                      </span>
                      {student.studentBillingAdjustments.map(
                        (adjustment) => (
                          <div
                            key={adjustment.id}
                            className="text-xs text-muted-foreground"
                          >
                            {reasonLabels[adjustment.reasonCode]}:{" "}
                            {adjustment.applicable
                              ? formatCurrency(adjustment.amountCents)
                              : "No applicable subtotal"}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="grid gap-4 border-t p-4 md:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                Scholarships: manual adjustments only
              </Badge>
              <Badge variant="outline">Packages: not evaluated</Badge>
              {household.adjustments.length === 0 ? (
                <Badge variant="outline">Sibling discount: none applied</Badge>
              ) : null}
            </div>
            <BillingAdjustmentManager
              household={household}
              periodStart={periodStart}
              periodEnd={periodEnd}
            />
          </div>
          <div className="min-w-56 space-y-2 text-right">
            <div className="flex justify-between gap-6 text-sm">
              <span className="text-muted-foreground">Base subtotal</span>
              <span>
                {formatCurrency(household.subtotalBaseTuitionCents)}
              </span>
            </div>
            {household.adjustments.map((adjustment, index) => (
              <div
                key={`${adjustment.type}-${adjustment.studentId || index}`}
                className="flex justify-between gap-6 text-sm"
              >
                <span className="text-muted-foreground">
                  {adjustment.label}
                </span>
                <span>{formatCurrency(adjustment.amountCents)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-6 border-t pt-2 text-sm font-medium">
              <span className="text-muted-foreground">
                After pricing rules
              </span>
              <span>
                {formatCurrency(
                  household.totalBeforeManualAdjustmentsCents,
                )}
              </span>
            </div>
            {household.billingAdjustments
              .filter((adjustment) => adjustment.status === "active")
              .map((adjustment) => (
                <div
                  key={adjustment._id}
                  className="flex justify-between gap-6 text-sm"
                >
                  <span className="text-muted-foreground">
                    {reasonLabels[adjustment.reasonCode]}
                  </span>
                  <span>
                    {formatCurrency(adjustment.appliedAmountCents || 0)}
                  </span>
                </div>
              ))}
            <div className="flex justify-between gap-6 border-t pt-2 text-lg font-semibold">
              <span>Reviewed total</span>
              <span>{formatCurrency(household.totalTuitionCents)}</span>
            </div>
            {household.hasIncompleteTuition ? (
              <div className="text-xs text-destructive">
                Total excludes unpriced students
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type AdjustmentFormState = {
  kind: "discount" | "surcharge";
  calculationType: "fixed_cents" | "percent";
  amount: string;
  reasonCode: keyof typeof reasonLabels;
  note: string;
};

const emptyAdjustmentForm: AdjustmentFormState = {
  kind: "discount",
  calculationType: "fixed_cents",
  amount: "",
  reasonCode: "scholarship",
  note: "",
};

function adjustmentFormState(
  adjustment?: BillingAdjustment,
): AdjustmentFormState {
  if (!adjustment) return emptyAdjustmentForm;
  return {
    kind: adjustment.kind,
    calculationType: adjustment.calculationType,
    amount:
      adjustment.calculationType === "fixed_cents"
        ? (adjustment.amount / 100).toFixed(2)
        : formatPercentFromBasisPoints(adjustment.amount),
    reasonCode: adjustment.reasonCode,
    note: adjustment.note || "",
  };
}

function BillingAdjustmentManager({
  household,
  periodStart,
  periodEnd,
}: {
  household: HouseholdTuition;
  periodStart: string;
  periodEnd: string;
}) {
  const createAdjustment = useConvexMutation(
    api.billing.adminCreateBillingAdjustment,
  );
  const updateAdjustment = useConvexMutation(
    api.billing.adminUpdateBillingAdjustment,
  );
  const voidAdjustment = useConvexMutation(
    api.billing.adminVoidBillingAdjustment,
  );
  const [editing, setEditing] = useState<BillingAdjustment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [voiding, setVoiding] = useState<BillingAdjustment | null>(null);
  const [form, setForm] = useState<AdjustmentFormState>(emptyAdjustmentForm);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  useEffect(() => {
    if (!showForm) return;
    setForm(adjustmentFormState(editing || undefined));
    setError("");
  }, [editing, showForm]);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(adjustment: BillingAdjustment) {
    setEditing(adjustment);
    setShowForm(true);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    const amount =
      form.calculationType === "fixed_cents"
        ? parseCurrencyToCents(form.amount)
        : parsePercentToBasisPoints(form.amount);
    if (amount === null || amount <= 0) {
      setError(
        form.calculationType === "fixed_cents"
          ? "Enter a positive dollar amount."
          : "Enter a percentage greater than 0 and no more than 100.",
      );
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      const values = {
        kind: form.kind,
        calculationType: form.calculationType,
        amount,
        reasonCode: form.reasonCode,
        note: form.note.trim() || undefined,
      };
      if (editing) {
        await updateAdjustment({
          billingAdjustmentId: editing._id,
          ...values,
        });
        toast.success("Billing adjustment updated.");
      } else {
        await createAdjustment({
          scopeType: "household_tuition",
          scopeId: household.householdId,
          periodStart,
          periodEnd,
          ...values,
        });
        toast.success("Billing adjustment added.");
      }
      setShowForm(false);
      setEditing(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The billing adjustment could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleVoid() {
    if (!voiding) return;
    setIsVoiding(true);
    try {
      await voidAdjustment({ billingAdjustmentId: voiding._id });
      toast.success("Billing adjustment voided.");
      setVoiding(null);
    } catch (voidError) {
      toast.error(
        voidError instanceof Error
          ? voidError.message
          : "The billing adjustment could not be voided.",
      );
    } finally {
      setIsVoiding(false);
    }
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Manual adjustments</h3>
            <p className="text-xs text-muted-foreground">
              Access-side changes for this household and billing period.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={openCreate}>
            <Plus />
            Add adjustment
          </Button>
        </div>
        {household.billingAdjustments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No manual adjustments.
          </p>
        ) : (
          <div className="space-y-2">
            {household.billingAdjustments.map((adjustment) => (
              <div
                key={adjustment._id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {reasonLabels[adjustment.reasonCode]}
                    </span>
                    <Badge
                      variant={
                        adjustment.status === "active"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {adjustment.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {adjustment.kind === "discount"
                      ? "Discount"
                      : "Surcharge"}{" "}
                    ·{" "}
                    {adjustment.calculationType === "fixed_cents"
                      ? formatCurrency(adjustment.amount)
                      : `${formatPercentFromBasisPoints(
                          adjustment.amount,
                        )}%`}
                    {adjustment.status === "active" &&
                    adjustment.appliedAmountCents !== undefined
                      ? ` · ${formatCurrency(
                          adjustment.appliedAmountCents,
                        )} applied`
                      : ""}
                  </p>
                  {adjustment.note ? (
                    <p className="mt-1 whitespace-pre-wrap">
                      {adjustment.note}
                    </p>
                  ) : null}
                </div>
                {adjustment.status === "active" ? (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Edit adjustment"
                      onClick={() => openEdit(adjustment)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Void adjustment"
                      onClick={() => setVoiding(adjustment)}
                    >
                      <Ban />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!isSaving) setShowForm(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit adjustment" : "Add adjustment"}
            </DialogTitle>
            <DialogDescription>
              Applies only to {household.householdName} for {periodStart} through{" "}
              {periodEnd}. Percentage adjustments use the subtotal after sibling
              discounts.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`adjustment-kind-${household.householdId}`}>
                  Type
                </Label>
                <select
                  id={`adjustment-kind-${household.householdId}`}
                  value={form.kind}
                  disabled={isSaving}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      kind: event.target.value as AdjustmentFormState["kind"],
                    }))
                  }
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="discount">Discount</option>
                  <option value="surcharge">Surcharge</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor={`adjustment-calculation-${household.householdId}`}
                >
                  Calculation
                </Label>
                <select
                  id={`adjustment-calculation-${household.householdId}`}
                  value={form.calculationType}
                  disabled={isSaving}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      calculationType:
                        event.target
                          .value as AdjustmentFormState["calculationType"],
                      amount: "",
                    }))
                  }
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="fixed_cents">Fixed amount</option>
                  <option value="percent">Percent</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`adjustment-amount-${household.householdId}`}>
                {form.calculationType === "fixed_cents"
                  ? "Amount"
                  : "Percent"}
              </Label>
              <div className="relative">
                <Input
                  id={`adjustment-amount-${household.householdId}`}
                  inputMode="decimal"
                  value={form.amount}
                  disabled={isSaving}
                  aria-invalid={!!error}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }));
                    setError("");
                  }}
                  className={
                    form.calculationType === "percent" ? "pr-9" : undefined
                  }
                />
                {form.calculationType === "percent" ? (
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                    %
                  </span>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`adjustment-reason-${household.householdId}`}>
                Reason
              </Label>
              <select
                id={`adjustment-reason-${household.householdId}`}
                value={form.reasonCode}
                disabled={isSaving}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reasonCode:
                      event.target
                        .value as AdjustmentFormState["reasonCode"],
                  }))
                }
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {Object.entries(reasonLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`adjustment-note-${household.householdId}`}>
                Note
              </Label>
              <Textarea
                id={`adjustment-note-${household.householdId}`}
                value={form.note}
                maxLength={1000}
                rows={3}
                disabled={isSaving}
                placeholder="Why this adjustment is needed"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : editing ? "Save changes" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!voiding}
        onOpenChange={(open) => {
          if (!open && !isVoiding) setVoiding(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this billing adjustment?</AlertDialogTitle>
            <AlertDialogDescription>
              It will remain in the review history but will no longer affect the
              household total. Voided adjustments cannot be edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVoiding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isVoiding}
              onClick={(event) => {
                event.preventDefault();
                void handleVoid();
              }}
            >
              {isVoiding ? "Voiding..." : "Void adjustment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
        <BillingDateRangePicker
          id="tuition-period"
          start={periodStart}
          end={periodEnd}
          onChange={(start, end) => {
            setPeriodStart(start);
            setPeriodEnd(end);
          }}
        />
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
                      periodStart={periodStart}
                      periodEnd={periodEnd}
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

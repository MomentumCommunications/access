import {
  useConvexAction,
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import {
  Ban,
  CircleAlert,
  CheckCircle2,
  FilePenLine,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  parseCurrencyToCents,
  parsePercentToBasisPoints,
} from "../../../../shared/tuition-pricing";
import { BillingDateRangePicker } from "~/components/billing-date-range-picker";
import { RoleGate } from "~/components/role-gate";
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
import { Checkbox } from "~/components/ui/checkbox";
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
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";

export const Route = createFileRoute("/_app/admin/billing/runs")({
  component: BillingRunsPage,
});

type BillingRuns = FunctionReturnType<typeof api.billing.adminListBillingRuns>;
type BillingRun = BillingRuns[number];
type BillingRunItem = BillingRun["items"][number];
type RunAdjustment = BillingRunItem["adjustments"][number];
type SourceMode = "tuition" | "charges" | "both";

const reasonLabels = {
  scholarship: "Scholarship",
  goodwill: "Goodwill",
  manual_correction: "Manual correction",
  waiver: "Waiver",
  surcharge: "Surcharge",
  other: "Other",
} as const;

type AdjustmentForm = {
  kind: "discount" | "surcharge";
  calculationType: "fixed_cents" | "percent";
  amount: string;
  reasonCode: keyof typeof reasonLabels;
  note: string;
};

const emptyAdjustment: AdjustmentForm = {
  kind: "discount",
  calculationType: "fixed_cents",
  amount: "",
  reasonCode: "manual_correction",
  note: "",
};

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

function formatPeriod(start: string, end: string) {
  return `${new Date(`${start}T12:00:00`).toLocaleDateString()} - ${new Date(
    `${end}T12:00:00`,
  ).toLocaleDateString()}`;
}

function adjustmentForm(adjustment?: RunAdjustment): AdjustmentForm {
  if (!adjustment) return emptyAdjustment;
  return {
    kind: adjustment.kind,
    calculationType: adjustment.calculationType,
    amount: (adjustment.amount / 100).toFixed(2),
    reasonCode: adjustment.reasonCode,
    note: adjustment.note || "",
  };
}

function BillingRunsPage() {
  return (
    <RoleGate allow="admin">
      <BillingRunsAdminPage />
    </RoleGate>
  );
}

function BillingRunsAdminPage() {
  const defaults = periodDefaults();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [sourceMode, setSourceMode] = useState<SourceMode>("both");
  const [includeDispatched, setIncludeDispatched] = useState(false);
  const [selectedIds, setSelectedIds] = useState<
    Set<BillingRunItem["_id"]>
  >(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingMissing, setIsAddingMissing] = useState(false);
  const [dispatchRun, setDispatchRun] = useState<BillingRun | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [recoveryRequest, setRecoveryRequest] = useState<{
    type: "regenerate" | "delete";
    run: BillingRun;
  } | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryErrors, setRecoveryErrors] = useState<
    Map<BillingRunItem["_id"], string>
  >(new Map());
  const [noteItem, setNoteItem] = useState<BillingRunItem | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [adjustmentItem, setAdjustmentItem] = useState<BillingRunItem | null>(
    null,
  );
  const [editingAdjustment, setEditingAdjustment] =
    useState<RunAdjustment | null>(null);
  const [voidingAdjustment, setVoidingAdjustment] =
    useState<RunAdjustment | null>(null);
  const [adjustmentValues, setAdjustmentValues] =
    useState<AdjustmentForm>(emptyAdjustment);
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [isVoidingAdjustment, setIsVoidingAdjustment] = useState(false);
  const selectionPeriod = useRef("");
  const seenDraftIds = useRef<Set<string>>(new Set());
  const validPeriod = !!startDate && !!endDate && endDate >= startDate;

  const runs = useConvexQuery(
    api.billing.adminListBillingRuns,
    validPeriod
      ? {
          periodStart: startDate,
          periodEnd: endDate,
          includeDispatched,
        }
      : "skip",
  );
  const generateRun = useConvexMutation(api.billing.adminGenerateBillingRun);
  const generateMissing = useConvexMutation(
    api.billing.adminGenerateMissingBillingRunItems,
  );
  const dispatchItems = useConvexAction(
    api.billingDispatch.adminDispatchBillingRunItems,
  );
  const regenerateItems = useConvexAction(
    api.billingDispatch.adminRegenerateBillingRunItems,
  );
  const deleteItems = useConvexAction(
    api.billingDispatch.adminDeleteBillingRunItems,
  );
  const updateItemNote = useConvexMutation(
    api.billing.adminUpdateBillingRunItemNote,
  );
  const createAdjustment = useConvexMutation(
    api.billing.adminCreateBillingAdjustment,
  );
  const updateAdjustment = useConvexMutation(
    api.billing.adminUpdateBillingAdjustment,
  );
  const voidAdjustment = useConvexMutation(
    api.billing.adminVoidBillingAdjustment,
  );

  const draftIds = useMemo(
    () =>
      new Set(
        (runs || []).flatMap((run) =>
          run.items
            .filter((item) => item.status !== "dispatched")
            .map((item) => item._id),
        ),
      ),
    [runs],
  );

  useEffect(() => {
    setSelectedIds((current) => {
      const periodKey = `${startDate}:${endDate}`;
      if (selectionPeriod.current !== periodKey) {
        selectionPeriod.current = periodKey;
        seenDraftIds.current = new Set();
        current = new Set();
      }
      const retained = new Set(
        [...current].filter((itemId) => draftIds.has(itemId)),
      );
      for (const itemId of draftIds) {
        if (!seenDraftIds.current.has(itemId)) retained.add(itemId);
        seenDraftIds.current.add(itemId);
      }
      return retained;
    });
  }, [draftIds, endDate, startDate]);

  async function handleGenerate() {
    if (!validPeriod) return;
    setIsGenerating(true);
    try {
      const result = await generateRun({
        periodStart: startDate,
        periodEnd: endDate,
        startsAtOrAfter: startTimestamp(startDate),
        startsBefore: endExclusiveTimestamp(endDate),
        sourceMode,
      });
      if (result.outcome === "created") {
        toast.success(
          `Generated ${result.itemCount} household billing ${
            result.itemCount === 1 ? "bundle" : "bundles"
          }.`,
        );
      } else if (result.outcome === "reuse_draft") {
        toast.info("The existing draft for these sources was reopened.");
      } else if (result.outcome === "already_dispatched") {
        setIncludeDispatched(true);
        toast.info("These sources were already dispatched for this period.");
      } else {
        toast.info("No billable household items were found for this period.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to generate run.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleAddMissing() {
    if (!validPeriod) return;
    setIsAddingMissing(true);
    try {
      const result = await generateMissing({
        periodStart: startDate,
        periodEnd: endDate,
        startsAtOrAfter: startTimestamp(startDate),
        startsBefore: endExclusiveTimestamp(endDate),
        sourceMode,
      });
      if (result.itemCount > 0) {
        toast.success(
          `Added ${result.itemCount} missing household ${
            result.itemCount === 1 ? "bundle" : "bundles"
          }.`,
        );
      } else {
        toast.info(
          result.skippedCount > 0
            ? "Every currently billable household is already represented for these sources."
            : "No billable household items were found for this period.",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to add missing households.",
      );
    } finally {
      setIsAddingMissing(false);
    }
  }

  async function handleDispatch() {
    if (!dispatchRun) return;
    const itemIds = dispatchRun.items
      .filter(
        (item) =>
          item.status !== "dispatched" &&
          !item.requiresAdminReview &&
          selectedIds.has(item._id),
      )
      .map((item) => item._id);
    if (itemIds.length === 0) return;
    setIsDispatching(true);
    try {
      const result = await dispatchItems({
        billingRunId: dispatchRun._id,
        billingRunItemIds: itemIds,
      });
      if (result.dispatchedCount > 0) {
        toast.success(
          `Created ${result.dispatchedCount} Stripe draft ${
            result.dispatchedCount === 1 ? "invoice" : "invoices"
          }.`,
        );
      }
      if (result.failedCount > 0) {
        toast.error(
          `${result.failedCount} household ${
            result.failedCount === 1 ? "invoice" : "invoices"
          } could not be created. Review the failed items and retry.`,
        );
      }
      setDispatchRun(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to dispatch items.",
      );
    } finally {
      setIsDispatching(false);
    }
  }

  async function handleRecovery() {
    if (!recoveryRequest) return;
    const billingRunItemIds = recoveryRequest.run.items
      .filter(
        (item) =>
          item.status !== "dispatched" && selectedIds.has(item._id),
      )
      .map((item) => item._id);
    if (billingRunItemIds.length === 0) return;
    setIsRecovering(true);
    try {
      const result =
        recoveryRequest.type === "regenerate"
          ? await regenerateItems({ billingRunItemIds })
          : await deleteItems({ billingRunItemIds });
      const successCount =
        "regeneratedCount" in result
          ? result.regeneratedCount
          : result.deletedCount;
      if (successCount > 0) {
        toast.success(
          `${recoveryRequest.type === "regenerate" ? "Regenerated" : "Deleted"} ${successCount} billing ${
            successCount === 1 ? "item" : "items"
          }.`,
        );
      }
      if (result.failedCount > 0) {
        const firstFailure = result.results.find(
          (row: { status: string; reason?: string }) =>
            row.status === "failed",
        );
        toast.error(
          `${result.failedCount} ${
            result.failedCount === 1 ? "item was" : "items were"
          } not recovered. ${firstFailure?.reason || "Review the affected items."}`,
        );
      }
      setRecoveryErrors((current) => {
        const next = new Map(current);
        for (const itemId of billingRunItemIds) next.delete(itemId);
        for (const row of result.results as Array<{
          billingRunItemId: BillingRunItem["_id"];
          status: string;
          reason?: string;
        }>) {
          if (row.status === "failed") {
            next.set(row.billingRunItemId, row.reason || "Recovery failed.");
          }
        }
        return next;
      });
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const itemId of billingRunItemIds) next.delete(itemId);
        return next;
      });
      setRecoveryRequest(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to recover items.",
      );
    } finally {
      setIsRecovering(false);
    }
  }

  function openItemNote(item: BillingRunItem) {
    setNoteItem(item);
    setNoteValue(item.adminNote || "");
  }

  async function handleSaveItemNote(event: FormEvent) {
    event.preventDefault();
    if (!noteItem) return;
    setIsSavingNote(true);
    try {
      await updateItemNote({
        billingRunItemId: noteItem._id,
        note: noteValue,
      });
      toast.success("Billing note updated.");
      setNoteItem(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save note.",
      );
    } finally {
      setIsSavingNote(false);
    }
  }

  function openAdjustment(item: BillingRunItem, adjustment?: RunAdjustment) {
    setAdjustmentItem(item);
    setEditingAdjustment(adjustment || null);
    setAdjustmentValues(adjustmentForm(adjustment));
  }

  async function handleSaveAdjustment(event: FormEvent) {
    event.preventDefault();
    if (!adjustmentItem) return;
    const amount =
      adjustmentValues.calculationType === "fixed_cents"
        ? parseCurrencyToCents(adjustmentValues.amount)
        : parsePercentToBasisPoints(adjustmentValues.amount);
    if (amount === null || amount <= 0) {
      toast.error("Enter a valid positive adjustment amount.");
      return;
    }
    setIsSavingAdjustment(true);
    try {
      if (editingAdjustment) {
        await updateAdjustment({
          billingAdjustmentId: editingAdjustment._id,
          kind: adjustmentValues.kind,
          calculationType: adjustmentValues.calculationType,
          amount,
          reasonCode: adjustmentValues.reasonCode,
          note: adjustmentValues.note || undefined,
        });
      } else {
        await createAdjustment({
          scopeType: "billing_run_item",
          scopeId: adjustmentItem._id,
          periodStart: adjustmentItem.periodStart,
          periodEnd: adjustmentItem.periodEnd,
          kind: adjustmentValues.kind,
          calculationType: adjustmentValues.calculationType,
          amount,
          reasonCode: adjustmentValues.reasonCode,
          note: adjustmentValues.note || undefined,
        });
      }
      toast.success(
        editingAdjustment ? "Adjustment updated." : "Adjustment added.",
      );
      setAdjustmentItem(null);
      setEditingAdjustment(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save adjustment.",
      );
    } finally {
      setIsSavingAdjustment(false);
    }
  }

  async function handleVoidAdjustment() {
    if (!voidingAdjustment) return;
    setIsVoidingAdjustment(true);
    try {
      await voidAdjustment({
        billingAdjustmentId: voidingAdjustment._id,
      });
      toast.success("Adjustment voided.");
      setVoidingAdjustment(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to void adjustment.",
      );
    } finally {
      setIsVoidingAdjustment(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Runs</h1>
        <p className="text-muted-foreground">
          Freeze reviewed billing into household bundles, make final
          adjustments, and dispatch selected items downstream.
        </p>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Generate billing bundles</CardTitle>
          <CardDescription>
            A generated draft snapshots the current reviewed tuition and charge
            totals. Add missing households later without rebilling households
            already represented for the selected sources.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-end">
          <BillingDateRangePicker
            id="run-period"
            start={startDate}
            end={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />
          <div className="space-y-2">
            <Label htmlFor="run-source">Include</Label>
            <select
              id="run-source"
              value={sourceMode}
              onChange={(event) =>
                setSourceMode(event.target.value as SourceMode)
              }
              className="border-input bg-background lg:max-w-64 h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="tuition">Tuitions</option>
              <option value="charges">Charges</option>
              <option value="both">Tuition and charges</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleGenerate}
              disabled={!validPeriod || isGenerating || isAddingMissing}
            >
              {isGenerating ? <Spinner /> : <ReceiptText />}
              Generate
            </Button>
            <Button
              variant="outline"
              onClick={handleAddMissing}
              disabled={!validPeriod || isGenerating || isAddingMissing}
            >
              {isAddingMissing ? <Spinner /> : <Plus />}
              Add missing households
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Household bundles</h2>
          <p className="text-muted-foreground text-sm">
            {validPeriod
              ? formatPeriod(startDate, endDate)
              : "Choose a valid period"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="run-history"
            checked={includeDispatched}
            onCheckedChange={setIncludeDispatched}
          />
          <Label htmlFor="run-history">Show dispatched</Label>
        </div>
      </div>

      {runs === undefined ? (
        <div className="min-h-40 flex items-center justify-center">
          <Spinner />
        </div>
      ) : runs.length === 0 ? (
        <Card className="rounded-lg">
          <CardContent className="min-h-36 text-muted-foreground flex items-center justify-center text-center">
            No {includeDispatched ? "" : "pending "}billing bundles for this
            period.
          </CardContent>
        </Card>
      ) : (
        runs.map((run) => {
          const selectedPendingCount = run.items.filter(
            (item) => item.status !== "dispatched" && selectedIds.has(item._id),
          ).length;
          const pendingItems = run.items.filter(
            (item) => item.status !== "dispatched",
          );
          const dispatchableItems = run.items.filter(
            (item) => item.status !== "dispatched" && !item.requiresAdminReview,
          );
          const selectedDispatchableCount = dispatchableItems.filter((item) =>
            selectedIds.has(item._id),
          ).length;
          const selectedReviewCount = run.items.filter(
            (item) =>
              item.status !== "dispatched" &&
              item.requiresAdminReview &&
              selectedIds.has(item._id),
          ).length;
          const allSelected =
            pendingItems.length > 0 &&
            selectedPendingCount === pendingItems.length;
          return (
            <Card key={run._id} className="rounded-lg">
              <CardHeader className="gap-3 border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="capitalize">
                      {run.sourceMode === "both"
                        ? "Tuitions and charges"
                        : run.sourceMode}
                    </CardTitle>
                    <CardDescription>
                      {formatPeriod(run.periodStart, run.periodEnd)} ·{" "}
                      {run.items.length} household
                      {run.items.length === 1 ? "" : "s"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        run.status === "dispatched" ? "secondary" : "outline"
                      }
                    >
                      {run.status}
                    </Badge>
                    <span className="text-lg font-semibold">
                      {formatCurrency(run.totalCents)}
                    </span>
                  </div>
                </div>
                {pendingItems.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`select-run-${run._id}`}
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            for (const item of pendingItems) {
                              if (checked) next.add(item._id);
                              else next.delete(item._id);
                            }
                            return next;
                          });
                        }}
                      />
                      <Label htmlFor={`select-run-${run._id}`}>
                        Select all pending ({selectedPendingCount}/
                        {pendingItems.length})
                      </Label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedReviewCount > 0 ? (
                        <span className="text-muted-foreground text-xs">
                          {selectedReviewCount} selected need regeneration
                        </span>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setRecoveryRequest({ type: "regenerate", run })
                        }
                        disabled={selectedPendingCount === 0}
                      >
                        <RefreshCw />
                        Regenerate ({selectedPendingCount})
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setRecoveryRequest({ type: "delete", run })
                        }
                        disabled={selectedPendingCount === 0}
                      >
                        <Trash2 />
                        Delete ({selectedPendingCount})
                      </Button>
                      <Button
                        onClick={() => setDispatchRun(run)}
                        disabled={selectedDispatchableCount === 0}
                      >
                        <Send />
                        Dispatch ({selectedDispatchableCount})
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="divide-y p-0">
                {run.items.map((item) => (
                  <div
                    key={item._id}
                    className="grid gap-4 p-4 lg:grid-cols-[auto_minmax(180px,1fr)_minmax(320px,1.5fr)_auto] lg:items-start"
                  >
                    <Checkbox
                      aria-label={`Include ${item.householdName}`}
                      checked={
                        item.status !== "dispatched" &&
                        selectedIds.has(item._id)
                      }
                      disabled={
                        item.status === "dispatched"
                      }
                      onCheckedChange={(checked) => {
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          if (checked) next.add(item._id);
                          else next.delete(item._id);
                          return next;
                        });
                      }}
                    />
                    <div>
                      <div className="font-medium">{item.householdName}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.includeTuition ? (
                          <Badge variant="outline">Tuition</Badge>
                        ) : null}
                        {item.includeCharges ? (
                          <Badge variant="outline">Charges</Badge>
                        ) : null}
                        {item.status === "dispatched" ? (
                          <Badge variant="secondary">
                            <CheckCircle2 />
                            Dispatched
                          </Badge>
                        ) : null}
                        {item.status === "dispatch_failed" ? (
                          <Badge variant="destructive">
                            <CircleAlert />
                            Dispatch failed
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {item.sourceSummary.tuitionStudentCount} tuition
                        students · {item.sourceSummary.privateChargeCount}{" "}
                        private · {item.sourceSummary.perSessionChargeCount}{" "}
                        per-session
                      </p>
                      {item.sourceSummary.tuitionIncomplete ||
                      item.sourceSummary.unpricedChargeCount > 0 ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                          Incomplete source pricing is present.
                        </p>
                      ) : null}
                      {item.requiresAdminReview ? (
                        <p className="text-destructive mt-1 text-xs">
                          {item.adminReviewReason}
                        </p>
                      ) : null}
                      {item.dispatchFailureReason ? (
                        <p className="text-destructive mt-2 text-xs">
                          {item.dispatchFailureReason}
                        </p>
                      ) : null}
                      {recoveryErrors.get(item._id) ? (
                        <p className="text-destructive mt-2 text-xs">
                          Recovery: {recoveryErrors.get(item._id)}
                        </p>
                      ) : null}
                      {item.stripeInvoiceId ? (
                        <p className="text-muted-foreground mt-2 font-mono text-xs">
                          {item.stripeInvoiceId}
                        </p>
                      ) : null}
                      {item.collectionMethod ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {item.collectionMethod === "charge_automatically"
                            ? "Automatic collection"
                            : "Invoice by email"}
                        </p>
                      ) : null}
                      <div className="mt-3 border-t pt-3">
                        {item.adminNote ? (
                          <p className="text-muted-foreground whitespace-pre-wrap text-xs">
                            {item.adminNote}
                          </p>
                        ) : (
                          <p className="text-muted-foreground text-xs">
                            No internal billing note.
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-1 h-7 px-2"
                          onClick={() => openItemNote(item)}
                        >
                          <FilePenLine />
                          {item.adminNote ? "Edit note" : "Add note"}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {item.sourceAdjustments.length > 0 ? (
                        <div className="space-y-1 border-b pb-3">
                          <span className="text-sm font-medium">
                            Student adjustments
                          </span>
                          {item.sourceAdjustments.map((adjustment) => (
                            <div
                              key={`${adjustment.adjustmentId}-${adjustment.scopeType}`}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>
                                {adjustment.studentName} ·{" "}
                                {reasonLabels[adjustment.reasonCode]}
                              </span>
                              <span>
                                {adjustment.applicable
                                  ? formatCurrency(adjustment.amountCents)
                                  : "No applicable subtotal"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          Final adjustments
                        </span>
                        {item.status !== "dispatched" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAdjustment(item)}
                          >
                            <Plus />
                            Add
                          </Button>
                        ) : null}
                      </div>
                      {item.adjustments.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                          No run-stage adjustments.
                        </p>
                      ) : (
                        item.adjustments.map((adjustment) => (
                          <div
                            key={adjustment._id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <div>
                              <span
                                className={
                                  adjustment.status === "voided"
                                    ? "text-muted-foreground line-through"
                                    : ""
                                }
                              >
                                {reasonLabels[adjustment.reasonCode]}
                              </span>
                              {adjustment.note ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {adjustment.note}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1">
                              <span>
                                {adjustment.status === "active"
                                  ? formatCurrency(
                                      adjustment.appliedAmountCents || 0,
                                    )
                                  : "Voided"}
                              </span>
                              {item.status !== "dispatched" &&
                              adjustment.status === "active" ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-8"
                                    title="Edit adjustment"
                                    onClick={() =>
                                      openAdjustment(item, adjustment)
                                    }
                                  >
                                    <Pencil />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-8"
                                    title="Void adjustment"
                                    onClick={() =>
                                      setVoidingAdjustment(adjustment)
                                    }
                                  >
                                    <Ban />
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="min-w-52 space-y-1 text-sm lg:text-right">
                      {item.includeTuition ? (
                        <div className="flex justify-between gap-6">
                          <span className="text-muted-foreground">Tuition</span>
                          <span>
                            {formatCurrency(item.tuitionSubtotalCents)}
                          </span>
                        </div>
                      ) : null}
                      {item.includeCharges ? (
                        <div className="flex justify-between gap-6">
                          <span className="text-muted-foreground">Charges</span>
                          <span>
                            {formatCurrency(item.chargesSubtotalCents)}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-6">
                        <span className="text-muted-foreground">
                          All adjustments
                        </span>
                        <span>{formatCurrency(item.adjustmentTotalCents)}</span>
                      </div>
                      <div className="flex justify-between gap-6 border-t pt-2 text-base font-semibold">
                        <span>Final total</span>
                        <span>{formatCurrency(item.finalTotalCents)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog
        open={noteItem !== null}
        onOpenChange={(open) => {
          if (!open) setNoteItem(null);
        }}
      >
        <DialogContent>
          <form onSubmit={handleSaveItemNote}>
            <DialogHeader>
              <DialogTitle>Internal billing note</DialogTitle>
              <DialogDescription>
                Record manual Stripe invoices or other billing follow-up for{" "}
                {noteItem?.householdName}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={noteValue}
                onChange={(event) => setNoteValue(event.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="Example: Additional September class invoiced manually in Stripe..."
              />
              <p className="text-muted-foreground mt-2 text-xs">
                {noteValue.length}/2000
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNoteItem(null)}
                disabled={isSavingNote}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingNote}>
                {isSavingNote ? <Spinner /> : <FilePenLine />}
                Save note
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adjustmentItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustmentItem(null);
            setEditingAdjustment(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleSaveAdjustment}>
            <DialogHeader>
              <DialogTitle>
                {editingAdjustment ? "Edit" : "Add"} final adjustment
              </DialogTitle>
              <DialogDescription>
                {adjustmentItem?.householdName}. Percentage adjustments use the
                combined reviewed tuition and charges subtotal.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="run-adjustment-kind">Type</Label>
                <select
                  id="run-adjustment-kind"
                  value={adjustmentValues.kind}
                  onChange={(event) =>
                    setAdjustmentValues((current) => ({
                      ...current,
                      kind: event.target.value as AdjustmentForm["kind"],
                    }))
                  }
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="discount">Discount</option>
                  <option value="surcharge">Surcharge</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-adjustment-calculation">Calculation</Label>
                <select
                  id="run-adjustment-calculation"
                  value={adjustmentValues.calculationType}
                  onChange={(event) =>
                    setAdjustmentValues((current) => ({
                      ...current,
                      calculationType: event.target
                        .value as AdjustmentForm["calculationType"],
                    }))
                  }
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="fixed_cents">Fixed amount</option>
                  <option value="percent">Percent</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-adjustment-amount">
                  {adjustmentValues.calculationType === "fixed_cents"
                    ? "Amount"
                    : "Percent"}
                </Label>
                <Input
                  id="run-adjustment-amount"
                  inputMode="decimal"
                  placeholder={
                    adjustmentValues.calculationType === "fixed_cents"
                      ? "25.00"
                      : "10"
                  }
                  value={adjustmentValues.amount}
                  onChange={(event) =>
                    setAdjustmentValues((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-adjustment-reason">Reason</Label>
                <select
                  id="run-adjustment-reason"
                  value={adjustmentValues.reasonCode}
                  onChange={(event) =>
                    setAdjustmentValues((current) => ({
                      ...current,
                      reasonCode: event.target
                        .value as AdjustmentForm["reasonCode"],
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
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="run-adjustment-note">Note</Label>
                <Textarea
                  id="run-adjustment-note"
                  value={adjustmentValues.note}
                  onChange={(event) =>
                    setAdjustmentValues((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Why this final adjustment is needed"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustmentItem(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingAdjustment}>
                {isSavingAdjustment ? <Spinner /> : null}
                Save adjustment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={recoveryRequest !== null}
        onOpenChange={(open) => {
          if (!open) setRecoveryRequest(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {recoveryRequest?.type === "delete"
                ? "Delete selected billing items?"
                : "Regenerate selected billing items?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {recoveryRequest?.type === "delete"
                ? "Pending items and their final adjustments will be deleted. Use Add missing households afterward to rebuild currently billable items."
                : "Current authoritative tuition and charges will replace the selected snapshots. Final run adjustments and item IDs will be preserved."}{" "}
              Any linked Stripe invoice must still be a draft; it will be
              discarded before recovery.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRecovering}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRecovering}
              onClick={handleRecovery}
              className={
                recoveryRequest?.type === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {isRecovering ? (
                <Spinner />
              ) : recoveryRequest?.type === "delete" ? (
                <Trash2 />
              ) : (
                <RefreshCw />
              )}
              {recoveryRequest?.type === "delete"
                ? "Delete items"
                : "Regenerate items"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={dispatchRun !== null}
        onOpenChange={(open) => {
          if (!open) setDispatchRun(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dispatch selected households?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates one Stripe draft invoice for each selected household.
              Successful items become dispatched; failures remain available to
              review and retry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDispatching}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDispatching}
              onClick={handleDispatch}
            >
              {isDispatching ? <Spinner /> : <Send />}
              Create draft invoices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={voidingAdjustment !== null}
        onOpenChange={(open) => {
          if (!open) setVoidingAdjustment(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this adjustment?</AlertDialogTitle>
            <AlertDialogDescription>
              It will remain in the audit history but stop affecting the run
              total.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVoidingAdjustment}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isVoidingAdjustment}
              onClick={handleVoidAdjustment}
            >
              {isVoidingAdjustment ? <Spinner /> : <Ban />}
              Void adjustment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { History, ReceiptText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BillingDateRangePicker } from "~/components/billing-date-range-picker";
import { BillingCoverageBadge } from "~/components/billing-coverage-controls";
import { DataTable } from "~/components/data-table";
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
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/admin/billing/audit")({
  component: BillingAuditPage,
});

type BillingAudit = FunctionReturnType<typeof api.billing.adminBillingAudit>;
type AuditHousehold = BillingAudit["households"][number];
type AuditRecord = AuditHousehold["records"][number];

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

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

const columns: ColumnDef<AuditHousehold>[] = [
  {
    accessorKey: "householdName",
    header: "Household",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.householdName}</div>
        <div className="text-xs text-muted-foreground">
          {row.original.expectedEnrollments.length} current tuition enrollment
          {row.original.expectedEnrollments.length === 1 ? "" : "s"}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Coverage",
    cell: ({ row }) => <BillingCoverageBadge status={row.original.status} />,
    filterFn: (row, _columnId, value) =>
      value === "all" || row.original.status === value,
  },
  {
    id: "obligations",
    header: "Current obligations",
    cell: ({ row }) => (
      <div className="space-y-1 text-sm">
        {row.original.expectedEnrollments.length === 0 ? (
          <span className="text-muted-foreground">No current obligations</span>
        ) : (
          row.original.expectedEnrollments.map((enrollment) => (
            <div key={enrollment.enrollmentId}>
              {enrollment.studentName} · {enrollment.classTitle || "Unknown class"}
            </div>
          ))
        )}
      </div>
    ),
  },
  {
    id: "records",
    header: "Billing records",
    cell: ({ row }) => (
      <div className="min-w-64 space-y-3">
        {row.original.records.length === 0 ? (
          <span className="text-sm text-muted-foreground">No billing records</span>
        ) : (
          row.original.records.map((record) => (
            <AuditRecordRow key={record._id} record={record} />
          ))
        )}
      </div>
    ),
  },
  {
    accessorKey: "activeTuitionAmountCents",
    header: "Recorded tuition",
    cell: ({ row }) => formatCurrency(row.original.activeTuitionAmountCents),
  },
];

function BillingAuditPage() {
  const defaults = periodDefaults();
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);
  const [backfilling, setBackfilling] = useState(false);
  const validPeriod = !!periodStart && !!periodEnd && periodEnd >= periodStart;
  const audit = useConvexQuery(
    api.billing.adminBillingAudit,
    validPeriod ? { periodStart, periodEnd } : "skip",
  );
  const backfill = useConvexMutation(api.billing.adminBackfillBillingAuditRecords);

  async function runBackfill() {
    if (backfilling) return;
    setBackfilling(true);
    let cursor: string | null = null;
    let createdCount = 0;
    try {
      do {
        const result: {
          continueCursor: string;
          isDone: boolean;
          createdCount: number;
          skippedCount: number;
        } = await backfill({
          paginationOpts: { numItems: 50, cursor },
        });
        createdCount += result.createdCount;
        cursor = result.isDone ? null : result.continueCursor;
        if (result.isDone) break;
      } while (cursor);
      toast.success(
        createdCount > 0
          ? `Backfilled ${createdCount} dispatched tuition record${createdCount === 1 ? "" : "s"}.`
          : "Billing audit is already up to date.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to backfill billing audit.",
      );
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Billing audit</h1>
            <p className="text-muted-foreground">
              Compare current tuition obligations with recorded Stripe billing.
            </p>
          </div>
          <Button variant="outline" disabled={backfilling} onClick={() => void runBackfill()}>
            {backfilling ? <Spinner /> : <History />}
            {backfilling ? "Backfilling..." : "Backfill dispatched runs"}
          </Button>
        </div>

        <div className="rounded-md border p-4">
          <BillingDateRangePicker
            id="billing-audit-period"
            start={periodStart}
            end={periodEnd}
            onChange={(start, end) => {
              setPeriodStart(start);
              setPeriodEnd(end);
            }}
          />
          {!validPeriod ? (
            <p className="mt-2 text-sm text-destructive">
              End date must be on or after start date.
            </p>
          ) : null}
        </div>

        {audit === undefined ? (
          <div className="flex min-h-48 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
              <AuditStat label="Billed" value={audit.summary.billed} />
              <AuditStat label="Partially covered" value={audit.summary.partiallyCovered} />
              <AuditStat label="Not billed" value={audit.summary.notBilled} />
              <AuditStat label="Needs review" value={audit.summary.needsReview} />
            </div>
            <DataTable
              columns={columns}
              data={audit.households}
              filterColumn="householdName"
              filterPlaceholder="Filter households..."
            />
            <p className="text-sm text-muted-foreground">
              Create exceptional invoices in Stripe, then record their coverage from the corresponding household on the{" "}
              <Link to="/admin/billing/tuitions" className="font-medium text-foreground hover:underline">
                Tuitions page
              </Link>
              .
            </p>
          </>
        )}
      </main>
    </RoleGate>
  );
}

function AuditStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function AuditRecordRow({ record }: { record: AuditRecord }) {
  return (
    <div className="border-b pb-3 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <ReceiptText className="size-4 text-muted-foreground" />
        <span className="font-mono text-xs">{record.stripeInvoiceId}</span>
        <Badge variant="outline">
          {record.source === "billing_run_dispatch" ? "Billing run" : "Manual"}
        </Badge>
        {record.status === "voided" ? <Badge variant="secondary">Voided</Badge> : null}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {formatCurrency(record.tuitionAmountCents)} tuition
        {record.invoiceTotalCents !== record.tuitionAmountCents
          ? ` of ${formatCurrency(record.invoiceTotalCents)} total`
          : ""}
        {" · "}
        {record.attributionQuality.replaceAll("_", " ")} attribution
        {" · "}
        {new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(record.recordedAt)}
      </div>
      {record.note ? <p className="mt-1 whitespace-pre-wrap text-sm">{record.note}</p> : null}
      {record.source === "manual_stripe" && record.status === "active" ? (
        <VoidExternalRecordButton record={record} />
      ) : null}
    </div>
  );
}

function VoidExternalRecordButton({ record }: { record: AuditRecord }) {
  const voidRecord = useConvexMutation(api.billing.adminVoidExternalTuitionBilling);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(next) => !working && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-1 px-2" disabled={working}>
          Void record
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void this billing record?</AlertDialogTitle>
          <AlertDialogDescription>
            The record will remain in history but will no longer count as tuition coverage. This does not change the Stripe invoice.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={working}
            onClick={async (event) => {
              event.preventDefault();
              setWorking(true);
              try {
                await voidRecord({ billingAuditRecordId: record._id });
                toast.success("External billing record voided.");
                setOpen(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to void record.");
              } finally {
                setWorking(false);
              }
            }}
          >
            {working ? "Voiding..." : "Void record"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useConvexMutation } from "@convex-dev/react-query";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { ReceiptText } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { BillingCoverageStatus } from "../../shared/billing-audit";
import { parseCurrencyToCents } from "../../shared/tuition-pricing";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

export const billingCoverageLabels: Record<BillingCoverageStatus, string> = {
  billed: "Billed",
  partially_covered: "Partially covered",
  not_billed: "Not billed",
  needs_review: "Needs review",
};

export function BillingCoverageBadge({
  status,
}: {
  status: BillingCoverageStatus;
}) {
  return (
    <Badge
      variant={
        status === "billed"
          ? "default"
          : status === "not_billed"
            ? "destructive"
            : "secondary"
      }
    >
      {billingCoverageLabels[status]}
    </Badge>
  );
}

export type ExternalBillingEnrollment = {
  enrollmentId: string;
  studentName: string;
  classTitle?: string;
};

export function RecordExternalBillingDialog({
  householdId,
  householdName,
  periodStart,
  periodEnd,
  enrollments,
  triggerClassName,
}: {
  householdId: string;
  householdName: string;
  periodStart: string;
  periodEnd: string;
  enrollments: ExternalBillingEnrollment[];
  triggerClassName?: string;
}) {
  const recordBilling = useConvexMutation(
    api.billing.adminRecordExternalTuitionBilling,
  );
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInvoiceId("");
    setAmount("");
    setNote("");
    setSelectedIds(new Set(enrollments.map((row) => row.enrollmentId)));
  }, [enrollments, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const amountCents = parseCurrencyToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      toast.error("Enter a positive external billing amount.");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Select at least one covered enrollment.");
      return;
    }
    setSaving(true);
    try {
      await recordBilling({
        householdId,
        periodStart,
        periodEnd,
        stripeInvoiceId: invoiceId,
        amountCents,
        enrollmentIds: [...selectedIds] as Id<"classEnrollments">[],
        note: note.trim() || undefined,
      });
      toast.success("External Stripe billing recorded.");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to record external billing.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={triggerClassName}
          disabled={enrollments.length === 0}
        >
          <ReceiptText />
          Record external billing
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Record external Stripe billing</DialogTitle>
            <DialogDescription>
              Record a tuition invoice created manually in Stripe for {householdName}.
              This does not contact Stripe or collect payment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`stripe-invoice-${householdId}`}>Stripe invoice ID</Label>
              <Input
                id={`stripe-invoice-${householdId}`}
                value={invoiceId}
                onChange={(event) => setInvoiceId(event.target.value)}
                placeholder="in_..."
                maxLength={200}
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`external-amount-${householdId}`}>Tuition amount</Label>
              <Input
                id={`external-amount-${householdId}`}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                required
                disabled={saving}
              />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Covered enrollments</legend>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
              {enrollments.map((enrollment) => {
                const checked = selectedIds.has(enrollment.enrollmentId);
                return (
                  <label
                    key={enrollment.enrollmentId}
                    className="flex cursor-pointer items-start gap-3 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={saving}
                      onCheckedChange={(value) => {
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          if (value) next.add(enrollment.enrollmentId);
                          else next.delete(enrollment.enrollmentId);
                          return next;
                        });
                      }}
                    />
                    <span>
                      <span className="block font-medium">{enrollment.studentName}</span>
                      <span className="block text-muted-foreground">
                        {enrollment.classTitle || "Unknown class"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor={`external-note-${householdId}`}>Internal note</Label>
            <Textarea
              id={`external-note-${householdId}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Reason for the one-off invoice or other follow-up context..."
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Recording..." : "Record billing"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

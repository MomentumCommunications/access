import {
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Ban, CalendarRange, Pencil, Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  formatPercentFromBasisPoints,
  parseCurrencyToCents,
  parsePercentToBasisPoints,
} from "../../../../shared/tuition-pricing";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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

export const Route = createFileRoute("/_app/admin/billing/adjustments")({
  component: AdjustmentsPage,
});

type AdjustmentData = FunctionReturnType<
  typeof api.billing.adminListBillingAdjustments
>;
type Adjustment = AdjustmentData["adjustments"][number];
type TargetType = "student_tuition" | "student_private_charges";
type AdjustmentForm = {
  scopeType: TargetType;
  scopeId: string;
  periodStart: string;
  periodEnd: string;
  kind: "discount" | "surcharge";
  calculationType: "fixed_cents" | "percent";
  amount: string;
  reasonCode:
    | "scholarship"
    | "goodwill"
    | "manual_correction"
    | "waiver"
    | "surcharge"
    | "other";
  note: string;
};

const emptyForm: AdjustmentForm = {
  scopeType: "student_tuition",
  scopeId: "",
  periodStart: "",
  periodEnd: "",
  kind: "discount",
  calculationType: "fixed_cents",
  amount: "",
  reasonCode: "scholarship",
  note: "",
};

const targetLabels: Record<TargetType, string> = {
  student_tuition: "Student tuition",
  student_private_charges: "Student private charges",
};

const reasonLabels = {
  scholarship: "Scholarship",
  goodwill: "Goodwill",
  manual_correction: "Manual correction",
  waiver: "Waiver",
  surcharge: "Surcharge",
  other: "Other",
} as const;

function formForAdjustment(adjustment: Adjustment): AdjustmentForm {
  return {
    scopeType: adjustment.scopeType as TargetType,
    scopeId: adjustment.scopeId,
    periodStart: adjustment.periodStart,
    periodEnd: adjustment.periodEnd,
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

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function AdjustmentsPage() {
  return (
    <RoleGate allow="admin">
      <AdjustmentsAdminPage />
    </RoleGate>
  );
}

function AdjustmentsAdminPage() {
  const data = useConvexQuery(api.billing.adminListBillingAdjustments, {});
  const createAdjustment = useConvexMutation(
    api.billing.adminCreateBillingAdjustment,
  );
  const updateAdjustment = useConvexMutation(
    api.billing.adminUpdateBillingAdjustment,
  );
  const voidAdjustment = useConvexMutation(
    api.billing.adminVoidBillingAdjustment,
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [targetFilter, setTargetFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Adjustment | null>(null);
  const [voiding, setVoiding] = useState<Adjustment | null>(null);
  const [form, setForm] = useState<AdjustmentForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (
      data?.adjustments.filter((adjustment) => {
        if (
          adjustment.scopeType !== "student_tuition" &&
          adjustment.scopeType !== "student_private_charges"
        ) {
          return false;
        }
        if (statusFilter !== "all" && adjustment.status !== statusFilter) {
          return false;
        }
        if (targetFilter !== "all" && adjustment.scopeType !== targetFilter) {
          return false;
        }
        return (
          !needle ||
          adjustment.targetName.toLowerCase().includes(needle) ||
          adjustment.note?.toLowerCase().includes(needle) ||
          reasonLabels[adjustment.reasonCode].toLowerCase().includes(needle)
        );
      }) || []
    );
  }, [data?.adjustments, search, statusFilter, targetFilter]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      scopeId: data?.students[0]?._id || "",
    });
    setDialogOpen(true);
  }

  function openEdit(adjustment: Adjustment) {
    setEditing(adjustment);
    setForm(formForAdjustment(adjustment));
    setDialogOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const amount =
      form.calculationType === "fixed_cents"
        ? parseCurrencyToCents(form.amount)
        : parsePercentToBasisPoints(form.amount);
    if (amount === null || amount <= 0) {
      toast.error("Enter a valid positive adjustment amount.");
      return;
    }
    if (!editing && (!form.scopeId || !form.periodStart || !form.periodEnd)) {
      toast.error("Choose a student and effective date range.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateAdjustment({
          billingAdjustmentId: editing._id,
          kind: form.kind,
          calculationType: form.calculationType,
          amount,
          reasonCode: form.reasonCode,
          note: form.note || undefined,
        });
        toast.success("Billing adjustment updated.");
      } else {
        await createAdjustment({
          scopeType: form.scopeType,
          scopeId: form.scopeId,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          kind: form.kind,
          calculationType: form.calculationType,
          amount,
          reasonCode: form.reasonCode,
          note: form.note || undefined,
        });
        toast.success("Billing adjustment created.");
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The billing adjustment could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmVoid() {
    if (!voiding) return;
    setIsVoiding(true);
    try {
      await voidAdjustment({ billingAdjustmentId: voiding._id });
      toast.success("Billing adjustment voided.");
      setVoiding(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The billing adjustment could not be voided.",
      );
    } finally {
      setIsVoiding(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing Adjustments</h1>
          <p className="text-muted-foreground">
            Schedule recurring student tuition and private-charge adjustments.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!data?.students.length}>
          <Plus />
          Add adjustment
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_12rem_14rem]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student, reason, or note"
            aria-label="Search adjustments"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Adjustment status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="voided">Voided</SelectItem>
            </SelectContent>
          </Select>
          <Select value={targetFilter} onValueChange={setTargetFilter}>
            <SelectTrigger aria-label="Adjustment target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All targets</SelectItem>
              <SelectItem value="student_tuition">Student tuition</SelectItem>
              <SelectItem value="student_private_charges">
                Student private charges
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {data === undefined ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No matching adjustments</CardTitle>
            <CardDescription>
              Create an adjustment or change the current filters.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[1050px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Effective dates</TableHead>
                  <TableHead>Adjustment</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>History</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((adjustment) => (
                  <TableRow key={adjustment._id}>
                    <TableCell className="font-medium">
                      {adjustment.targetName}
                    </TableCell>
                    <TableCell>
                      {targetLabels[adjustment.scopeType as TargetType]}
                    </TableCell>
                    <TableCell>
                      {adjustment.periodStart} – {adjustment.periodEnd}
                    </TableCell>
                    <TableCell>
                      {adjustment.kind === "discount" ? "−" : "+"}
                      {adjustment.calculationType === "fixed_cents"
                        ? formatCurrency(adjustment.amount)
                        : `${formatPercentFromBasisPoints(adjustment.amount)}%`}
                    </TableCell>
                    <TableCell>
                      <div>{reasonLabels[adjustment.reasonCode]}</div>
                      {adjustment.note ? (
                        <div className="max-w-56 truncate text-xs text-muted-foreground">
                          {adjustment.note}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {adjustment.history.length === 0 ? (
                        <span className="text-muted-foreground">
                          Not used yet
                        </span>
                      ) : (
                        <div className="space-y-1 text-xs">
                          {adjustment.history.slice(0, 3).map((entry) => (
                            <div key={entry.billingRunItemId}>
                              {entry.periodStart} ·{" "}
                              {entry.applicable
                                ? formatCurrency(entry.amountCents)
                                : "No applicable subtotal"}
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          adjustment.status === "active"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {adjustment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {adjustment.canEdit ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit adjustment"
                            onClick={() => openEdit(adjustment)}
                          >
                            <Pencil />
                          </Button>
                        ) : null}
                        {adjustment.status === "active" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Void adjustment"
                            onClick={() => setVoiding(adjustment)}
                          >
                            <Ban />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit adjustment" : "Add billing adjustment"}
              </DialogTitle>
              <DialogDescription>
                Fixed amounts apply once per overlapping billing period.
                Percentage adjustments use the student&apos;s original subtotal.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Target</Label>
                <Select
                  value={form.scopeType}
                  disabled={!!editing}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      scopeType: value as TargetType,
                    }))
                  }
                >
                  <SelectTrigger aria-label="Target type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student_tuition">
                      Student tuition
                    </SelectItem>
                    <SelectItem value="student_private_charges">
                      Student private charges
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Student</Label>
                <Select
                  value={form.scopeId}
                  disabled={!!editing}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      scopeId: value,
                    }))
                  }
                >
                  <SelectTrigger aria-label="Student">
                    <SelectValue placeholder="Choose a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.students.map((student) => (
                      <SelectItem key={student._id} value={student._id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="adjustment-start">Effective start</Label>
                  <Input
                    id="adjustment-start"
                    type="date"
                    disabled={!!editing}
                    value={form.periodStart}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        periodStart: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="adjustment-end">Effective end</Label>
                  <Input
                    id="adjustment-end"
                    type="date"
                    min={form.periodStart}
                    disabled={!!editing}
                    value={form.periodEnd}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        periodEnd: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select
                    value={form.kind}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        kind: value as AdjustmentForm["kind"],
                      }))
                    }
                  >
                    <SelectTrigger aria-label="Adjustment kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discount">Discount</SelectItem>
                      <SelectItem value="surcharge">Surcharge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Calculation</Label>
                  <Select
                    value={form.calculationType}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        calculationType:
                          value as AdjustmentForm["calculationType"],
                        amount: "",
                      }))
                    }
                  >
                    <SelectTrigger aria-label="Calculation type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_cents">
                        Fixed amount
                      </SelectItem>
                      <SelectItem value="percent">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adjustment-amount">
                  {form.calculationType === "fixed_cents"
                    ? "Amount"
                    : "Percent"}
                </Label>
                <Input
                  id="adjustment-amount"
                  inputMode="decimal"
                  placeholder={
                    form.calculationType === "fixed_cents" ? "25.00" : "10"
                  }
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Reason</Label>
                <Select
                  value={form.reasonCode}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      reasonCode:
                        value as AdjustmentForm["reasonCode"],
                    }))
                  }
                >
                  <SelectTrigger aria-label="Reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(reasonLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adjustment-note">Note</Label>
                <Textarea
                  id="adjustment-note"
                  maxLength={1000}
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Why this adjustment applies"
                />
              </div>
              {editing?.hasDispatchedUsage ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  This adjustment has dispatched history. Void it and create a
                  replacement to change future terms.
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner /> : <CalendarRange />}
                Save adjustment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={voiding !== null}
        onOpenChange={(open) => {
          if (!open) setVoiding(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this billing adjustment?</AlertDialogTitle>
            <AlertDialogDescription>
              It will stop applying to future and draft billing runs.
              Dispatched billing history will not change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVoiding}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isVoiding}
              onClick={confirmVoid}
            >
              {isVoiding ? <Spinner /> : <Ban />}
              Void adjustment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

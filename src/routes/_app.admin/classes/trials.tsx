import {
  useConvexAction,
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Check, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { getAccountName } from "~/lib/account-name";
import { formatMDYYYY, formatTimeRange } from "~/lib/date-utils";
import {
  formatCurrencyFromCents,
  parseCurrencyToCents,
} from "../../../../shared/tuition-pricing";

export const Route = createFileRoute("/_app/admin/classes/trials")({
  component: AdminTrialsPage,
});

type TrialStatus = "pending" | "approved" | "rejected" | "cancelled";
type TrialRow = FunctionReturnType<typeof api.trials.adminList>[number];

function AdminTrialsPage() {
  const [status, setStatus] = useState<TrialStatus | "all">("pending");
  const trials = useConvexQuery(api.trials.adminList, {
    status: status === "all" ? undefined : status,
  });
  const approveTrial = useConvexAction(api.stripe.adminApproveTrial);
  const review = useConvexMutation(api.trials.adminReview);
  const [approveRow, setApproveRow] = useState<TrialRow | null>(null);
  const [rejectRow, setRejectRow] = useState<TrialRow | null>(null);
  const [price, setPrice] = useState("");
  const [working, setWorking] = useState(false);
  const preparingExistingInvoice =
    approveRow?.request.status === "approved";

  function openApproval(row: TrialRow) {
    setApproveRow(row);
    setPrice(
      row.request.unitPriceCents !== undefined
        ? formatCurrencyFromCents(row.request.unitPriceCents)
        : row.billing.suggestedPriceCents !== undefined
          ? formatCurrencyFromCents(row.billing.suggestedPriceCents)
          : "",
    );
  }

  async function approve() {
    if (!approveRow || working) return;
    let unitPriceCents: number;
    try {
      const parsedPrice = parseCurrencyToCents(price);
      if (parsedPrice === null || parsedPrice <= 0) {
        throw new Error("Enter a positive trial price.");
      }
      unitPriceCents = parsedPrice;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enter a valid price.");
      return;
    }
    setWorking(true);
    try {
      const result = await approveTrial({
        trialRequestId: approveRow.request._id,
        unitPriceCents,
      });
      toast.success(
        `${preparingExistingInvoice ? "Trial invoice prepared" : "Paid trial approved"}. Stripe draft ${result.stripeInvoiceId} is ready.`,
      );
      setApproveRow(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The trial could not be approved.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function reject() {
    if (!rejectRow || working) return;
    setWorking(true);
    try {
      await review({
        trialRequestId: rejectRow.request._id,
        action: "reject",
      });
      toast.success("Trial request rejected and preserved in history.");
      setRejectRow(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The trial could not be rejected.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Paid Trial Requests</h1>
          <p className="text-muted-foreground">
            Review single-session trial requests and prepare them for billing.
          </p>
        </div>

        <div className="w-full max-w-56 space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as TrialStatus | "all")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {trials === undefined ? (
          <div className="flex min-h-48 items-center justify-center"><Spinner className="size-5" /></div>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-lg border">
            <Table className="min-w-[72rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Requester / household</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Trial date</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trials.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center">No {status === "all" ? "" : `${status} `}trial requests.</TableCell></TableRow>
                ) : trials.map((row) => (
                  <TableRow key={row.request._id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" to="/admin/students/$studentId" params={{ studentId: row.student._id }}>
                        {row.student.preferredName || `${row.student.firstName} ${row.student.lastName}`}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>{getAccountName(row.requester)}</div>
                      <div className="text-xs text-muted-foreground">{row.household?.name || "Missing household"}</div>
                    </TableCell>
                    <TableCell>
                      <Link className="font-medium hover:underline" to="/admin/classes/$classId" params={{ classId: row.classItem._id }}>{row.classItem.title}</Link>
                    </TableCell>
                    <TableCell>
                      <div>{formatMDYYYY(row.session.date)}</div>
                      <div className="text-xs text-muted-foreground">{formatTimeRange(row.session.startTime, row.session.endTime) || "Time TBD"}</div>
                    </TableCell>
                    <TableCell>{new Date(row.request.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={row.request.status === "approved" ? "default" : "secondary"}>{row.request.status}</Badge></TableCell>
                    <TableCell>
                      {row.request.unitPriceCents !== undefined ? (
                        <div>{formatCurrencyFromCents(row.request.unitPriceCents)}</div>
                      ) : null}
                      <div className="text-xs text-muted-foreground">
                        {row.request.stripeInvoiceId
                          ? `Draft ${row.request.stripeInvoiceId}`
                          : !row.billing.hasPrimaryPayer
                          ? "Missing primary payer"
                          : row.billing.stripeCustomerReady
                            ? "Stripe ready"
                            : "Stripe customer will be prepared"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.request.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openApproval(row)}><Check />Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejectRow(row)}><XCircle />Reject</Button>
                        </div>
                      ) : row.request.status === "approved" &&
                        !row.request.stripeInvoiceId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openApproval(row)}
                        >
                          Prepare invoice
                        </Button>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={approveRow !== null} onOpenChange={(open) => !open && !working && setApproveRow(null)}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {preparingExistingInvoice
                ? "Prepare trial invoice"
                : "Approve paid trial"}
            </DialogTitle>
            <DialogDescription>
              {preparingExistingInvoice
                ? "Confirm the trial price to create its missing Stripe draft invoice."
                : "Confirm the single-session trial price. Approval adds the student to attendance and creates a Stripe draft invoice."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="trial-price">Trial price</Label>
            <Input id="trial-price" inputMode="decimal" placeholder="0.00" value={price} onChange={(event) => setPrice(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={working} onClick={() => setApproveRow(null)}>Cancel</Button>
            <Button disabled={working} onClick={() => void approve()}>
              {working
                ? "Preparing billing..."
                : preparingExistingInvoice
                  ? "Prepare invoice"
                  : "Approve trial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={rejectRow !== null} onOpenChange={(open) => !open && !working && setRejectRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this trial request?</AlertDialogTitle>
            <AlertDialogDescription>The request will remain available in trial history with a rejected status.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); void reject(); }}>Reject request</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleGate>
  );
}

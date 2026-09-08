import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { NotebookPen } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { formatMDYYYY, formatTimeRange } from "~/lib/date-utils";

export const Route = createFileRoute("/_app/admin/reports/onboarding")({
  component: AdminOnboardingReportPage,
});

type Report = FunctionReturnType<typeof api.reports.adminOnboardingReport>;
type OnboardingRow = Report["incompleteOnboarding"][number];
type DesertedTrialRow = Report["desertedTrials"][number];

const stepLabels = {
  not_started: "Not started",
  profile: "Profile",
  students: "Students",
  review: "Review",
  contract: "Contract",
} as const;

const reasonLabels = {
  sick: "Sick",
  injured: "Injured",
  homework: "Homework",
  vacation: "Vacation",
  "school-event": "School event",
  "no-ride": "No ride",
} as const;

const onboardingColumns: ColumnDef<OnboardingRow>[] = [
  {
    accessorKey: "name",
    header: "Account",
    cell: ({ row }) => (
      <Link
        to="/admin/accounts/$userId"
        params={{ userId: row.original.userId }}
        className="font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "step",
    header: "Current step",
    cell: ({ row }) => stepLabels[row.original.step],
  },
  {
    id: "contact",
    header: "Contact",
    cell: ({ row }) => (
      <ContactDetails
        email={row.original.email}
        phone={row.original.phone}
      />
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) =>
      row.original.source === "imported"
        ? "Imported"
        : row.original.source === "new"
          ? "New account"
          : "Not set",
  },
  {
    accessorKey: "startedAt",
    header: "Started",
    cell: ({ row }) => new Date(row.original.startedAt).toLocaleDateString(),
  },
];

const trialColumns: ColumnDef<DesertedTrialRow>[] = [
  {
    accessorKey: "studentName",
    header: "Student",
    cell: ({ row }) => (
      <Link
        to="/admin/students/$studentId"
        params={{ studentId: row.original.studentId }}
        className="font-medium hover:underline"
      >
        {row.original.studentName}
      </Link>
    ),
  },
  {
    id: "contact",
    header: "Contact",
    cell: ({ row }) => (
      <div>
        <div>{row.original.requesterName}</div>
        <ContactDetails
          email={row.original.requesterEmail}
          phone={row.original.requesterPhone}
        />
      </div>
    ),
  },
  {
    id: "notes",
    header: "Follow-up notes",
    cell: ({ row }) => <TrialFollowUpNotes row={row.original} />,
  },
  {
    accessorKey: "classTitle",
    header: "Class",
    cell: ({ row }) => (
      <Link
        to="/admin/classes/$classId"
        params={{ classId: row.original.classId }}
        className="font-medium hover:underline"
      >
        {row.original.classTitle}
      </Link>
    ),
  },
  {
    id: "session",
    header: "Trial session",
    cell: ({ row }) => (
      <div>
        <div>
          {row.original.sessionDate
            ? formatMDYYYY(row.original.sessionDate)
            : "Missing session"}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatTimeRange(
            row.original.sessionStartTime,
            row.original.sessionEndTime,
          ) || "Time not set"}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "absenceReason",
    header: "Absence reason",
    cell: ({ row }) =>
      row.original.absenceReason
        ? reasonLabels[row.original.absenceReason]
        : "Not provided",
  },
];

function AdminOnboardingReportPage() {
  const report = useConvexQuery(api.reports.adminOnboardingReport, {});

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Onboarding</h1>
          <p className="text-muted-foreground">
            Find incomplete client onboarding and missed trial follow-ups.
          </p>
        </div>

        {report === undefined ? (
          <div className="flex min-h-80 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Incomplete onboarding ({report.incompleteOnboarding.length})
                </h2>
                <p className="text-sm text-muted-foreground">
                  Client accounts that began onboarding but have not completed
                  it.
                </p>
              </div>
              <StepSummary rows={report.incompleteOnboarding} />
              <DataTable
                columns={onboardingColumns}
                data={report.incompleteOnboarding}
                filterColumn="name"
                filterPlaceholder="Filter accounts..."
              />
            </section>

            <section className="space-y-4 border-t pt-8">
              <div>
                <h2 className="text-xl font-semibold">
                  Missed trial follow-ups ({report.desertedTrials.length})
                </h2>
                <p className="text-sm text-muted-foreground">
                  Approved trials where the expected student was marked absent.
                </p>
              </div>
              <DataTable
                columns={trialColumns}
                data={report.desertedTrials}
                filterColumn="studentName"
                filterPlaceholder="Filter students..."
              />
            </section>
          </>
        )}
      </main>
    </RoleGate>
  );
}

function StepSummary({ rows }: { rows: OnboardingRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-5">
      {Object.entries(stepLabels).map(([step, label]) => (
        <div key={step} className="bg-background px-3 py-3">
          <div className="text-xs font-medium text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {rows.filter((row) => row.step === step).length}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactDetails({ email, phone }: { email?: string; phone?: string }) {
  if (!email && !phone) {
    return <span className="text-muted-foreground">Not provided</span>;
  }
  return (
    <div className="space-y-0.5 text-sm">
      {email ? (
        <a href={`mailto:${email}`} className="block break-all hover:underline">
          {email}
        </a>
      ) : null}
      {phone ? (
        <a href={`tel:${phone}`} className="block hover:underline">
          {phone}
        </a>
      ) : null}
    </div>
  );
}

function TrialFollowUpNotes({ row }: { row: DesertedTrialRow }) {
  const updateNotes = useConvexMutation(
    api.reports.adminUpdateTrialFollowUpNotes,
  );
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(row.followUpNotes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setNotes(row.followUpNotes || "");
  }, [open, row.followUpNotes]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await updateNotes({ trialRequestId: row.trialRequestId, notes });
      toast.success("Follow-up notes saved.");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save notes.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xs space-y-2">
      {row.followUpNotes ? (
        <p className="line-clamp-2 whitespace-pre-wrap text-sm">
          {row.followUpNotes}
        </p>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => !saving && setOpen(nextOpen)}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="max-w-full">
            <NotebookPen />
            <span className="truncate">
              {row.followUpNotes ? "Edit note" : "Add note"}
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Follow-up notes</DialogTitle>
            <DialogDescription>
              Internal notes for {row.studentName}&apos;s missed trial.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            rows={6}
            placeholder="Add call attempts, outcomes, or next steps..."
            disabled={saving}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "Saving..." : "Save note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

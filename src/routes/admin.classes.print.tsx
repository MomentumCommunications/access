import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { formatMDYYYY } from "~/lib/date-utils";

export const Route = createFileRoute("/admin/classes/print")({
  validateSearch: z.object({
    season: z.string().optional(),
    group: z.string().optional(),
    q: z.string().optional(),
  }),
  component: AdminClassRosterPrintPage,
});

type PrintRoster = FunctionReturnType<
  typeof api.classes.adminPrintClassRosters
>[number];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " ");
}

function AdminClassRosterPrintPage() {
  const { season, group, q } = Route.useSearch();
  const rosters = useConvexQuery(api.classes.adminPrintClassRosters, {
    seasonId: season as Id<"seasons"> | undefined,
    group: group as Id<"groups"> | "none" | undefined,
    titleQuery: q,
  });
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const hasOpenedPrintDialog = useRef(false);

  useEffect(() => {
    setGeneratedAt(new Date());
  }, []);

  useEffect(() => {
    if (
      rosters === undefined ||
      rosters.length === 0 ||
      !generatedAt ||
      hasOpenedPrintDialog.current
    ) {
      return;
    }
    hasOpenedPrintDialog.current = true;
    const timeout = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timeout);
  }, [generatedAt, rosters]);

  const generatedLabel = generatedAt
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(generatedAt)
    : "Preparing printout";

  return (
    <RoleGate allow="admin">
      <main className="print-roster-page">
        <div className="print-roster-controls">
          <Button asChild variant="outline">
            <Link to="/admin/classes" search={{ season, group, q }}>
              <ArrowLeft />
              Back to classes
            </Link>
          </Button>
          <Button
            onClick={() => window.print()}
            disabled={!rosters?.length}
          >
            <Printer />
            Print
          </Button>
        </div>

        {rosters === undefined ? (
          <div className="print-roster-loading">
            <Spinner className="size-5" />
            Preparing rosters...
          </div>
        ) : rosters.length === 0 ? (
          <div className="print-roster-empty">
            <h1>No matching classes</h1>
            <p>Change the class filters and try printing again.</p>
          </div>
        ) : (
          <div className="print-roster-document">
            {rosters.map((roster) => (
              <ClassRosterSheet
                key={roster.classItem.id}
                roster={roster}
                generatedLabel={generatedLabel}
              />
            ))}
          </div>
        )}
      </main>
    </RoleGate>
  );
}

function ClassRosterSheet({
  roster,
  generatedLabel,
}: {
  roster: PrintRoster;
  generatedLabel: string;
}) {
  const { classItem } = roster;
  const dateRange = [
    formatMDYYYY(classItem.startDate),
    formatMDYYYY(classItem.endDate),
  ]
    .filter(Boolean)
    .join(" - ");
  return (
    <article className="print-roster-sheet">
      <header className="print-roster-header">
        <div>
          <div className="print-roster-title-row">
            <h1>{classItem.title}</h1>
            <span>{formatStatus(classItem.status)}</span>
          </div>
          <p>Roster generated {generatedLabel}</p>
        </div>
        <dl className="print-roster-details">
          <RosterDetail
            label="Instructor"
            value={roster.instructors.join(", ") || "Not set"}
          />
          <RosterDetail
            label="Schedule"
            value={classItem.scheduleSummary || "Not set"}
          />
          <RosterDetail label="Dates" value={dateRange || "Not set"} />
          <RosterDetail
            label="Location"
            value={classItem.location || "Not set"}
          />
          <RosterDetail label="Roster" value={roster.rosterSummary} />
          <RosterDetail
            label="Signup mode"
            value={
              classItem.enrollmentMode === "per_session"
                ? "Per session"
                : "Standard tuition"
            }
          />
        </dl>
      </header>

      {classItem.enrollmentMode === "per_session" ? (
        <SessionSignupTable rows={roster.sessionSignups} />
      ) : (
        <EnrollmentTable rows={roster.enrollments} />
      )}
      <TrialTable rows={roster.trials} />
    </article>
  );
}

function RosterDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function RosterSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="print-roster-section">
      <h2>
        {title} <span>({count})</span>
      </h2>
      {children}
    </section>
  );
}

function EmptyRosterRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="print-roster-empty-row">
        {children}
      </td>
    </tr>
  );
}

function EnrollmentTable({ rows }: { rows: PrintRoster["enrollments"] }) {
  return (
    <RosterSection title="Active enrollments" count={rows.length}>
      <table className="print-roster-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Status</th>
            <th>Tuition</th>
            <th>Requested by</th>
            <th>Starts</th>
            <th>Ends</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRosterRow colSpan={6}>No active enrollments</EmptyRosterRow>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>{row.studentName}</td>
                <td>{formatStatus(row.status)}</td>
                <td>
                  {row.prorateTuition === false ? "Full period" : "Prorated"}
                </td>
                <td>{row.requestedByName}</td>
                <td>{formatMDYYYY(row.startDate) || "Now"}</td>
                <td>{formatMDYYYY(row.endDate) || "Open"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </RosterSection>
  );
}

function SessionSignupTable({
  rows,
}: {
  rows: PrintRoster["sessionSignups"];
}) {
  return (
    <RosterSection title="Upcoming session signups" count={rows.length}>
      <table className="print-roster-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Session</th>
            <th>Status</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRosterRow colSpan={4}>No upcoming session signups</EmptyRosterRow>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>{row.studentName}</td>
                <td>{formatMDYYYY(row.sessionDate) || "Missing session"}</td>
                <td>{formatStatus(row.status)}</td>
                <td>{formatCurrency(row.unitPriceCents)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </RosterSection>
  );
}

function TrialTable({ rows }: { rows: PrintRoster["trials"] }) {
  return (
    <RosterSection title="Current trials" count={rows.length}>
      <table className="print-roster-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Session date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRosterRow colSpan={3}>No current trials</EmptyRosterRow>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>{row.studentName}</td>
                <td>{formatMDYYYY(row.sessionDate) || "Missing session"}</td>
                <td>{formatStatus(row.status)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </RosterSection>
  );
}

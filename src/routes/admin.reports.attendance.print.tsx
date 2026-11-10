import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AttendanceReportSummary } from "~/components/attendance-report-summary";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useAttendanceReport } from "~/hooks/use-attendance-report";
import { formatMDYYYY } from "~/lib/date-utils";
import {
  formatAttendanceRate,
  parseAttendanceReportSearch,
} from "../../shared/attendance-report";

export const Route = createFileRoute("/admin/reports/attendance/print")({
  validateSearch: parseAttendanceReportSearch,
  component: () => (
    <RoleGate allow="admin">
      <AttendanceReportPrintPage />
    </RoleGate>
  ),
});

function AttendanceReportPrintPage() {
  const search = Route.useSearch();
  const { range, error, options, rows, loading } = useAttendanceReport(search);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const opened = useRef(false);
  useEffect(() => {
    setGeneratedAt(new Date());
  }, []);
  useEffect(() => {
    if (loading || error || !generatedAt || !rows.length || opened.current)
      return;
    const timer = window.setTimeout(() => {
      opened.current = true;
      window.print();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [loading, error, generatedAt, rows]);
  const groupName = !search.group
    ? "All groups"
    : search.group === "none"
      ? "No group"
      : (options?.groups.find((group) => group._id === search.group)?.name ??
        "Unknown group");
  return (
    <main className="print-roster-page attendance-print-page">
      <div className="print-roster-controls">
        <Button asChild variant="outline">
          <Link to="/admin/reports/attendance" search={{ ...search, ...range }}>
            <ArrowLeft />
            Back to report
          </Link>
        </Button>
        <Button
          disabled={loading || !!error || rows.length === 0}
          onClick={() => window.print()}
        >
          <Printer />
          Print
        </Button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : loading ? (
        <div role="status" className="print-roster-loading">
          <Spinner />
          Preparing attendance report...
        </div>
      ) : (
        <article className="attendance-print-sheet">
          <header className="attendance-print-header">
            <h1>Attendance report</h1>
            <p>
              {formatMDYYYY(range.start)} – {formatMDYYYY(range.end)} ·{" "}
              {groupName} · Active students
            </p>
            {search.q?.trim() && <p>Search: {search.q.trim()}</p>}
            <p>
              Generated{" "}
              {generatedAt
                ? new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "America/New_York",
                  }).format(generatedAt)
                : "…"}{" "}
              (Eastern)
            </p>
          </header>
          <AttendanceReportSummary rows={rows} />
          <table className="attendance-print-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Group</th>
                <th>Present rate</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Makeups attended</th>
                <th>Top absence reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>No matching active students.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.studentId}>
                    <td>
                      {row.name}
                      {row.preferredName && (
                        <span className="attendance-print-preferred">
                          {row.preferredName}
                        </span>
                      )}
                    </td>
                    <td>{row.groupName}</td>
                    <td
                      className={
                        row.rate === null ? "text-muted-foreground" : ""
                      }
                    >
                      {formatAttendanceRate(row.rate)}
                    </td>
                    <td>{row.present}</td>
                    <td>{row.absent}</td>
                    <td>{row.makeups}</td>
                    <td
                      className={!row.topReason ? "text-muted-foreground" : ""}
                    >
                      {row.topReason || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="attendance-print-note">
            Makeups attended are already included in Present. Top absence reason
            compares supplied reasons only; “-” means none were supplied.
          </p>
        </article>
      )}
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import type { Id } from "convex/_generated/dataModel";
import { ArrowDown, ArrowUp, ArrowUpDown, Printer } from "lucide-react";
import { useEffect } from "react";
import { AttendanceReportSummary } from "~/components/attendance-report-summary";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
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
import { useAttendanceReport } from "~/hooks/use-attendance-report";
import {
  defaultAttendanceRange as defaultRecentRange,
  attendanceSeasonRange,
  attendanceSortKeys,
  formatAttendanceRate,
  parseAttendanceReportSearch,
  type AttendanceReportSearch,
  type AttendanceSortKey,
  type AttendanceViewRow,
} from "../../../../shared/attendance-report";

export const Route = createFileRoute("/_app/admin/reports/attendance")({
  validateSearch: parseAttendanceReportSearch,
  component: () => (
    <RoleGate allow="admin">
      <AttendanceReportPage />
    </RoleGate>
  ),
});

const columnLabels: Record<AttendanceSortKey, string> = {
  name: "Student",
  groupName: "Group",
  rate: "Present rate",
  present: "Present",
  absent: "Absent",
  makeups: "Makeups attended",
  topReason: "Top absence reason",
};
const columns: ColumnDef<AttendanceViewRow>[] = attendanceSortKeys.map(
  (key) => ({
    id: key,
    accessorKey: key,
    // Filtering and sorting are shared with the summary and print view.
    filterFn: () => true,
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        aria-label={`Sort by ${columnLabels[key]}`}
      >
        {columnLabels[key]}
        {column.getIsSorted() === "asc" ? (
          <ArrowUp />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown />
        ) : (
          <ArrowUpDown />
        )}
      </Button>
    ),
    cell: ({ row }) => {
      const data = row.original;
      if (key === "name")
        return (
          <Link
            to="/admin/students/$studentId"
            params={{ studentId: data.studentId as Id<"students"> }}
            search={{ tab: "attendance" }}
            className="font-medium hover:underline"
          >
            {data.name}
            {data.preferredName && (
              <span className="text-muted-foreground block text-xs">
                {data.preferredName}
              </span>
            )}
          </Link>
        );
      if (key === "rate")
        return (
          <span
            className={
              data.rate === null ? "text-muted-foreground" : "tabular-nums"
            }
          >
            {formatAttendanceRate(data.rate)}
          </span>
        );
      if (key === "topReason")
        return (
          data.topReason || <span className="text-muted-foreground">-</span>
        );
      return data[key];
    },
  }),
);

function AttendanceReportPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { range, error, options, rows, loading } = useAttendanceReport(search);
  const sorting: SortingState = [
    { id: search.sort ?? "rate", desc: search.order !== "asc" },
  ];
  const update = (patch: Partial<AttendanceReportSearch>) =>
    void navigate({ search: { ...search, ...range, ...patch }, replace: true });
  useEffect(() => {
    if (search.start === undefined || search.end === undefined) {
      void navigate({ search: { ...search, ...range }, replace: true });
    }
  }, [search, range.start, range.end, navigate]);
  const selectedSeason = options?.seasons.find(
    (season) =>
      season._id === search.season &&
      season.startDate === range.start &&
      season.endDate === range.end,
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Attendance report</h1>
          <p className="text-muted-foreground">
            Attendance and makeups for active students.
          </p>
        </div>
        {!loading && !error && rows.length > 0 ? (
          <Button asChild variant="outline">
            <Link
              to="/admin/reports/attendance/print"
              search={{ ...search, ...range }}
            >
              <Printer />
              Print report
            </Link>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            <Printer />
            Print report
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="attendance-season">Date preset</Label>
          <Select
            value={selectedSeason?._id ?? "custom"}
            onValueChange={(value) => {
              if (value === "recent")
                update({ ...defaultRecentRange(), season: undefined });
              else if (value === "custom") update({ season: undefined });
              else {
                const season = options?.seasons.find(
                  (item) => item._id === value,
                );
                if (season) update(attendanceSeasonRange(season));
              }
            }}
          >
            <SelectTrigger id="attendance-season" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom dates</SelectItem>
              <SelectItem value="recent">Last four months</SelectItem>
              {options?.seasons.map((season) => (
                <SelectItem key={season._id} value={season._id}>
                  {season.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendance-start">Start date</Label>
          <Input
            id="attendance-start"
            type="date"
            value={range.start}
            onChange={(event) =>
              update({ start: event.target.value, season: undefined })
            }
            aria-invalid={!!error}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendance-end">End date</Label>
          <Input
            id="attendance-end"
            type="date"
            value={range.end}
            onChange={(event) =>
              update({ end: event.target.value, season: undefined })
            }
            aria-invalid={!!error}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : loading ? (
        <div role="status" className="flex justify-center gap-2 py-16">
          <Spinner />
          Loading attendance...
        </div>
      ) : (
        <>
          <AttendanceReportSummary rows={rows} />
          <DataTable
            columns={columns}
            data={rows}
            manualSorting
            sorting={sorting}
            onSortingChange={(updater) => {
              const next =
                typeof updater === "function" ? updater(sorting) : updater;
              update({
                sort: (next[0]?.id ?? "rate") as AttendanceSortKey,
                order: next[0]?.desc === false ? "asc" : "desc",
              });
            }}
            filterColumn="name"
            filterPlaceholder="Search students..."
            filterValue={search.q ?? ""}
            onFilterValueChange={(q) => update({ q })}
            toolbar={
              <>
                <Select
                  value={search.group ?? "all"}
                  onValueChange={(group) =>
                    update({ group: group === "all" ? undefined : group })
                  }
                >
                  <SelectTrigger className="w-48" aria-label="Filter by group">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All groups</SelectItem>
                    <SelectItem value="none">No group</SelectItem>
                    {options?.groups.map((group) => (
                      <SelectItem key={group._id} value={group._id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 sm:hidden">
                  <Select
                    value={search.sort ?? "rate"}
                    onValueChange={(sort) =>
                      update({ sort: sort as AttendanceSortKey })
                    }
                  >
                    <SelectTrigger aria-label="Sort column" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {attendanceSortKeys.map((key) => (
                        <SelectItem key={key} value={key}>
                          {columnLabels[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={
                      search.order === "asc"
                        ? "Sort descending"
                        : "Sort ascending"
                    }
                    onClick={() =>
                      update({ order: search.order === "asc" ? "desc" : "asc" })
                    }
                  >
                    {search.order === "asc" ? <ArrowUp /> : <ArrowDown />}
                  </Button>
                </div>
              </>
            }
          />
        </>
      )}
    </main>
  );
}

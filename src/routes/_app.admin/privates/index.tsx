import { useConvexQuery } from "@convex-dev/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { getAccountName } from "~/lib/account-name";
import { formatDateTime } from "~/lib/date-utils";

export const Route = createFileRoute("/_app/admin/privates/")({
  component: AdminPrivatesPage,
});

type PrivateRow = {
  private: Doc<"privates">;
  instructor: Doc<"users"> | null;
  lessonCount: number;
  nextLessonStartsAt?: number;
};

const columns: ColumnDef<PrivateRow>[] = [
  {
    id: "name",
    accessorFn: (row) => row.private.name,
    header: "Private",
    cell: ({ row }) => (
      <Button asChild variant="link" className="h-auto p-0">
        <Link
          to="/admin/privates/$privateId"
          params={{ privateId: row.original.private._id }}
        >
          {row.original.private.name}
        </Link>
      </Button>
    ),
  },
  {
    id: "instructor",
    header: "Instructor",
    cell: ({ row }) =>
      row.original.instructor
        ? getAccountName(row.original.instructor)
        : "Not found",
  },
  {
    id: "duration",
    header: "Duration",
    cell: ({ row }) => `${row.original.private.defaultDurationMinutes} min`,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.private.isActive ? "default" : "outline"}>
        {row.original.private.isActive ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    id: "nextLesson",
    header: "Next lesson",
    cell: ({ row }) => formatDateTime(row.original.nextLessonStartsAt),
  },
];

function AdminPrivatesPage() {
  const rows = useConvexQuery(api.privates.adminListPrivates, {});
  const [showInactive, setShowInactive] = useState(false);
  const filteredRows =
    rows?.filter((row) => showInactive || row.private.isActive) || [];

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Privates</h1>
            <p className="text-muted-foreground">
              Manage recurring private arrangements and lesson occurrences.
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/privates/create">
              <Plus />
              Add Private
            </Link>
          </Button>
        </div>
        {rows === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredRows}
            filterColumn="name"
            filterPlaceholder="Filter privates..."
            toolbar={
              <div className="flex h-9 items-center gap-2 rounded-md border px-3">
                <Switch
                  id="show-inactive-privates"
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <Label
                  htmlFor="show-inactive-privates"
                  className="whitespace-nowrap"
                >
                  Show inactive
                </Label>
              </div>
            }
          />
        )}
      </main>
    </RoleGate>
  );
}

import { useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Doc, Id } from "convex/_generated/dataModel";
import { Plus } from "lucide-react";
import { z } from "zod";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/admin/classes/")({
  validateSearch: z.object({
    season: z.string().optional(),
  }),
  component: AdminClassesPage,
});

type ClassRow = {
  classItem: Doc<"classes">;
  enrollments: Doc<"classEnrollments">[];
  sessions: Doc<"sessions">[];
  seasonId?: Id<"seasons">;
};

const columns: ColumnDef<ClassRow>[] = [
  {
    accessorKey: "classItem.title",
    id: "title",
    header: "Class",
    cell: ({ row }) => (
      <Button asChild variant="link" className="h-auto p-0">
        <Link
          to="/admin/classes/$classId"
          params={{ classId: row.original.classItem._id }}
        >
          {row.original.classItem.title}
        </Link>
      </Button>
    ),
  },
  {
    accessorKey: "classItem.scheduleSummary",
    header: "Schedule",
    cell: ({ row }) => row.original.classItem.scheduleSummary || "Not set",
  },
  {
    id: "capacity",
    header: "Capacity",
    cell: ({ row }) =>
      `${row.original.enrollments.length}/${row.original.classItem.capacity}`,
  },
  {
    accessorKey: "classItem.status",
    header: "Status",
    cell: ({ row }) => row.original.classItem.status,
  },
  {
    accessorKey: "classItem.location",
    header: "Location",
    cell: ({ row }) => row.original.classItem.location || "Not set",
  },
];

function AdminClassesPage() {
  const navigate = useNavigate();
  const { season: selectedSeason } = Route.useSearch();
  const classes = useConvexQuery(api.classes.adminListClasses, {});
  const seasons = useConvexQuery(api.classes.adminListSeasons, {});
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const availableSeasons =
    seasons?.filter(({ season }) => season.endDate >= today) || [];
  const filteredClasses = selectedSeason
    ? classes?.filter((classRow) => classRow.seasonId === selectedSeason)
    : classes;

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Classes</h1>
            <p className="text-muted-foreground">
              Manage class details, sessions, and enrollments.
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/classes/create">
              <Plus />
              Create Class
            </Link>
          </Button>
        </div>
        {classes === undefined || seasons === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredClasses || []}
            filterColumn="title"
            filterPlaceholder="Filter classes..."
            toolbar={
              <Select
                value={selectedSeason || "all"}
                onValueChange={(value) =>
                  navigate({
                    to: "/admin/classes",
                    search: (previous) => ({
                      ...previous,
                      season: value === "all" ? undefined : value,
                    }),
                  })
                }
              >
                <SelectTrigger className="w-40 shrink-0 sm:w-52">
                  <SelectValue placeholder="Filter by season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All seasons</SelectItem>
                  {availableSeasons.map(({ season }) => (
                    <SelectItem key={season._id} value={season._id}>
                      {season.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        )}
      </main>
    </RoleGate>
  );
}

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
    group: z.string().optional(),
  }),
  component: AdminClassesPage,
});

type ClassRow = {
  classItem: Doc<"classes">;
  enrollments: Doc<"classEnrollments">[];
  sessionSignups: Doc<"classSessionSignups">[];
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
    cell: ({ row }) => {
      const { classItem, enrollments, sessionSignups } = row.original;
      if (classItem.enrollmentMode === "per_session") {
        const countBySession = new Map<string, number>();
        for (const signup of sessionSignups) {
          if (signup.status !== "pending" && signup.status !== "enrolled") {
            continue;
          }
          countBySession.set(
            signup.session,
            (countBySession.get(signup.session) || 0) + 1,
          );
        }
        const highestSessionCount = Math.max(0, ...countBySession.values());
        return classItem.capacity === undefined
          ? `${highestSessionCount} selected`
          : `${highestSessionCount}/${classItem.capacity} per session`;
      }
      return classItem.capacity === undefined
        ? `${enrollments.length} enrolled`
        : `${enrollments.length}/${classItem.capacity}`;
    },
  },
  {
    id: "signupMode",
    header: "Signup",
    cell: ({ row }) =>
      row.original.classItem.enrollmentMode === "per_session"
        ? "Per session"
        : "All sessions",
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
  const { season: selectedSeason, group: selectedGroup } = Route.useSearch();
  const classes = useConvexQuery(api.classes.adminListClasses, {});
  const seasons = useConvexQuery(api.classes.adminListSeasons, {});
  const groups = useConvexQuery(api.classes.adminListStudentGroups, {});
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const availableSeasons =
    seasons?.filter(({ season }) => season.endDate >= today) || [];
  const filteredClasses = classes?.filter((classRow) => {
    if (selectedSeason && classRow.seasonId !== selectedSeason) {
      return false;
    }

    const visibleGroupIds = classRow.classItem.visibleToGroupIds || [];
    if (selectedGroup === "none") {
      return visibleGroupIds.length === 0;
    }
    if (selectedGroup) {
      return visibleGroupIds.includes(selectedGroup as Id<"groups">);
    }

    return true;
  });

  return (
    <RoleGate allow="admin">
      <main className="flex w-full flex-col gap-4 p-4 lg:p-8">
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
        {classes === undefined ||
        seasons === undefined ||
        groups === undefined ? (
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
              <div className="flex min-w-0 flex-1 gap-2 sm:flex-none">
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
                  <SelectTrigger className="min-w-0 flex-1 sm:w-52 sm:flex-none">
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
                <Select
                  value={selectedGroup || "all"}
                  onValueChange={(value) =>
                    navigate({
                      to: "/admin/classes",
                      search: (previous) => ({
                        ...previous,
                        group: value === "all" ? undefined : value,
                      }),
                    })
                  }
                >
                  <SelectTrigger className="min-w-0 flex-1 sm:w-56 sm:flex-none">
                    <SelectValue placeholder="Filter by group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All groups</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group._id} value={group._id}>
                        {group.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="none">No group restriction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          />
        )}
      </main>
    </RoleGate>
  );
}

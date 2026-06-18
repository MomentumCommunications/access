import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { ArrowUpDown, Check, Clock3, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
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
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
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

export const Route = createFileRoute("/_app/admin/classes/enrollments")({
  component: PendingEnrollmentsPage,
});

type PendingEnrollment = FunctionReturnType<
  typeof api.classes.adminListPendingEnrollments
>[number];
type PendingAction = "enroll" | "waitlist" | "delete";
type SortKey = "student" | "requestedBy" | "class" | "submitted";
type SortDirection = "asc" | "desc";

function studentName(row: PendingEnrollment) {
  const realName = `${row.student.firstName} ${row.student.lastName}`.trim();
  return row.student.preferredName
    ? `${row.student.preferredName} | ${realName}`
    : realName;
}

function requestedByName(row: PendingEnrollment) {
  return row.requestedBy ? getAccountName(row.requestedBy) : "Unknown account";
}

function submittedDate(row: PendingEnrollment) {
  return new Date(row.enrollment._creationTime).toISOString().slice(0, 10);
}

function enrollmentRange(row: PendingEnrollment) {
  const start = row.enrollment.startDate || "Not set";
  return `${start} - ${row.enrollment.endDate || "Open"}`;
}

function PendingEnrollmentsPage() {
  const enrollments = useConvexQuery(
    api.classes.adminListPendingEnrollments,
    {},
  );
  const applyAction = useConvexMutation(
    api.classes.adminApplyPendingEnrollmentAction,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("submitted");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [deleteIds, setDeleteIds] = useState<Id<"classEnrollments">[]>([]);
  const lastSelectedId = useRef<string | null>(null);
  const shiftPressed = useRef(false);

  const visibleRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = (enrollments || []).filter((row) => {
      if (!normalizedSearch) return true;
      return [
        studentName(row),
        requestedByName(row),
        row.classItem.title,
        submittedDate(row),
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
    const valueFor = (row: PendingEnrollment) => {
      if (sortKey === "student") return studentName(row);
      if (sortKey === "requestedBy") return requestedByName(row);
      if (sortKey === "class") return row.classItem.title;
      return submittedDate(row);
    };
    return filtered.sort((left, right) => {
      const comparison = valueFor(left).localeCompare(valueFor(right));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [enrollments, search, sortDirection, sortKey]);

  useEffect(() => {
    const availableIds = new Set(
      (enrollments || []).map((row) => row.enrollment._id),
    );
    setSelectedIds((current) =>
      current.filter((enrollmentId) => availableIds.has(enrollmentId)),
    );
  }, [enrollments]);

  const selected = new Set(selectedIds);
  const visibleIds = visibleRows.map((row) => row.enrollment._id);
  const selectedVisibleCount = visibleIds.filter((id) =>
    selected.has(id),
  ).length;
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  function updateSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function captureShift(event: PointerEvent) {
    shiftPressed.current = event.shiftKey;
  }

  function toggleSelection(enrollmentId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (shiftPressed.current && lastSelectedId.current) {
        const start = visibleIds.indexOf(lastSelectedId.current);
        const end = visibleIds.indexOf(enrollmentId);
        if (start >= 0 && end >= 0) {
          const [from, to] = start < end ? [start, end] : [end, start];
          for (const id of visibleIds.slice(from, to + 1)) {
            if (checked) next.add(id);
            else next.delete(id);
          }
        }
      } else if (checked) {
        next.add(enrollmentId);
      } else {
        next.delete(enrollmentId);
      }
      return [...next];
    });
    lastSelectedId.current = enrollmentId;
    shiftPressed.current = false;
  }

  async function runAction(
    action: Exclude<PendingAction, "delete">,
    ids: Id<"classEnrollments">[],
  ) {
    setPendingAction(action);
    try {
      const result = await applyAction({ action, enrollments: ids });
      setSelectedIds((current) =>
        current.filter((id) => !ids.includes(id as Id<"classEnrollments">)),
      );
      toast.success(
        action === "enroll"
          ? `${result.updated} enrollment request${
              result.updated === 1 ? "" : "s"
            } approved.`
          : `${result.updated} enrollment request${
              result.updated === 1 ? "" : "s"
            } moved to the waitlist.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The enrollment requests could not be updated.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function confirmDelete() {
    setPendingAction("delete");
    try {
      const result = await applyAction({
        action: "delete",
        enrollments: deleteIds,
      });
      setSelectedIds((current) =>
        current.filter(
          (id) => !deleteIds.includes(id as Id<"classEnrollments">),
        ),
      );
      setDeleteIds([]);
      toast.success(
        `${result.updated} enrollment request${
          result.updated === 1 ? "" : "s"
        } deleted and logged.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The enrollment requests could not be deleted.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Pending Enrollments</h1>
          <p className="text-muted-foreground">
            Review and process customer enrollment requests.
          </p>
        </div>

        {enrollments === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <section className="min-w-0 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter pending enrollments..."
                className="sm:max-w-sm"
              />
              <ButtonGroup className="sm:ml-auto">
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  disabled={selectedIds.length === 0 || pendingAction !== null}
                  onClick={() =>
                    void runAction(
                      "enroll",
                      selectedIds as Id<"classEnrollments">[],
                    )
                  }
                >
                  <Check />
                  Enroll
                </Button>
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  disabled={selectedIds.length === 0 || pendingAction !== null}
                  onClick={() =>
                    void runAction(
                      "waitlist",
                      selectedIds as Id<"classEnrollments">[],
                    )
                  }
                >
                  <Clock3 />
                  Waitlist
                </Button>
                <Button
                  variant="destructive"
                  className="cursor-pointer"
                  disabled={selectedIds.length === 0 || pendingAction !== null}
                  onClick={() =>
                    setDeleteIds(selectedIds as Id<"classEnrollments">[])
                  }
                >
                  <Trash2 />
                  Delete
                </Button>
              </ButtonGroup>
            </div>

            <div className="max-w-screen overflow-x-auto rounded-md border">
              <Table className="min-w-5xl">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        aria-label="Select all visible enrollments"
                        checked={
                          allVisibleSelected
                            ? true
                            : selectedVisibleCount > 0
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(checked) => {
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            for (const id of visibleIds) {
                              if (checked === true) next.add(id);
                              else next.delete(id);
                            }
                            return [...next];
                          });
                        }}
                      />
                    </TableHead>
                    <SortableHead
                      label="Student"
                      active={sortKey === "student"}
                      direction={sortDirection}
                      onClick={() => updateSort("student")}
                    />
                    <SortableHead
                      label="Submitted by"
                      active={sortKey === "requestedBy"}
                      direction={sortDirection}
                      onClick={() => updateSort("requestedBy")}
                    />
                    <SortableHead
                      label="Class"
                      active={sortKey === "class"}
                      direction={sortDirection}
                      onClick={() => updateSort("class")}
                    />
                    <SortableHead
                      label="Submitted"
                      active={sortKey === "submitted"}
                      direction={sortDirection}
                      onClick={() => updateSort("submitted")}
                    />
                    <TableHead>Date range</TableHead>
                    <TableHead className="hidden w-32 text-right sm:table-cell">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.length > 0 ? (
                    visibleRows.map((row) => {
                      const enrollmentId = row.enrollment._id;
                      return (
                        <TableRow key={enrollmentId} className="group">
                          <TableCell>
                            <Checkbox
                              aria-label={`Select ${studentName(row)}`}
                              checked={selected.has(enrollmentId)}
                              onPointerDown={captureShift}
                              onCheckedChange={(checked) =>
                                toggleSelection(enrollmentId, checked === true)
                              }
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <Link
                              to="/admin/students/$studentId"
                              params={{ studentId: row.student._id }}
                              className="hover:underline"
                            >
                              {studentName(row)}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {row.requestedBy ? (
                              <Link
                                to="/admin/accounts/$userId"
                                params={{ userId: row.requestedBy._id }}
                                className="hover:underline"
                              >
                                {requestedByName(row)}
                              </Link>
                            ) : (
                              requestedByName(row)
                            )}
                          </TableCell>
                          <TableCell>
                            <Link
                              to="/admin/classes/$classId"
                              params={{ classId: row.classItem._id }}
                              className="font-medium hover:underline"
                            >
                              {row.classItem.title}
                            </Link>
                          </TableCell>
                          <TableCell>{submittedDate(row)}</TableCell>
                          <TableCell>{enrollmentRange(row)}</TableCell>
                          <TableCell className="hidden text-right sm:table-cell">
                            <ButtonGroup className="ml-auto opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                              <Button
                                size="sm"
                                variant="outline"
                                title="Enroll"
                                aria-label={`Enroll ${studentName(row)}`}
                                disabled={pendingAction !== null}
                                onClick={() =>
                                  void runAction("enroll", [enrollmentId])
                                }
                              >
                                <Check />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                title="Waitlist"
                                aria-label={`Waitlist ${studentName(row)}`}
                                disabled={pendingAction !== null}
                                onClick={() =>
                                  void runAction("waitlist", [enrollmentId])
                                }
                              >
                                <Clock3 />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                title="Delete"
                                aria-label={`Delete ${studentName(row)} enrollment`}
                                disabled={pendingAction !== null}
                                onClick={() => setDeleteIds([enrollmentId])}
                              >
                                <Trash2 />
                              </Button>
                            </ButtonGroup>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No pending enrollment requests.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </main>

      <AlertDialog
        open={deleteIds.length > 0}
        onOpenChange={(open) => {
          if (!open && pendingAction !== "delete") setDeleteIds([]);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteIds.length} enrollment request
              {deleteIds.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the pending enrollment request. A record of the
              deletion will remain in the student activity log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction === "delete"}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingAction === "delete"}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleGate>
  );
}

function SortableHead({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <Button
        variant="ghost"
        className="-ml-3 h-8 px-3"
        aria-label={`Sort by ${label}${
          active ? ` ${direction === "asc" ? "descending" : "ascending"}` : ""
        }`}
        onClick={onClick}
      >
        {label}
        <ArrowUpDown />
      </Button>
    </TableHead>
  );
}

import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { CalendarDays, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { formatMDYYYY, formatTimeRange } from "~/lib/date-utils";

type StudentData = NonNullable<
  FunctionReturnType<typeof api.classes.getMyStudent>
>;
type PerSessionClass = StudentData["perSessionClasses"][number];

function sessionLabel(session: PerSessionClass["availableSessions"][number]) {
  const time = formatTimeRange(session.startTime, session.endTime);
  return time
    ? `${formatMDYYYY(session.date)} · ${time}`
    : formatMDYYYY(session.date);
}

export function PerSessionClassCard({
  studentId,
  row,
}: {
  studentId: Id<"students">;
  row: PerSessionClass;
}) {
  const updateSessions = useConvexMutation(
    api.classes.signUpStudentForSessions,
  );
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeAvailableIds = useMemo(
    () => new Set(row.availableSessions.map((session) => session._id)),
    [row.availableSessions],
  );
  const initialSelectedIds = useMemo(
    () =>
      row.selectedSessions
        .map(({ session }) => session._id)
        .filter((sessionId) => activeAvailableIds.has(sessionId))
        .sort(),
    [activeAvailableIds, row.selectedSessions],
  );
  const lockedIds = useMemo(
    () =>
      new Set(
        row.selectedSessions
          .filter(({ signup }) => signup.status === "enrolled")
          .map(({ session }) => session._id)
          .filter((sessionId) => activeAvailableIds.has(sessionId)),
      ),
    [activeAvailableIds, row.selectedSessions],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const selectionsChanged =
    selectedIds.slice().sort().join(",") !== initialSelectedIds.join(",");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setSelectedIds(initialSelectedIds);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await updateSessions({
        classId: row.classItem._id,
        student: studentId,
        sessions: selectedIds as Id<"sessions">[],
      });
      toast.success("Session selections updated.");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update session selections.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card className="rounded-lg">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <CardTitle>{row.classItem.title}</CardTitle>
                <Badge variant="secondary">Per-session</Badge>
                {!row.canSelfManage ? (
                  <Badge variant="outline">Managed by staff</Badge>
                ) : null}
              </div>
              <CardDescription>
                {row.selectedSessions.length}{" "}
                {row.selectedSessions.length === 1 ? "date" : "dates"} selected
                {row.classItem.perSessionPriceCents !== undefined
                  ? ` · ${new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(row.classItem.perSessionPriceCents / 100)} each`
                  : ""}
                {!row.canSelfManage
                  ? " · Please contact us to make changes"
                  : ""}
              </CardDescription>
            </div>
            {row.availableSessions.length > 0 && row.canSelfManage ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full shrink-0 sm:w-auto"
                onClick={() => handleOpenChange(true)}
              >
                <Pencil />
                Edit sessions
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {row.selectedSessions.map(({ signup, session }) => (
              <div
                key={signup._id}
                className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                  <span>{sessionLabel(session)}</span>
                </span>
                <Badge variant="outline" className="capitalize">
                  {signup.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[min(42rem,calc(100svh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] p-0 sm:max-w-2xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Edit {row.classItem.title} sessions</DialogTitle>
            <DialogDescription>
              Choose the upcoming dates this student should attend. Confirmed
              dates cannot be removed here.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6">
            <div className="mb-3 flex items-center gap-2">
              <Checkbox
                id={`select-all-${row.classItem._id}`}
                checked={
                  row.availableSessions.length > 0 &&
                  selectedIds.length === row.availableSessions.length
                }
                onCheckedChange={(checked) =>
                  setSelectedIds(
                    checked
                      ? row.availableSessions.map((session) => session._id)
                      : [...lockedIds],
                  )
                }
              />
              <Label htmlFor={`select-all-${row.classItem._id}`}>
                Select all available dates
              </Label>
            </div>
            <div className="space-y-2 pb-2">
              {row.availableSessions.map((session) => {
                const selected = selectedIds.includes(session._id);
                const locked = lockedIds.has(session._id);
                return (
                  <label
                    key={session._id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <span className="flex items-center gap-3">
                      <Checkbox
                        checked={selected}
                        disabled={locked}
                        onCheckedChange={(checked) =>
                          setSelectedIds((current) =>
                            checked
                              ? [...new Set([...current, session._id])]
                              : current.filter(
                                  (sessionId) => sessionId !== session._id,
                                ),
                          )
                        }
                      />
                      <span className="text-sm">
                        {formatMDYYYY(session.date)}
                      </span>
                    </span>
                    <span className="text-right text-sm text-muted-foreground">
                      {formatTimeRange(session.startTime, session.endTime) ||
                        "Time TBD"}
                      {locked ? (
                        <span className="block text-xs">Confirmed</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectionsChanged || saving}
              onClick={save}
            >
              {saving ? "Saving..." : "Save sessions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

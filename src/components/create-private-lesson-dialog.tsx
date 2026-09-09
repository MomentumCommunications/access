import { useConvexMutation } from "@convex-dev/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { CalendarPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

function studentName(student: Doc<"students">) {
  return `${student.firstName} ${student.lastName}`;
}

export function CreatePrivateLessonDialog({
  privateId,
  defaultDurationMinutes,
  timezone,
  startTime,
  students,
}: {
  privateId: Id<"privates">;
  defaultDurationMinutes: number;
  timezone: string;
  startTime: string;
  students: Doc<"students">[];
}) {
  const createLesson = useConvexMutation(api.privates.adminCreatePrivateLesson);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set(),
  );
  const [saving, setSaving] = useState(false);

  function resetForm() {
    const date = formatInTimeZone(Date.now(), timezone, "yyyy-MM-dd");
    setStartsAt(`${date}T${startTime}`);
    setDurationMinutes(String(defaultDurationMinutes));
    setNotes("");
    setSelectedStudentIds(new Set(students.map((student) => student._id)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (selectedStudentIds.size === 0) {
      toast.error("Select at least one student.");
      return;
    }
    const startsAtTimestamp = fromZonedTime(startsAt, timezone).getTime();
    const duration = Number(durationMinutes);
    if (!Number.isFinite(startsAtTimestamp)) {
      toast.error("Enter a valid lesson date and time.");
      return;
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 480) {
      toast.error("Duration must be a whole number between 1 and 480.");
      return;
    }

    setSaving(true);
    try {
      const privateLessonId = await createLesson({
        privateId,
        startsAt: startsAtTimestamp,
        durationMinutes: duration,
        studentIds: [...selectedStudentIds] as Id<"students">[],
        notes: notes.trim() || undefined,
      });
      toast.success("Private lesson added.");
      setOpen(false);
      await navigate({
        to: "/admin/privates/$privateId/$privateLessonId",
        params: { privateId, privateLessonId },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to add private lesson.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (next) resetForm();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={students.length === 0}>
          <CalendarPlus />
          Add lesson
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <form className="space-y-5" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add private lesson</DialogTitle>
            <DialogDescription>
              Create a one-off occurrence outside the generated schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`private-lesson-start-${privateId}`}>Starts</Label>
              <Input
                id={`private-lesson-start-${privateId}`}
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">{timezone}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`private-lesson-duration-${privateId}`}>
                Duration (minutes)
              </Label>
              <Input
                id={`private-lesson-duration-${privateId}`}
                type="number"
                min={1}
                max={480}
                step={1}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                required
                disabled={saving}
              />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Students</legend>
            <div className="space-y-2 rounded-md border p-3">
              {students.map((student) => {
                const checked = selectedStudentIds.has(student._id);
                return (
                  <label
                    key={student._id}
                    className="flex cursor-pointer items-center gap-3 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={saving}
                      onCheckedChange={(value) => {
                        setSelectedStudentIds((current) => {
                          const next = new Set(current);
                          if (value) next.add(student._id);
                          else next.delete(student._id);
                          return next;
                        });
                      }}
                    />
                    <span className="font-medium">{studentName(student)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor={`private-lesson-notes-${privateId}`}>Notes</Label>
            <Textarea
              id={`private-lesson-notes-${privateId}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={2000}
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding..." : "Add lesson"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { MoreVertical, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useIsMobile } from "~/hooks/use-mobile";

type AttendanceStatus = "present" | "absent" | "late" | "excused";
type AttendanceReason =
  | "sick"
  | "injured"
  | "homework"
  | "vacation"
  | "school-event"
  | "no-ride";

const reasonOptions: Array<{ value: AttendanceReason; label: string }> = [
  { value: "sick", label: "Sick" },
  { value: "injured", label: "Injured" },
  { value: "homework", label: "Homework" },
  { value: "vacation", label: "Vacation" },
  { value: "school-event", label: "School event" },
  { value: "no-ride", label: "No ride" },
];

export function AttendanceRowActions({
  session,
  student,
  studentName,
  status,
  reason,
  canRemove,
  onError,
}: {
  session: Id<"sessions">;
  student: Id<"students">;
  studentName: string;
  status?: AttendanceStatus;
  reason?: AttendanceReason;
  canRemove: boolean;
  onError: (message: string) => void;
}) {
  const isMobile = useIsMobile();
  const updateAttendanceReason = useConvexMutation(
    api.classes.updateAttendanceReason,
  );
  const removeStudentFromSession = useConvexMutation(
    api.classes.removeStudentFromSession,
  );
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<
    AttendanceReason | "none"
  >(reason || "none");
  const [isSavingReason, setIsSavingReason] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    setSelectedReason(reason || "none");
  }, [reason]);

  async function handleReasonChange(value: AttendanceReason | "none") {
    const previousReason = selectedReason;
    setSelectedReason(value);
    setIsSavingReason(true);
    onError("");

    try {
      await updateAttendanceReason({
        session,
        student,
        reason: value === "none" ? undefined : value,
      });
    } catch (error) {
      setSelectedReason(previousReason);
      onError(
        error instanceof Error
          ? error.message
          : "The absence reason could not be saved.",
      );
    } finally {
      setIsSavingReason(false);
    }
  }

  async function handleRemove() {
    setIsRemoving(true);
    onError("");

    try {
      await removeStudentFromSession({ session, student });
      setConfirmOpen(false);
      setOpen(false);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "The student could not be removed from this session.",
      );
    } finally {
      setIsRemoving(false);
    }
  }

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9 w-4 shrink-0 cursor-pointer"
      aria-label={`More attendance options for ${studentName}`}
    >
      <MoreVertical className="size-5 text-muted-foreground" />
    </Button>
  );

  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`absence-reason-${student}`}>Absence reason</Label>
        <Select
          value={selectedReason}
          onValueChange={(value) =>
            void handleReasonChange(value as AttendanceReason | "none")
          }
          disabled={status !== "absent" || isSavingReason}
        >
          <SelectTrigger
            id={`absence-reason-${student}`}
            className="w-full"
            aria-label={`Absence reason for ${studentName}`}
          >
            <SelectValue placeholder="Select a reason" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No reason</SelectItem>
            {reasonOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {status !== "absent" ? (
          <p className="text-muted-foreground text-xs">
            Mark this student absent to add a reason.
          </p>
        ) : null}
      </div>

      {canRemove ? (
        <div className="border-t pt-4">
          <Button
            type="button"
            variant="destructive"
            className="w-full cursor-pointer"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
            Remove from session
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent className="h-1/2">
            <DrawerHeader>
              <DrawerTitle>Attendance options</DrawerTitle>
              <DrawerDescription>{studentName}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6">{content}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <div className="mb-4">
              <p className="font-medium">Attendance options</p>
              <p className="text-muted-foreground text-sm">{studentName}</p>
            </div>
            {content}
          </PopoverContent>
        </Popover>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {studentName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the student and their attendance mark from this
              session. It does not delete their student profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemoving}
              onClick={(event) => {
                event.preventDefault();
                void handleRemove();
              }}
            >
              {isRemoving ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

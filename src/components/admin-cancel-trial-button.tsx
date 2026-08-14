import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";

export function AdminCancelTrialButton({
  trialRequestId,
}: {
  trialRequestId: Id<"trialRequests">;
}) {
  const review = useConvexMutation(api.trials.adminReview);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  async function cancelTrial() {
    if (working) return;
    setWorking(true);
    try {
      await review({ trialRequestId, action: "cancel" });
      toast.success("Trial cancelled and removed from the attendance roster.");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The trial could not be cancelled.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !working && setOpen(nextOpen)}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          <XCircle />
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this approved trial?</AlertDialogTitle>
          <AlertDialogDescription>
            The student will be removed from the attendance roster for this
            session. The trial request and its billing history will remain in
            the system with a cancelled status.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Keep trial</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={working}
            onClick={(event) => {
              event.preventDefault();
              void cancelTrial();
            }}
          >
            {working ? "Cancelling..." : "Cancel trial"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

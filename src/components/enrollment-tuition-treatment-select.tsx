import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import {
  canEditEnrollmentTuitionTreatment,
  type TuitionTreatmentEnrollmentStatus,
} from "../../shared/enrollment-tuition-treatment";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type EnrollmentTuitionTreatmentSelectProps = {
  enrollment: Id<"classEnrollments">;
  status: TuitionTreatmentEnrollmentStatus;
  prorateTuition?: boolean;
};

export function EnrollmentTuitionTreatmentSelect({
  enrollment,
  status,
  prorateTuition,
}: EnrollmentTuitionTreatmentSelectProps) {
  const updateTreatment = useConvexMutation(
    api.classes.adminUpdateEnrollmentTuitionTreatment,
  );
  const [saving, setSaving] = useState(false);

  if (!canEditEnrollmentTuitionTreatment(status)) {
    return <span className="text-muted-foreground">Not applicable</span>;
  }

  return (
    <Select
      value={prorateTuition === false ? "full" : "prorated"}
      disabled={saving}
      onValueChange={async (value) => {
        setSaving(true);
        try {
          await updateTreatment({
            enrollment,
            prorateTuition: value === "prorated",
          });
          toast.success("Tuition treatment updated.");
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to update tuition treatment.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <SelectTrigger className="w-32" aria-label="Tuition treatment">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="prorated">Prorated</SelectItem>
        <SelectItem value="full">Full period</SelectItem>
      </SelectContent>
    </Select>
  );
}

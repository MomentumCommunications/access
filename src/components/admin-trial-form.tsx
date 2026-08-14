import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { formatMDYYYY, formatTimeRange } from "~/lib/date-utils";

type AdminTrialFormProps = {
  fixedClassId?: Id<"classes">;
};

export function AdminTrialForm({ fixedClassId }: AdminTrialFormProps) {
  const navigate = useNavigate();
  const [classId, setClassId] = useState<string>(fixedClassId || "");
  const [studentId, setStudentId] = useState("");
  const [billingContact, setBillingContact] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const options = useConvexQuery(api.trials.adminGetCreateOptions, {
    classId: classId ? (classId as Id<"classes">) : undefined,
    studentId: studentId ? (studentId as Id<"students">) : undefined,
  });
  const createTrial = useConvexMutation(api.trials.adminCreate);

  const studentOptions = useMemo(
    () =>
      (options?.students || []).map((student) => ({
        value: student.id,
        label:
          student.name === student.fullName
            ? student.name
            : `${student.name} (${student.fullName})`,
      })),
    [options?.students],
  );
  const billingOptions = useMemo(
    () =>
      (options?.billingContacts || []).map((contact) => ({
        ...contact,
        value: `${contact.requestedBy}|${contact.householdId}`,
      })),
    [options?.billingContacts],
  );

  useEffect(() => {
    setSessionId("");
  }, [classId]);

  useEffect(() => {
    setBillingContact("");
  }, [studentId]);

  useEffect(() => {
    if (billingOptions.some((option) => option.value === billingContact)) return;
    setBillingContact(
      billingOptions.length === 1 ? billingOptions[0].value : "",
    );
  }, [billingContact, billingOptions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const selectedBilling = billingOptions.find(
      (option) => option.value === billingContact,
    );
    if (!classId || !studentId || !sessionId || !selectedBilling) {
      toast.error("Choose a class, student, billing contact, and session.");
      return;
    }

    setSubmitting(true);
    try {
      await createTrial({
        classId: classId as Id<"classes">,
        studentId: studentId as Id<"students">,
        sessionId: sessionId as Id<"sessions">,
        requestedBy: selectedBilling.requestedBy,
        householdId: selectedBilling.householdId,
      });
      toast.success("Trial request created for review.");
      if (fixedClassId) {
        await navigate({
          to: "/admin/classes/$classId",
          params: { classId: fixedClassId },
        });
      } else {
        await navigate({ to: "/admin/classes/trials" });
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The trial request could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (options === undefined) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  const classUnavailable = fixedClassId && !options.selectedClass;
  const trialsDisabled = fixedClassId && !options.selectedClass?.allowTrials;

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label>Class</Label>
        {fixedClassId ? (
          <div className="rounded-md border px-3 py-2 text-sm">
            <div className="font-medium">
              {options.selectedClass?.title || "Class not found"}
            </div>
            {options.selectedClass?.scheduleSummary ? (
              <div className="text-muted-foreground text-xs">
                {options.selectedClass.scheduleSummary}
              </div>
            ) : null}
          </div>
        ) : (
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {options.classes.map((classItem) => (
                <SelectItem key={classItem.id} value={classItem.id}>
                  {classItem.title}
                  {classItem.scheduleSummary
                    ? ` · ${classItem.scheduleSummary}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {trialsDisabled ? (
          <p className="text-destructive text-sm">
            Trials are disabled for this class. Enable them from the Trials tab
            before adding a request.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>Student</Label>
        <Combobox
          items={studentOptions.map((option) => option.value)}
          value={studentId || null}
          onValueChange={(value) => setStudentId(value || "")}
          itemToStringLabel={(value) =>
            studentOptions.find((option) => option.value === value)?.label || ""
          }
          disabled={Boolean(classUnavailable)}
        >
          <ComboboxInput
            className="w-full"
            placeholder="Select student"
            showClear
          />
          <ComboboxContent>
            <ComboboxEmpty>No active students found.</ComboboxEmpty>
            <ComboboxList>
              {(value: string) => (
                <ComboboxItem key={value} value={value}>
                  {studentOptions.find((option) => option.value === value)
                    ?.label || value}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      <div className="space-y-1.5">
        <Label>Billing contact and household</Label>
        <Select
          value={billingContact}
          onValueChange={setBillingContact}
          disabled={!studentId || billingOptions.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select billing contact" />
          </SelectTrigger>
          <SelectContent>
            {billingOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {studentId && billingOptions.length === 0 ? (
          <p className="text-destructive text-sm">
            This student does not have a managing contact with a household.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>Trial session</Label>
        <Select
          value={sessionId}
          onValueChange={setSessionId}
          disabled={!classId || options.sessions.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select session" />
          </SelectTrigger>
          <SelectContent>
            {options.sessions.map((session) => (
              <SelectItem key={session.id} value={session.id}>
                {formatMDYYYY(session.date)} ·{" "}
                {formatTimeRange(session.startTime, session.endTime) ||
                  "Time TBD"}
                {session.location ? ` · ${session.location}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {classId && !trialsDisabled && options.sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            This class has no upcoming active sessions available for a trial.
          </p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={
            submitting ||
            Boolean(classUnavailable) ||
            Boolean(trialsDisabled) ||
            !classId ||
            !studentId ||
            !billingContact ||
            !sessionId
          }
        >
          {submitting ? "Creating..." : "Create trial request"}
        </Button>
      </div>
    </form>
  );
}

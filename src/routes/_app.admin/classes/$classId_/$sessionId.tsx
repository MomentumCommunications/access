import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ArrowLeft, Save } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SessionSubstituteCombobox } from "~/components/session-substitute-combobox";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getAccountName } from "~/lib/account-name";
import { hasUserRole } from "~/lib/roles";

export const Route = createFileRoute(
  "/_app/admin/classes/$classId_/$sessionId",
)({
  component: AdminClassSessionPage,
});

type SessionStatus = "scheduled" | "cancelled" | "completed";

function studentName(student: { firstName?: string; lastName?: string } | null) {
  return [student?.firstName, student?.lastName].filter(Boolean).join(" ");
}

function formatSessionDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function AdminClassSessionPage() {
  const { classId, sessionId } = Route.useParams();
  const sessionData = useConvexQuery(api.classes.adminGetClassSession, {
    classId: classId as Id<"classes">,
    session: sessionId as Id<"sessions">,
  });
  const accounts = useConvexQuery(api.classes.adminListAccounts, {});
  const updateSession = useConvexMutation(api.classes.adminUpdateSessionDetails);

  const staffOptions = useMemo(
    () => [
      { value: "none", label: "Use class staff" },
      ...(accounts || [])
        .filter(
          (account) =>
            hasUserRole(account, "staff") || hasUserRole(account, "admin"),
        )
        .map((account) => ({
          value: account._id,
          label: getAccountName(account),
        })),
    ],
    [accounts],
  );

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<SessionStatus>("scheduled");
  const [active, setActive] = useState(true);
  const [assignedStaff, setAssignedStaff] = useState("none");
  const [substitute, setSubstitute] = useState<Id<"users"> | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!sessionData) return;
    setDate(sessionData.session.date || "");
    setStartTime(sessionData.session.startTime || "");
    setEndTime(sessionData.session.endTime || "");
    setLocation(sessionData.session.location || "");
    setStatus(sessionData.session.status || "scheduled");
    setActive(sessionData.session.active);
    setAssignedStaff(sessionData.session.assignedStaff?.[0] || "none");
    setSubstitute(sessionData.session.substitute);
  }, [sessionData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionData) return;
    setIsSaving(true);
    try {
      await updateSession({
        session: sessionId as Id<"sessions">,
        date,
        active,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        location: location || undefined,
        assignedStaff:
          assignedStaff === "none"
            ? undefined
            : [assignedStaff as Id<"users">],
        substitute: substitute || null,
        status,
      });
      toast.success("Session updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update session.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const attendanceByStudent = useMemo(() => {
    const records = new Map<string, string>();
    for (const record of sessionData?.attendance || []) {
      records.set(record.student, record.status);
    }
    return records;
  }, [sessionData?.attendance]);

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link to="/admin/classes/$classId" params={{ classId }}>
                <ArrowLeft className="size-4" />
                Back to class
              </Link>
            </Button>
            <h1 className="mt-2 text-3xl font-bold">Session details</h1>
            {sessionData?.classItem && (
              <p className="text-muted-foreground">
                {sessionData.classItem.title} ·{" "}
                {formatSessionDate(sessionData.session.date)}
              </p>
            )}
          </div>
        </div>

        {sessionData === undefined ? (
          <div className="flex min-h-48 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : sessionData === null ? (
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Session not found</CardTitle>
              <CardDescription>
                This session may have been deleted or moved to another class.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Edit session</CardTitle>
                <CardDescription>
                  Adjust this single session without changing the class template.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="session-date">Date</Label>
                      <Input
                        id="session-date"
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="session-start">Start</Label>
                      <Input
                        id="session-start"
                        type="time"
                        value={startTime}
                        onChange={(event) => setStartTime(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="session-end">End</Label>
                      <Input
                        id="session-end"
                        type="time"
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="session-location">Location</Label>
                      <Input
                        id="session-location"
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder={
                          sessionData.classItem?.location || "Studio / room"
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select
                        value={status}
                        onValueChange={(value) =>
                          setStatus(value as SessionStatus)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Session staff</Label>
                      <Combobox
                        items={staffOptions.map((option) => option.value)}
                        value={assignedStaff}
                        onValueChange={(value) =>
                          setAssignedStaff(value || "none")
                        }
                        itemToStringLabel={(value) =>
                          staffOptions.find((option) => option.value === value)
                            ?.label || ""
                        }
                        disabled={accounts === undefined}
                      >
                        <ComboboxInput
                          className="w-full"
                          placeholder="Use class staff"
                          disabled={accounts === undefined}
                        />
                        <ComboboxContent>
                          <ComboboxEmpty>No staff found.</ComboboxEmpty>
                          <ComboboxList>
                            {(value: string) => (
                              <ComboboxItem key={value} value={value}>
                                {staffOptions.find(
                                  (option) => option.value === value,
                                )?.label || value}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </div>
                    <div className="space-y-1">
                      <Label>Substitute</Label>
                      <SessionSubstituteCombobox
                        accounts={accounts}
                        value={substitute}
                        onValueChange={(value) => setSubstitute(value || undefined)}
                        disabled={accounts === undefined}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label htmlFor="session-active">Active session</Label>
                      <p className="text-sm text-muted-foreground">
                        Inactive sessions are hidden from attendance lists.
                      </p>
                    </div>
                    <Switch
                      id="session-active"
                      checked={active}
                      onCheckedChange={setActive}
                    />
                  </div>

                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <Spinner className="size-4" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save session
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Session roster</CardTitle>
                <CardDescription>
                  Students connected to this class session and their attendance
                  state.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessionData.enrollments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No students are connected to this session.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Attendance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionData.enrollments.map((enrollment) => {
                        const name = studentName(enrollment.student);
                        const attendance = enrollment.student
                          ? attendanceByStudent.get(enrollment.student._id)
                          : undefined;
                        return (
                          <TableRow key={`${enrollment.status}-${enrollment._id}`}>
                            <TableCell className="font-medium">
                              {name || "Student not found"}
                            </TableCell>
                            <TableCell>{enrollment.status}</TableCell>
                            <TableCell>{attendance || "Unmarked"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </RoleGate>
  );
}


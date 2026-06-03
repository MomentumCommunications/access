import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { FormEvent, useEffect, useState } from "react";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
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
import { Textarea } from "~/components/ui/textarea";

export const Route = createFileRoute("/_app/admin/classes/$classId_/edit")({
  component: AdminClassEditPage,
});

type ClassStatus = "draft" | "published" | "archived";
type Weekday =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

const weekdays: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function AdminClassEditPage() {
  const { classId } = Route.useParams();
  const navigate = useNavigate();
  const classData = useConvexQuery(api.classes.adminGetClass, {
    classId: classId as Id<"classes">,
  });
  const accounts = useConvexQuery(api.classes.adminListAccounts, {});
  const updateClass = useConvexMutation(api.classes.adminUpdateClass);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ClassStatus>("draft");
  const [scheduleSummary, setScheduleSummary] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedWeekdays, setSelectedWeekdays] = useState<Weekday[]>([]);
  const [assignedStaff, setAssignedStaff] = useState("none");

  useEffect(() => {
    if (!classData?.classItem) return;
    setTitle(classData.classItem.title);
    setDescription(classData.classItem.description || "");
    setStatus(classData.classItem.status);
    setScheduleSummary(classData.classItem.scheduleSummary || "");
    setLocation(classData.classItem.location || "");
    setCapacity(classData.classItem.capacity?.toString() || "");
    setStartDate(classData.classItem.startDate || "");
    setEndDate(classData.classItem.endDate || "");
    setStartTime(classData.classItem.startTime || "");
    setEndTime(classData.classItem.endTime || "");
    setSelectedWeekdays((classData.classItem.weekdays || []) as Weekday[]);
    setAssignedStaff(classData.classItem.assignedStaff?.[0] || "none");
  }, [classData]);

  function toggleWeekday(weekday: Weekday, checked: boolean) {
    setSelectedWeekdays((current) =>
      checked
        ? [...current, weekday]
        : current.filter((value) => value !== weekday),
    );
  }

  async function handleUpdate(event: FormEvent) {
    event.preventDefault();
    await updateClass({
      classId: classId as Id<"classes">,
      title,
      description: description || undefined,
      status,
      scheduleSummary: scheduleSummary || undefined,
      location: location || undefined,
      capacity: capacity ? Number(capacity) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      weekdays: selectedWeekdays.length ? selectedWeekdays : undefined,
      assignedStaff:
        assignedStaff === "none" ? undefined : [assignedStaff as Id<"users">],
    });
    await navigate({
      to: "/admin/classes/$classId",
      params: { classId },
    });
  }

  return (
    <RoleGate allow="admin">
      {classData === undefined ? (
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      ) : !classData ? (
        <main className="mx-auto max-w-3xl p-4 lg:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Class not found</CardTitle>
            </CardHeader>
          </Card>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-3xl space-y-4 p-4 lg:p-8">
          <div className="space-y-1">
            <Button asChild variant="ghost" className="-ml-3">
              <Link to="/admin/classes/$classId" params={{ classId }}>
                Back to Class
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Edit class</h1>
            <p className="text-muted-foreground">
              Update the class details and recurring schedule.
            </p>
          </div>
          <Card className="rounded-lg">
            <CardContent className="pt-6">
              <form className="space-y-4" onSubmit={handleUpdate}>
                <div className="space-y-1">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value as ClassStatus)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-schedule">Schedule</Label>
                  <Input
                    id="edit-schedule"
                    value={scheduleSummary}
                    onChange={(event) => setScheduleSummary(event.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-location">Location</Label>
                    <Input
                      id="edit-location"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-capacity">Capacity</Label>
                    <Input
                      id="edit-capacity"
                      type="number"
                      min="0"
                      value={capacity}
                      onChange={(event) => setCapacity(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-start-date">Start date</Label>
                    <Input
                      id="edit-start-date"
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-end-date">End date</Label>
                    <Input
                      id="edit-end-date"
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-start-time">Start time</Label>
                    <Input
                      id="edit-start-time"
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-end-time">End time</Label>
                    <Input
                      id="edit-end-time"
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Days</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {weekdays.map((weekday) => (
                      <Label
                        key={weekday}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm capitalize"
                      >
                        <Checkbox
                          checked={selectedWeekdays.includes(weekday)}
                          onCheckedChange={(checked) =>
                            toggleWeekday(weekday, checked === true)
                          }
                        />
                        {weekday}
                      </Label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Assigned staff</Label>
                  <Select value={assignedStaff} onValueChange={setAssignedStaff}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accounts
                        ?.filter(
                          (account) =>
                            account.role === "staff" ||
                            account.role === "admin",
                        )
                        .map((account) => (
                          <SelectItem key={account._id} value={account._id}>
                            {account.name || account.email || "Unnamed"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button asChild type="button" variant="outline">
                    <Link to="/admin/classes/$classId" params={{ classId }}>
                      Cancel
                    </Link>
                  </Button>
                  <Button type="submit">Save Class</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      )}
    </RoleGate>
  );
}

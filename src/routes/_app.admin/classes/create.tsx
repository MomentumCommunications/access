import { useConvexMutation } from "@convex-dev/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { FormEvent, useState } from "react";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";

export const Route = createFileRoute("/_app/admin/classes/create")({
  component: CreateClassPage,
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

function CreateClassPage() {
  const navigate = useNavigate();
  const createClass = useConvexMutation(api.classes.adminCreateClass);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ClassStatus>("draft");
  const [scheduleSummary, setScheduleSummary] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedWeekdays, setSelectedWeekdays] = useState<Weekday[]>([]);

  function toggleWeekday(weekday: Weekday, checked: boolean) {
    setSelectedWeekdays((current) =>
      checked
        ? [...current, weekday]
        : current.filter((value) => value !== weekday),
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const classId = await createClass({
      title,
      status,
      scheduleSummary: scheduleSummary || undefined,
      location: location || undefined,
      capacity: capacity ? Number(capacity) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      weekdays: selectedWeekdays.length ? selectedWeekdays : undefined,
    });
    await navigate({
      to: "/admin/classes/$classId",
      params: { classId },
    });
  }

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Create Class</h1>
          <p className="text-muted-foreground">
            Add class details, then configure sessions and enrollments.
          </p>
        </div>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Class details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleCreate}>
              <div className="space-y-1">
                <Label htmlFor="class-title">Title</Label>
                <Input
                  id="class-title"
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
                <Label htmlFor="class-schedule">Schedule</Label>
                <Input
                  id="class-schedule"
                  value={scheduleSummary}
                  onChange={(event) => setScheduleSummary(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="class-location">Location</Label>
                <Input
                  id="class-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="class-capacity">Capacity</Label>
                <Input
                  id="class-capacity"
                  type="number"
                  min="0"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="class-start-date">Start date</Label>
                  <Input
                    id="class-start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="class-end-date">End date</Label>
                  <Input
                    id="class-end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="class-start-time">Start time</Label>
                  <Input
                    id="class-start-time"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="class-end-time">End time</Label>
                  <Input
                    id="class-end-time"
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Days</Label>
                <div className="grid grid-cols-2 gap-2">
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
              <Button type="submit" className="w-full">
                Create Class
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </RoleGate>
  );
}

import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Doc, Id } from "convex/_generated/dataModel";
import { FormEvent, useState } from "react";
import { DataTable } from "~/components/data-table";
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
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/admin/scheduling")({
  component: AdminSchedulingPage,
});

function AdminSchedulingPage() {
  const holidays = useConvexQuery(api.classes.adminListHolidays, {});
  const createHoliday = useConvexMutation(api.classes.adminCreateHoliday);
  const updateHoliday = useConvexMutation(api.classes.adminUpdateHoliday);
  const deleteHoliday = useConvexMutation(api.classes.adminDeleteHoliday);
  const [editingHoliday, setEditingHoliday] = useState<Id<"holidays"> | null>(
    null,
  );
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const columns: ColumnDef<Doc<"holidays">>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "startDate",
      header: "Start",
    },
    {
      accessorKey: "endDate",
      header: "End",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingHoliday(row.original._id);
              setName(row.original.name);
              setStartDate(row.original.startDate);
              setEndDate(row.original.endDate);
            }}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => deleteHoliday({ holiday: row.original._id })}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (editingHoliday) {
      await updateHoliday({
        holiday: editingHoliday,
        name,
        startDate,
        endDate,
      });
    } else {
      await createHoliday({ name, startDate, endDate });
    }
    setEditingHoliday(null);
    setName("");
    setStartDate("");
    setEndDate("");
  }

  return (
    <RoleGate allow="admin">
      <main className="mx-auto grid w-full max-w-6xl gap-4 p-4 lg:grid-cols-[22rem_1fr] lg:p-8">
        <Card className="rounded-lg lg:sticky lg:top-16 lg:h-min">
          <CardHeader>
            <CardTitle>
              {editingHoliday ? "Edit holiday" : "Add holiday"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <Label htmlFor="holiday-name">Name</Label>
                <Input
                  id="holiday-name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="holiday-start">Start date</Label>
                <Input
                  id="holiday-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="holiday-end">End date</Label>
                <Input
                  id="holiday-end"
                  type="date"
                  required
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                {editingHoliday ? "Save Holiday" : "Add Holiday"}
              </Button>
              {editingHoliday ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEditingHoliday(null);
                    setName("");
                    setStartDate("");
                    setEndDate("");
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>
        <section className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold">Scheduling</h1>
            <p className="text-muted-foreground">
              Holidays are skipped when generated class sessions are created.
            </p>
          </div>
          {holidays === undefined ? (
            <div className="flex min-h-40 items-center justify-center">
              <Spinner className="size-5" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={holidays}
              filterColumn="name"
              filterPlaceholder="Filter holidays..."
            />
          )}
        </section>
      </main>
    </RoleGate>
  );
}

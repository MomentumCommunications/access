import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Doc, Id } from "convex/_generated/dataModel";
import { FormEvent, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/admin/scheduling")({
  component: AdminSchedulingPage,
});

const seasonFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
  })
  .refine((values) => values.endDate >= values.startDate, {
    path: ["endDate"],
    message: "End date must be on or after the start date.",
  });

type SeasonFormValues = z.infer<typeof seasonFormSchema>;
type SeasonRow = {
  season: Doc<"seasons">;
  classCount: number;
};

const emptySeasonValues: SeasonFormValues = {
  name: "",
  startDate: "",
  endDate: "",
};

function AdminSchedulingPage() {
  return (
    <RoleGate allow="admin">
      <main className="mx-auto w-full max-w-6xl space-y-10 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Scheduling</h1>
          <p className="text-muted-foreground">
            Organize classes into seasons and configure dates excluded from
            generated sessions.
          </p>
        </div>
        <SeasonManager />
        <HolidayManager />
      </main>
    </RoleGate>
  );
}

function SeasonManager() {
  const seasons = useConvexQuery(api.classes.adminListSeasons, {});
  const createSeason = useConvexMutation(api.classes.adminCreateSeason);
  const updateSeason = useConvexMutation(api.classes.adminUpdateSeason);
  const deleteSeason = useConvexMutation(api.classes.adminDeleteSeason);
  const [editingSeason, setEditingSeason] = useState<Id<"seasons"> | null>(
    null,
  );
  const [seasonToDelete, setSeasonToDelete] = useState<SeasonRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const form = useForm<SeasonFormValues>({
    resolver: zodResolver(seasonFormSchema),
    defaultValues: emptySeasonValues,
    mode: "onTouched",
  });

  const columns: ColumnDef<SeasonRow>[] = [
    {
      accessorKey: "season.name",
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <Button asChild variant="link" className="h-auto p-0">
          <Link
            to="/admin/classes"
            search={{ season: row.original.season._id }}
          >
            {row.original.season.name}
          </Link>
        </Button>
      ),
    },
    {
      id: "dates",
      header: "Dates",
      cell: ({ row }) =>
        `${row.original.season.startDate} - ${row.original.season.endDate}`,
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
              const { season } = row.original;
              setEditingSeason(season._id);
              form.reset({
                name: season.name,
                startDate: season.startDate,
                endDate: season.endDate,
              });
            }}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSeasonToDelete(row.original)}
          >
            Delete
          </Button>
        </div>
      ),
    },
    {
      accessorKey: "classCount",
      header: "Classes",
    },
  ];

  function resetForm() {
    setEditingSeason(null);
    form.reset(emptySeasonValues);
  }

  async function handleSubmit(values: SeasonFormValues) {
    form.clearErrors("root");
    try {
      if (editingSeason) {
        await updateSeason({ season: editingSeason, ...values });
      } else {
        await createSeason(values);
      }
      resetForm();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "The season could not be saved. Please try again.",
      });
    }
  }

  async function handleDelete() {
    if (!seasonToDelete) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteSeason({ season: seasonToDelete.season._id });
      if (editingSeason === seasonToDelete.season._id) {
        resetForm();
      }
      setSeasonToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card className="rounded-lg lg:sticky lg:top-16 lg:h-min">
        <CardHeader>
          <CardTitle>
            {editingSeason ? "Edit season" : "Add season"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="season-name">Name</FieldLabel>
                    <Input
                      {...field}
                      id="season-name"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              {(["startDate", "endDate"] as const).map((name) => (
                <Controller
                  key={name}
                  name={name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`season-${name}`}>
                        {name === "startDate" ? "Start date" : "End date"}
                      </FieldLabel>
                      <Input
                        {...field}
                        id={`season-${name}`}
                        type="date"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              ))}
            </FieldGroup>
            {form.formState.errors.root?.message ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {form.formState.errors.root.message}
              </div>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Saving..."
                : editingSeason
                  ? "Save Season"
                  : "Add Season"}
            </Button>
            {editingSeason ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={resetForm}
              >
                Cancel
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>
      <div className="min-w-0 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Seasons</h2>
          <p className="text-sm text-muted-foreground">
            Class creation uses these date ranges as organizational periods.
          </p>
        </div>
        {seasons === undefined ? (
          <LoadingTable />
        ) : (
          <DataTable
            columns={columns}
            data={seasons}
            filterColumn="name"
            filterPlaceholder="Filter seasons..."
          />
        )}
      </div>
      <AlertDialog
        open={seasonToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setSeasonToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete season?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {seasonToDelete?.season.name} and disconnects its{" "}
              {seasonToDelete?.classCount || 0} linked classes. The classes
              themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete Season"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function HolidayManager() {
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

  function resetForm() {
    setEditingHoliday(null);
    setName("");
    setStartDate("");
    setEndDate("");
  }

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
    resetForm();
  }

  return (
    <section className="grid gap-4 border-t pt-10 lg:grid-cols-[22rem_1fr]">
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
                onClick={resetForm}
              >
                Cancel
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>
      <div className="min-w-0 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Holidays</h2>
          <p className="text-sm text-muted-foreground">
            Holidays are skipped when generated class sessions are created.
          </p>
        </div>
        {holidays === undefined ? (
          <LoadingTable />
        ) : (
          <DataTable
            columns={columns}
            data={holidays}
            filterColumn="name"
            filterPlaceholder="Filter holidays..."
          />
        )}
      </div>
    </section>
  );
}

function LoadingTable() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <Spinner className="size-5" />
    </div>
  );
}

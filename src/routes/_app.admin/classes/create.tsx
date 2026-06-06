import { createFileRoute } from "@tanstack/react-router";
import { ClassForm } from "~/components/class-form";
import { RoleGate } from "~/components/role-gate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const Route = createFileRoute("/_app/admin/classes/create")({
  component: CreateClassPage,
});

function CreateClassPage() {
  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Create Class</h1>
          <p className="text-muted-foreground">
            Add class details and configure its recurring schedule.
          </p>
        </div>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Class details</CardTitle>
          </CardHeader>
          <CardContent>
            <ClassForm mode="create" />
          </CardContent>
        </Card>
      </main>
    </RoleGate>
  );
}

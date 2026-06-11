import { createFileRoute } from "@tanstack/react-router";
import { PrivateForm } from "~/components/private-form";
import { RoleGate } from "~/components/role-gate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const Route = createFileRoute("/_app/admin/privates/create")({
  component: CreatePrivatePage,
});

function CreatePrivatePage() {
  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Add Private</h1>
          <p className="text-muted-foreground">
            Define the instructor, duration, and recurring schedule.
          </p>
        </div>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Private details</CardTitle>
          </CardHeader>
          <CardContent>
            <PrivateForm mode="create" />
          </CardContent>
        </Card>
      </main>
    </RoleGate>
  );
}

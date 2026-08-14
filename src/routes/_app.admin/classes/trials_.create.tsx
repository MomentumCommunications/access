import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminTrialForm } from "~/components/admin-trial-form";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export const Route = createFileRoute("/_app/admin/classes/trials_/create")({
  component: AdminCreateTrialPage,
});

function AdminCreateTrialPage() {
  return (
    <RoleGate allow="admin">
      <main className="mx-auto w-full max-w-3xl space-y-4 p-4 lg:p-8">
        <div className="space-y-1">
          <Button asChild variant="ghost" className="-ml-3">
            <Link to="/admin/classes/trials">Back to Trials</Link>
          </Button>
          <h1 className="text-3xl font-bold">Add trial</h1>
          <p className="text-muted-foreground">
            Create a paid trial request for an existing student.
          </p>
        </div>
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            <AdminTrialForm />
          </CardContent>
        </Card>
      </main>
    </RoleGate>
  );
}

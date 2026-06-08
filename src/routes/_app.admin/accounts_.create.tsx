import { createFileRoute } from "@tanstack/react-router";
import { AccountCreateForm } from "~/components/account-create-form";
import { RoleGate } from "~/components/role-gate";

export const Route = createFileRoute("/_app/admin/accounts_/create")({
  component: AdminCreateAccountPage,
});

function AdminCreateAccountPage() {
  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">New account</h1>
          <p className="text-muted-foreground">
            Add a client record that can be claimed during registration.
          </p>
        </div>
        <AccountCreateForm />
      </main>
    </RoleGate>
  );
}

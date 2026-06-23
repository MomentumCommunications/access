import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { AccountEditForm } from "~/components/account-edit-form";
import { RoleGate } from "~/components/role-gate";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute(
  "/_app/admin/accounts_/$userId_/edit",
)({
  component: AdminEditAccountPage,
});

function AdminEditAccountPage() {
  const { userId } = Route.useParams();
  const accountData = useConvexQuery(api.classes.adminGetAccount, {
    user: userId as Id<"users">,
  });
  const groups = useConvexQuery(api.etcFunctions.getGroups, {});

  return (
    <RoleGate allow="admin">
      {accountData === undefined || groups === undefined ? (
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      ) : !accountData ? (
        <main className="mx-auto max-w-3xl p-4 lg:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Account not found</CardTitle>
            </CardHeader>
          </Card>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 lg:p-8">
          <div>
            <h1 className="text-3xl font-bold">Edit account</h1>
            <p className="text-muted-foreground">
              Update profile details and access assignments.
            </p>
          </div>
          <AccountEditForm account={accountData.account} groups={groups} />
        </main>
      )}
    </RoleGate>
  );
}


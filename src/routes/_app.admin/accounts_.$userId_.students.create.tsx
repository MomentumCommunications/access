import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { AdminStudentCreateForm } from "~/components/student-create-form";
import { RoleGate } from "~/components/role-gate";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";
import { getAccountName } from "~/lib/account-name";

export const Route = createFileRoute(
  "/_app/admin/accounts_/$userId_/students/create",
)({
  component: CreateAccountStudentPage,
});

function CreateAccountStudentPage() {
  const { userId } = Route.useParams();
  const accountId = userId as Id<"users">;
  const accountData = useConvexQuery(api.classes.adminGetAccount, {
    user: accountId,
  });

  return (
    <RoleGate allow="admin">
      {accountData === undefined ? (
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      ) : accountData === null ? (
        <main className="mx-auto w-full max-w-2xl p-4 lg:p-8">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Account not found</CardTitle>
              <CardDescription>
                The student cannot be connected because this account no longer
                exists.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 lg:p-8">
          <div>
            <h1 className="text-3xl font-bold">Add Student</h1>
            <p className="text-muted-foreground">
              Create a student and connect them to{" "}
              {getAccountName(accountData.account)}.
            </p>
          </div>
          <AdminStudentCreateForm accountId={accountId} />
        </main>
      )}
    </RoleGate>
  );
}

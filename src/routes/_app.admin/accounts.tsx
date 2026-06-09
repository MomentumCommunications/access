import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Doc } from "convex/_generated/dataModel";
import { Plus } from "lucide-react";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { getAccountName } from "~/lib/account-name";
import { RoleDropdown } from "~/components/role-controls";
import { resolveUserRoles } from "~/lib/roles";

export const Route = createFileRoute("/_app/admin/accounts")({
  component: AdminAccountsPage,
});

function AdminAccountsPage() {
  const accounts = useConvexQuery(api.classes.adminListAccounts, {});
  const setRoles = useConvexMutation(api.classes.adminSetUserRoles);

  const columns: ColumnDef<Doc<"users">>[] = [
    {
      accessorFn: (account) => getAccountName(account),
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <Button asChild variant="link" className="h-auto p-0">
          <Link
            to="/admin/accounts/$userId"
            params={{ userId: row.original._id }}
          >
            {getAccountName(row.original)}
          </Link>
        </Button>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) =>
        Array.isArray(row.original.email)
          ? row.original.email.join(", ")
          : row.original.email || "Not set",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const roles = resolveUserRoles(row.original);
        return (
          <RoleDropdown
            roles={roles}
            onRolesChange={(nextRoles) =>
              void setRoles({ user: row.original._id, roles: nextRoles })
            }
          />
        );
      },
    },
  ];

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Accounts</h1>
            <p className="text-muted-foreground">
              Review user accounts and update sidebar access roles.
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/accounts/create">
              <Plus />
              New account
            </Link>
          </Button>
        </div>
        {accounts === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={accounts}
            filterColumn="name"
            filterPlaceholder="Filter accounts..."
          />
        )}
      </main>
    </RoleGate>
  );
}

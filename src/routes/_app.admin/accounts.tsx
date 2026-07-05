import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Doc } from "convex/_generated/dataModel";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { getAccountName } from "~/lib/account-name";
import { RoleDropdown } from "~/components/role-controls";
import { resolveUserRoles } from "~/lib/roles";
import { UserGroups } from "~/components/user-groups";
import {
  resolveAccountStatus,
  type AccountStatus,
} from "../../../shared/account-status";

export const Route = createFileRoute("/_app/admin/accounts")({
  component: AdminAccountsPage,
});

type AccountStatusFilter = AccountStatus | "all";

function AdminAccountsPage() {
  const accounts = useConvexQuery(api.classes.adminListAccounts, {});
  const setRoles = useConvexMutation(api.classes.adminSetUserRoles);
  const [statusFilter, setStatusFilter] =
    useState<AccountStatusFilter>("active");

  const filteredAccounts = useMemo(() => {
    if (!accounts) return accounts;
    if (statusFilter === "all") return accounts;
    return accounts.filter(
      (account) => resolveAccountStatus(account.status) === statusFilter,
    );
  }, [accounts, statusFilter]);

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
      accessorFn: (account) => resolveAccountStatus(account.status),
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = resolveAccountStatus(row.original.status);
        return (
          <Badge variant={status === "active" ? "secondary" : "outline"}>
            {status === "active" ? "Active" : "Inactive"}
          </Badge>
        );
      },
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
    {
      accessorKey: "group",
      header: "Group",
      cell: ({ row }) => {
        const groups = useConvexQuery(api.etcFunctions.getGroups, {});

        return <UserGroups user={row.original} groups={groups} />;
      },
    },
  ];

  return (
    <RoleGate allow="admin">
      <main className="flex min-w-0 w-full max-w-full flex-col gap-4 overflow-hidden p-4 lg:p-8">
        <div className="flex min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">Accounts</h1>
            <p className="break-words text-muted-foreground">
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
            data={filteredAccounts ?? []}
            filterColumn="name"
            filterPlaceholder="Filter accounts..."
            toolbar={
              <div className="flex min-w-0 max-w-full items-center gap-2">
                <span className="shrink-0 text-sm text-muted-foreground">
                  Status
                </span>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as AccountStatusFilter)
                  }
                >
                  <SelectTrigger className="h-9 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="all">All statuses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          />
        )}
      </main>
    </RoleGate>
  );
}

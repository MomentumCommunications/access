import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Doc, Id } from "convex/_generated/dataModel";
import { ArrowUpDown, Copy, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { resolveUserRoles, type UserRole } from "~/lib/roles";
import { UserGroups } from "~/components/user-groups";
import { formatDateTime } from "~/lib/date-utils";
import {
  resolveAccountStatus,
  type AccountStatus,
} from "../../../shared/account-status";

export const Route = createFileRoute("/_app/admin/accounts")({
  component: AdminAccountsPage,
});

type AccountStatusFilter = AccountStatus | "all";
type AccountRoleFilter = UserRole | "all";

function AdminAccountsPage() {
  const accounts = useConvexQuery(api.classes.adminListAccounts, {});
  const groups = useConvexQuery(api.etcFunctions.getGroups, {});
  const setRoles = useConvexMutation(api.classes.adminSetUserRoles);
  const [statusFilter, setStatusFilter] =
    useState<AccountStatusFilter>("active");
  const [roleFilter, setRoleFilter] = useState<AccountRoleFilter>("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");

  const filteredAccounts = useMemo(() => {
    if (!accounts) return accounts;
    const normalizedNameFilter = nameFilter.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesStatus =
        statusFilter === "all" ||
        resolveAccountStatus(account.status) === statusFilter;
      const matchesRole =
        roleFilter === "all" || resolveUserRoles(account).includes(roleFilter);
      const matchesGroup =
        groupFilter === "all" ||
        account.group?.includes(groupFilter as Id<"groups">);
      const matchesName =
        normalizedNameFilter.length === 0 ||
        getAccountName(account).toLowerCase().includes(normalizedNameFilter);

      return matchesStatus && matchesRole && matchesGroup && matchesName;
    });
  }, [accounts, groupFilter, nameFilter, roleFilter, statusFilter]);

  const filteredEmails = useMemo(() => {
    const emails = (filteredAccounts || []).flatMap((account) =>
      (Array.isArray(account.email) ? account.email : [account.email]).flatMap(
        (email) => {
          const value = email?.trim();
          return value ? [value] : [];
        },
      ),
    );
    return [...new Map(emails.map((email) => [email.toLowerCase(), email])).values()];
  }, [filteredAccounts]);

  async function copyEmails() {
    try {
      await navigator.clipboard.writeText(filteredEmails.join("\n"));
      toast.success(
        `${filteredEmails.length} ${filteredEmails.length === 1 ? "email" : "emails"} copied.`,
      );
    } catch {
      toast.error("The email addresses could not be copied.");
    }
  }

  const columns: ColumnDef<Doc<"users">>[] = [
    {
      accessorFn: (account) => getAccountName(account),
      id: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
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
      accessorKey: "_creationTime",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatDateTime(row.original._creationTime)}
        </span>
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
        return <UserGroups user={row.original} groups={groups} />;
      },
    },
  ];

  return (
    <RoleGate allow="admin">
      <main className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-hidden p-4 lg:p-8">
        <div className="flex min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">Accounts</h1>
            <p className="wrap-break-words text-muted-foreground">
              Review user accounts and update sidebar access roles.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={filteredEmails.length === 0}
              onClick={() => void copyEmails()}
            >
              <Copy />
              Copy emails
            </Button>
            <Button asChild className="flex-1 sm:flex-none">
              <Link to="/admin/accounts/create">
                <Plus />
                New account
              </Link>
            </Button>
          </div>
        </div>
        {accounts === undefined ? (
          <div className="min-h-40 flex items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredAccounts ?? []}
            filterColumn="name"
            filterPlaceholder="Filter accounts..."
            filterValue={nameFilter}
            onFilterValueChange={setNameFilter}
            toolbar={
              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-2">
                  <Select
                    value={roleFilter}
                    onValueChange={(value) =>
                      setRoleFilter(value as AccountRoleFilter)
                    }
                  >
                    <SelectTrigger className="h-9 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger className="h-9 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All groups</SelectItem>
                      {groups?.map((group) => (
                        <SelectItem key={group._id} value={group._id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            }
          />
        )}
      </main>
    </RoleGate>
  );
}

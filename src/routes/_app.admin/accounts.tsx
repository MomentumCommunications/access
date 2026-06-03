import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Doc } from "convex/_generated/dataModel";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/admin/accounts")({
  component: AdminAccountsPage,
});

type Role = "admin" | "staff" | "member";

function AdminAccountsPage() {
  const accounts = useConvexQuery(api.classes.adminListAccounts, {});
  const setRole = useConvexMutation(api.classes.adminSetUserRole);

  const columns: ColumnDef<Doc<"users">>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Button asChild variant="link" className="h-auto p-0">
          <Link
            to="/admin/accounts/$userId"
            params={{ userId: row.original._id }}
          >
            {row.original.name || "Unnamed"}
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
      cell: ({ row }) => (
        <Select
          value={row.original.role || "member"}
          onValueChange={(role) =>
            setRole({ user: row.original._id, role: role as Role })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">
            Review user accounts and update sidebar access roles.
          </p>
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

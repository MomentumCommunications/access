import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { AddGroup } from "~/components/add-group";
import { EditGroup } from "~/components/edit-group";
import { RoleGate } from "~/components/role-gate";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/admin/groups")({
  component: AdminGroupsPage,
});

function AdminGroupsPage() {
  const groups = useConvexQuery(api.etcFunctions.getGroups, {});

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Groups</h1>
            <p className="text-muted-foreground">
              Manage student grouping, class visibility, and staff-managed
              enrollment settings.
            </p>
          </div>
          <AddGroup />
        </div>

        {groups === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : groups.length === 0 ? (
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>No groups yet</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Create a group to gate classes or mark enrollment as
              staff-managed.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <Card key={group._id} className="rounded-lg">
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{group.name}</CardTitle>
                      {group.info ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {group.info}
                        </p>
                      ) : null}
                    </div>
                    <EditGroup group={group} />
                  </div>
                </CardHeader>
                <CardContent>
                  {group.managedEnrollment ? (
                    <Badge variant="secondary">Managed enrollment</Badge>
                  ) : (
                    <Badge variant="outline">Self-service allowed</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </RoleGate>
  );
}

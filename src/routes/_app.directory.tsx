import {
  convexQuery,
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { CircleSlash } from "lucide-react";
import Delayed from "~/components/delayed";
import { EditGroup } from "~/components/edit-group";
import { AddGroup } from "~/components/add-group";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { UserGroups } from "~/components/user-groups";
import { RoleDropdown } from "~/components/role-controls";
import { hasUserRole, resolveUserRoles } from "~/lib/roles";

export const Route = createFileRoute("/_app/directory")({
  component: RouteComponent,
});

function RouteComponent() {
  const convexUser = useConvexQuery(api.users.current, {});

  const { data: users, isLoading } = useQuery({
    ...convexQuery(api.users.getUsers, {}),
  });

  const groups = useConvexQuery(api.etcFunctions.getGroups, {});

  // function sortUsers(users: any) {
  //   return users.sort((a: any, b: any) => {
  //     if (a.name < b.name) return -1;
  //     if (a.name > b.name) return 1;
  //     return 0;
  //   });
  // }

  const setRoles = useConvexMutation(api.classes.adminSetUserRoles);

  if (!convexUser) {
    return (
      <div className="flex h-[80vh] justify-center py-4 lg:py-8 items-center">
        <div className="flex flex-col gap-4 max-w-4xl justify-start px-4 w-full">
          <h1 className="text-2xl font-bold lg:text-4xl">Directory</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasUserRole(convexUser, "admin")) {
    return (
      <Delayed>
        <div className="flex h-[80vh] justify-center py-4 lg:py-8 items-center">
          <Alert className="max-w-md">
            <CircleSlash />
            <AlertTitle>Unauthorized</AlertTitle>
            <AlertDescription>
              You are not authorized to view this page.
            </AlertDescription>
            <AlertDescription>
              <div className="py-2">
                <Button asChild variant="outline">
                  <a href="/home">Go Home</a>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </Delayed>
    );
  }

  return (
    <div className="flex justify-center py-4 lg:py-8 items-center">
      <div className="flex flex-col gap-4 max-w-4xl justify-start px-4 w-full">
        <h1 className="text-2xl font-bold lg:text-4xl">Directory</h1>
        <section>
          <h2 className="text-xl font-bold">Groups</h2>
          <div className="flex gap-2 py-2">
            <AddGroup />
            {groups &&
              groups.map((group) => (
                <EditGroup key={group._id} group={group} />
              ))}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-bold">People</h2>
          {isLoading && (
            <>
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-8 w-1/2" />
            </>
          )}
          {users && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25px]">PFP</TableHead>
                  <TableHead className="w-[100px]">Name</TableHead>
                  <TableHead className="w-[100px]">Display Name</TableHead>
                  <TableHead className="w-[100px] translate-x-3">
                    Role
                  </TableHead>
                  <TableHead className="w-[100px]">Groups</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell className="font-medium">
                      <img
                        className="h-8 w-8 rounded-full"
                        src={user.image}
                        alt={user.name}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="font-medium">
                      {user.displayName}
                    </TableCell>
                    <TableCell className="font-medium">
                      <RoleDropdown
                        roles={resolveUserRoles(user)}
                        onRolesChange={(roles) =>
                          void setRoles({ user: user._id, roles })
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <UserGroups groups={groups} user={user} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}

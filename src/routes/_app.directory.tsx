import { useUser } from "@clerk/tanstack-react-start";
import {
  convexQuery,
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { CircleSlash } from "lucide-react";
import Delayed from "~/components/delayed";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/_app/directory")({
  component: RouteComponent,
});

function RouteComponent() {
  const user = useUser();

  const convexUser = useConvexQuery(api.users.getUserByClerkId, {
    ClerkId: user.user?.id,
  });

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

  const roleMutation = useConvexMutation(api.etcFunctions.setRole);

  function setRole(user: Id<"users">, role: "admin" | "staff" | "member") {
    roleMutation({ user: user, role });
  }

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

  if (convexUser?.role !== "admin") {
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
                <TableHead className="w-[100px]">Name</TableHead>
                <TableHead className="w-[100px]">Display Name</TableHead>
                <TableHead className="w-[100px]">Role</TableHead>
                <TableHead className="w-[100px]">Groups</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user._id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="font-medium">
                    {user.displayName}
                  </TableCell>
                  <TableCell className="font-medium">
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="-translate-x-3"
                        >
                          <span
                            className={cn(
                              "capitalize",
                              !user.role && "text-muted-foreground",
                            )}
                          >
                            {user.role || "Unassigned"}
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Role</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setRole(user._id, "admin")}
                        >
                          Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setRole(user._id, "staff")}
                        >
                          Staff
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setRole(user._id, "member")}
                        >
                          Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell className="font-medium">
                    <UserGroups groups={groups} user={user} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

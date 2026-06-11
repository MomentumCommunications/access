import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { PrivateForm } from "~/components/private-form";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute(
  "/_app/admin/privates/$privateId_/edit",
)({
  component: EditPrivatePage,
});

function EditPrivatePage() {
  const { privateId } = Route.useParams();
  const data = useConvexQuery(api.privates.getPrivate, { privateId });

  return (
    <RoleGate allow="admin">
      {data === undefined ? (
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      ) : (
        <main className="mx-auto w-full max-w-3xl space-y-4 p-4 lg:p-8">
          <div className="space-y-1">
            <Button asChild variant="ghost" className="-ml-3">
              <Link
                to="/admin/privates/$privateId"
                params={{ privateId }}
              >
                Back to Private
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Edit private</h1>
            <p className="text-muted-foreground">
              Update the default roster, instructor, and recurring schedule.
            </p>
          </div>
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Private details</CardTitle>
            </CardHeader>
            <CardContent>
              <PrivateForm
                mode="edit"
                privateId={data.private._id}
                privateSeries={data.private}
              />
            </CardContent>
          </Card>
        </main>
      )}
    </RoleGate>
  );
}

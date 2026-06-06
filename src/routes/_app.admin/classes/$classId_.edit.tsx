import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ClassForm } from "~/components/class-form";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/admin/classes/$classId_/edit")({
  component: AdminClassEditPage,
});

function AdminClassEditPage() {
  const { classId } = Route.useParams();
  const classData = useConvexQuery(api.classes.adminGetClass, {
    classId: classId as Id<"classes">,
  });

  return (
    <RoleGate allow="admin">
      {classData === undefined ? (
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      ) : !classData ? (
        <main className="mx-auto max-w-3xl p-4 lg:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Class not found</CardTitle>
            </CardHeader>
          </Card>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-3xl space-y-4 p-4 lg:p-8">
          <div className="space-y-1">
            <Button asChild variant="ghost" className="-ml-3">
              <Link to="/admin/classes/$classId" params={{ classId }}>
                Back to Class
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Edit class</h1>
            <p className="text-muted-foreground">
              Update the class details and recurring schedule.
            </p>
          </div>
          <Card className="rounded-lg">
            <CardContent className="pt-6">
              <ClassForm
                mode="edit"
                classId={classData.classItem._id}
                classItem={classData.classItem}
              />
            </CardContent>
          </Card>
        </main>
      )}
    </RoleGate>
  );
}

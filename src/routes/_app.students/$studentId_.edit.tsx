import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { StudentEditForm } from "~/components/student-edit-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/students/$studentId_/edit")({
  component: EditStudentPage,
});

function EditStudentPage() {
  const { studentId } = Route.useParams();
  const studentData = useConvexQuery(api.classes.getMyStudent, {
    student: studentId as Id<"students">,
  });

  if (studentData === undefined) {
    return (
      <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
        <Spinner className="size-5" />
      </main>
    );
  }

  if (!studentData) {
    return (
      <main className="mx-auto max-w-3xl p-4 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Student not found</CardTitle>
            <CardDescription>
              This student is not connected to your account.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Edit Student</h1>
        <p className="text-muted-foreground">
          Update profile details and photo.
        </p>
      </div>
      <StudentEditForm
        mode="member"
        student={studentData.student}
        photoUrl={studentData.photoUrl}
        backTo={`/students/${studentData.student._id}`}
      />
    </main>
  );
}

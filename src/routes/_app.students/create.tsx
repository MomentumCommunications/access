import { createFileRoute } from "@tanstack/react-router";
import { MemberStudentCreateForm } from "~/components/student-create-form";

export const Route = createFileRoute("/_app/students/create")({
  component: CreateStudentPage,
});

function CreateStudentPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Add Student</h1>
        <p className="text-muted-foreground">
          Create one profile per student before requesting class spots.
        </p>
      </div>
      <MemberStudentCreateForm />
    </main>
  );
}

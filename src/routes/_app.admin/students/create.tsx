import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "~/components/role-gate";
import { AdminStudentCreateForm } from "~/components/student-create-form";

export const Route = createFileRoute("/_app/admin/students/create")({
  component: CreateStudentPage,
});

function CreateStudentPage() {
  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Add Student</h1>
          <p className="text-muted-foreground">
            Create a student profile before linking contacts or enrollments.
          </p>
        </div>
        <AdminStudentCreateForm />
      </main>
    </RoleGate>
  );
}

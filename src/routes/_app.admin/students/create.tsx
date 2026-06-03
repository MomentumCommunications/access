import { useConvexMutation } from "@convex-dev/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { FormEvent, useState } from "react";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export const Route = createFileRoute("/_app/admin/students/create")({
  component: CreateStudentPage,
});

function CreateStudentPage() {
  const navigate = useNavigate();
  const createStudent = useConvexMutation(api.classes.adminCreateStudent);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await createStudent({
      firstName,
      lastName,
      preferredName: preferredName || undefined,
      dateOfBirth: dateOfBirth || undefined,
    });
    await navigate({ to: "/admin/students" });
  }

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Add Student</h1>
          <p className="text-muted-foreground">
            Create a student profile before linking contacts or enrollments.
          </p>
        </div>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Student details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleCreate}>
              <div className="space-y-1">
                <Label htmlFor="student-first">First name</Label>
                <Input
                  id="student-first"
                  required
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="student-last">Last name</Label>
                <Input
                  id="student-last"
                  required
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="student-preferred">Preferred name</Label>
                <Input
                  id="student-preferred"
                  value={preferredName}
                  onChange={(event) => setPreferredName(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="student-birthday">Birthday</Label>
                <Input
                  id="student-birthday"
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Add Student
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </RoleGate>
  );
}

import { useConvexMutation } from "@convex-dev/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export const Route = createFileRoute("/_app/students/create")({
  component: CreateStudentPage,
});

function CreateStudentPage() {
  const navigate = useNavigate();
  const createStudent = useConvexMutation(
    api.classes.createStudentForCurrentUser,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [relationship, setRelationship] = useState("");

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await createStudent({
      firstName,
      lastName,
      preferredName: preferredName || undefined,
      dateOfBirth: dateOfBirth || undefined,
      relationship: relationship || undefined,
    });
    await navigate({ to: "/students" });
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Add Student</h1>
        <p className="text-muted-foreground">
          Create one profile per student before requesting class spots.
        </p>
      </div>
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Student details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleCreate}>
            <div className="space-y-1">
              <Label htmlFor="member-student-first">First name</Label>
              <Input
                id="member-student-first"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="member-student-last">Last name</Label>
              <Input
                id="member-student-last"
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="member-student-preferred">Preferred name</Label>
              <Input
                id="member-student-preferred"
                value={preferredName}
                onChange={(event) => setPreferredName(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="member-student-birthday">Birthday</Label>
              <Input
                id="member-student-birthday"
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="member-student-relationship">Relationship</Label>
              <Input
                id="member-student-relationship"
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" asChild>
                <Link to="/students">Cancel</Link>
              </Button>
              <Button type="submit">Add Student</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

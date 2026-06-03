import { useConvexMutation } from "@convex-dev/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

type StudentStatus = "active" | "inactive" | "archived";

type StudentEditFormProps = {
  mode: "admin" | "member";
  student: Doc<"students">;
  photoUrl?: string | null;
  backTo: string;
};

export function StudentEditForm({
  mode,
  student,
  photoUrl,
  backTo,
}: StudentEditFormProps) {
  const navigate = useNavigate();
  const generateUploadUrl = useConvexMutation(
    api.classes.generateStudentPhotoUploadUrl,
  );
  const updateMyStudent = useConvexMutation(api.classes.updateMyStudent);
  const adminUpdateStudent = useConvexMutation(api.classes.adminUpdateStudent);
  const [firstName, setFirstName] = useState(student.firstName);
  const [lastName, setLastName] = useState(student.lastName);
  const [preferredName, setPreferredName] = useState(
    student.preferredName || "",
  );
  const [dateOfBirth, setDateOfBirth] = useState(student.dateOfBirth || "");
  const [notes, setNotes] = useState(student.notes || "");
  const [status, setStatus] = useState<StudentStatus>(student.status);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const previewUrl = useMemo(
    () => (selectedPhoto ? URL.createObjectURL(selectedPhoto) : null),
    [selectedPhoto],
  );
  const displayedPhoto = previewUrl || photoUrl;

  async function uploadPhoto() {
    if (!selectedPhoto) {
      return undefined;
    }

    const postUrl = await generateUploadUrl({});
    const result = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": selectedPhoto.type || "image/jpeg" },
      body: selectedPhoto,
    });

    if (!result.ok) {
      throw new Error("Photo upload failed");
    }

    const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
    return storageId;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const photo = await uploadPhoto();
      const updates = {
        student: student._id,
        firstName,
        lastName,
        preferredName: preferredName || undefined,
        dateOfBirth: dateOfBirth || undefined,
        notes: notes || undefined,
        status,
        ...(photo ? { photo } : {}),
      };

      if (mode === "admin") {
        await adminUpdateStudent(updates);
      } else {
        await updateMyStudent(updates);
      }

      await navigate({ to: backTo as never });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Student could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Student details</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {displayedPhoto ? (
                <img
                  src={displayedPhoto}
                  alt={`${firstName} ${lastName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-semibold text-muted-foreground">
                  {firstName.slice(0, 1)}
                  {lastName.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="w-full space-y-1">
              <Label htmlFor="student-photo">Photo</Label>
              <Input
                id="student-photo"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setSelectedPhoto(event.target.files?.[0] || null)
                }
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>

          <div className="space-y-1">
            <Label htmlFor="student-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as StudentStatus)}
            >
              <SelectTrigger id="student-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="student-notes">Notes</Label>
            <Textarea
              id="student-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" asChild>
              <Link to={backTo as never}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Student"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

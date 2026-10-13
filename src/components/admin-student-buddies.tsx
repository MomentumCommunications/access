import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Eye, FileText, Pencil, Upload, UserPlus, Users } from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  buddySheetFileName,
  validateBuddySheetFile,
} from "../../shared/buddy-sheets";
import { PdfEmbed } from "~/components/pdf-embed";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";

type StudentData = NonNullable<
  FunctionReturnType<typeof api.classes.adminGetStudent>
>;
type Connection = StudentData["buddies"][number];

function uploadPdf(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
) {
  return new Promise<Id<"_storage">>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.setRequestHeader("Content-Type", "application/pdf");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () =>
      reject(new Error("PDF upload failed. Please try again."));
    request.onabort = () => reject(new Error("PDF upload was cancelled."));
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("PDF upload failed. Please try again."));
        return;
      }
      try {
        const result = JSON.parse(request.responseText) as {
          storageId?: Id<"_storage">;
        };
        if (!result.storageId)
          throw new Error("The upload did not return a file ID.");
        resolve(result.storageId);
      } catch {
        reject(new Error("Unable to read the PDF upload response."));
      }
    };
    request.send(file);
  });
}

export function AdminStudentBuddies({
  studentData,
}: {
  studentData: StudentData;
}) {
  const { student, buddies } = studentData;
  const generateUploadUrl = useConvexMutation(
    api.classes.adminGenerateBuddySheetUploadUrl,
  );
  const saveSheet = useConvexMutation(api.classes.adminSaveBuddySheet);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorTrigger = useRef<HTMLButtonElement>(null);
  const uploadInProgress = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);
  const [savingConnection, setSavingConnection] = useState(false);
  const fileName = buddySheetFileName(student.buddySheetFileName);

  async function handleUpload(file: File) {
    if (uploadInProgress.current) return;
    const error = validateBuddySheetFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    const expectedStorageId = student.buddySheet || null;
    uploadInProgress.current = true;
    setUploading(true);
    setProgress(0);
    try {
      const url = await generateUploadUrl({ student: student._id });
      const storageId = await uploadPdf(url, file, setProgress);
      await saveSheet({
        student: student._id,
        storageId,
        fileName: file.name,
        expectedStorageId,
      });
      toast.success("Buddy sheet uploaded.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to upload buddy sheet.",
      );
    } finally {
      uploadInProgress.current = false;
      setUploading(false);
    }
  }

  return (
    <section className="space-y-4">
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-2">
              <CardTitle>Buddy sheet</CardTitle>
              <CardDescription className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0" />
                <span className="break-all">
                  {student.buddySheet ? fileName : "No buddy sheet uploaded"}
                </span>
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {student.buddySheet ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Eye />
                      View
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="h-[90vh] overflow-y-auto max-w-[90vw]">
                    <DialogHeader>
                      <DialogTitle className="break-all pr-6">
                        {fileName}
                      </DialogTitle>
                      <DialogDescription>
                        Buddy sheet for {student.firstName} {student.lastName}.
                      </DialogDescription>
                    </DialogHeader>
                    <PdfEmbed
                      storageId={student.buddySheet}
                      studentId={student._id}
                      title={fileName}
                      embedClassName="h-[min(1200px,90vh)]"
                    />
                  </DialogContent>
                </Dialog>
              ) : null}
              <Button
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? <Spinner aria-hidden="true" /> : <Upload />}
                {uploading
                  ? "Uploading..."
                  : student.buddySheet
                    ? "Upload new PDF"
                    : "Upload PDF"}
              </Button>
              <input
                ref={fileInput}
                className="hidden"
                type="file"
                accept=".pdf,application/pdf"
                aria-label="Upload buddy sheet PDF"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleUpload(file);
                }}
              />
            </div>
          </div>
        </CardHeader>
        {uploading ? (
          <CardContent>
            <div role="status" className="space-y-2 text-sm">
              <p>
                {progress === 100
                  ? "Saving buddy sheet..."
                  : `Uploading PDF: ${progress}%`}
              </p>
              <progress
                className="h-2 w-full"
                aria-label="PDF upload progress"
                value={progress}
                max={100}
              />
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!savingConnection) setEditorOpen(open);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Connections</h2>
          <DialogTrigger asChild>
            <Button
              onClick={(event) => {
                editorTrigger.current = event.currentTarget;
                setEditing(null);
              }}
            >
              <UserPlus />
              Add connection
            </Button>
          </DialogTrigger>
        </div>
        {buddies.length === 0 ? (
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>No buddy connections</CardTitle>
              <CardDescription>
                Add a student to connect them as buddies.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          buddies.map((connection) => {
            const buddy = connection.buddyProfile;
            const name = buddy
              ? `${buddy.firstName} ${buddy.lastName}`
              : "Buddy unavailable";
            return (
              <Card key={connection._id} className="w-full min-w-0 rounded-lg">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-12">
                        <AvatarImage
                          src={buddy?.photoUrl || undefined}
                          alt={name}
                          className="object-cover"
                        />
                        <AvatarFallback>
                          {buddy ? (
                            `${buddy.firstName.slice(0, 1)}${buddy.lastName.slice(0, 1)}`
                          ) : (
                            <Users className="size-5" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="break-words">
                          {buddy ? (
                            <Link
                              className="hover:underline"
                              to="/admin/students/$studentId"
                              params={{ studentId: connection.buddyId }}
                            >
                              {name}
                            </Link>
                          ) : (
                            name
                          )}
                        </CardTitle>
                        {buddy?.preferredName ? (
                          <CardDescription className="break-words">
                            Preferred name: {buddy.preferredName}
                          </CardDescription>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          {connection.year ? (
                            <span className="text-muted-foreground text-sm">
                              {connection.year}
                            </span>
                          ) : null}
                          <Badge
                            variant={
                              connection.current ? "secondary" : "outline"
                            }
                          >
                            {connection.current ? "Current" : "Past"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="self-start"
                        aria-label={`Edit connection with ${name}`}
                        onClick={(event) => {
                          editorTrigger.current = event.currentTarget;
                          setEditing(connection);
                        }}
                      >
                        <Pencil />
                        Edit
                      </Button>
                    </DialogTrigger>
                  </div>
                </CardHeader>
                {connection.notes || !buddy ? (
                  <CardContent className="space-y-2">
                    {connection.notes ? (
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">
                        {connection.notes}
                      </p>
                    ) : null}
                    {!buddy ? (
                      <p className="text-muted-foreground text-sm">
                        This student’s profile is no longer available. Edit the
                        connection to choose another student.
                      </p>
                    ) : null}
                  </CardContent>
                ) : null}
              </Card>
            );
          })
        )}
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-lg"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editorTrigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit buddy connection" : "Add buddy connection"}
            </DialogTitle>
            <DialogDescription>
              Connect a buddy with {student.firstName} {student.lastName}.
              Changes apply to both students.
            </DialogDescription>
          </DialogHeader>
          {editorOpen ? (
            <BuddyConnectionForm
              key={editing?._id || "new"}
              studentData={studentData}
              connection={editing}
              saving={savingConnection}
              onSavingChange={setSavingConnection}
              onClose={() => setEditorOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function BuddyConnectionForm({
  studentData,
  connection,
  saving,
  onSavingChange,
  onClose,
}: {
  studentData: StudentData;
  connection: Connection | null;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onClose: () => void;
}) {
  const candidates = useConvexQuery(api.classes.adminListBuddyCandidates, {});
  const createConnection = useConvexMutation(
    api.classes.adminCreateBuddyConnection,
  );
  const updateConnection = useConvexMutation(
    api.classes.adminUpdateBuddyConnection,
  );
  const [buddyId, setBuddyId] = useState<string>(connection?.buddyId || "");
  const [year, setYear] = useState(connection?.year || "");
  const [notes, setNotes] = useState(connection?.notes || "");
  const [current, setCurrent] = useState(connection?.current ?? true);
  const options = useMemo(() => {
    const connectedIds = new Set(studentData.buddies.map((row) => row.buddyId));
    return (candidates || [])
      .filter(
        (row) =>
          row._id !== studentData.student._id &&
          (!connectedIds.has(row._id) || row._id === connection?.buddyId),
      )
      .map((row) => ({
        value: row._id,
        label: `${row.firstName} ${row.lastName}${row.preferredName ? ` (${row.preferredName})` : ""} · ${row.status}`,
      }));
  }, [candidates, studentData, connection]);
  const selectedAvailable = options.some((option) => option.value === buddyId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !selectedAvailable) return;
    onSavingChange(true);
    try {
      const values = {
        student: studentData.student._id,
        buddy: buddyId as Id<"students">,
        year: year.trim() || undefined,
        notes: notes.trim() || undefined,
        current,
      };
      if (connection)
        await updateConnection({ ...values, connection: connection._id });
      else await createConnection(values);
      toast.success(
        connection ? "Buddy connection updated." : "Buddy connection added.",
      );
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save buddy connection.",
      );
    } finally {
      onSavingChange(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="buddy-student">Buddy</Label>
        <Combobox
          items={options.map((option) => option.value)}
          value={selectedAvailable ? buddyId : null}
          onValueChange={(value) => setBuddyId(value || "")}
          itemToStringLabel={(value) =>
            options.find((option) => option.value === value)?.label || ""
          }
          disabled={saving}
        >
          <ComboboxInput
            id="buddy-student"
            className="w-full"
            showClear
            disabled={saving || candidates === undefined}
            placeholder={
              candidates === undefined
                ? "Loading students..."
                : "Search students"
            }
          />
          <ComboboxContent>
            <ComboboxEmpty>No available students found.</ComboboxEmpty>
            <ComboboxList>
              {(value: string) => (
                <ComboboxItem key={value} value={value}>
                  {options.find((option) => option.value === value)?.label ||
                    value}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {connection && !connection.buddyProfile ? (
          <p className="text-muted-foreground text-sm">
            Choose a replacement for the unavailable student.
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor="buddy-year">Year (optional)</Label>
        <Input
          id="buddy-year"
          value={year}
          onChange={(event) => setYear(event.target.value)}
          disabled={saving}
          maxLength={80}
          placeholder="e.g. 2026–2027"
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="buddy-current"
          checked={current}
          disabled={saving}
          onCheckedChange={(value) => setCurrent(value === true)}
        />
        <Label htmlFor="buddy-current">Current connection</Label>
      </div>
      <div className="space-y-1">
        <Label htmlFor="buddy-notes">Notes (optional)</Label>
        <Textarea
          id="buddy-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={saving}
          maxLength={5000}
          className="min-h-28"
          aria-describedby="buddy-notes-help"
        />
        <p id="buddy-notes-help" className="text-muted-foreground text-sm">
          These notes are visible to members for both students.
        </p>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !selectedAvailable}>
          {saving ? <Spinner aria-hidden="true" /> : null}
          {saving ? "Saving..." : "Save connection"}
        </Button>
      </DialogFooter>
    </form>
  );
}

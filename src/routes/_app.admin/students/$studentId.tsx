import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeft,
  ChartPie,
  Check,
  GraduationCap,
  History,
  Mail,
  NotebookText,
  Pencil,
  ShieldCheck,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Spinner } from "~/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import {
  formatAge,
  formatDateTime,
  formatMDYYYY,
  formatTimeRange,
} from "~/lib/date-utils";
import { getAccountName } from "~/lib/account-name";
import {
  requiresStudentStatusConfirmation,
  type StudentStatus,
} from "../../../../shared/student-status";

export const Route = createFileRoute("/_app/admin/students/$studentId")({
  component: AdminStudentDetailPage,
});

type EnrollmentStatus =
  | "pending"
  | "enrolled"
  | "waitlisted"
  | "dropped"
  | "declined";
type BillingTreatment = "" | "prorate" | "full";

type AdminStudentData = NonNullable<
  FunctionReturnType<typeof api.classes.adminGetStudent>
>;
type EnrollmentRow = AdminStudentData["enrollments"][number];
type StudentTabValue = "contacts" | "enrollments" | "notes" | "logs";

const studentTabTriggerClass =
  "data-[state=active]:border-primary relative h-10 flex-none rounded-none border-x-0 border-b-2 border-t-0 border-transparent bg-transparent px-0 pb-3 pt-2 shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent";

function todayValue() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatWeeklyHours(weeklyMinutes: number) {
  const hours = weeklyMinutes / 60;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(hours)} ${hours === 1 ? "hour" : "hours"}`;
}

function formatClassOptionLabel(
  classItem: FunctionReturnType<
    typeof api.classes.adminListClasses
  >[number]["classItem"],
) {
  const schedule =
    classItem.scheduleSummary ||
    [
      [classItem.startDate, classItem.endDate].filter(Boolean).join(" - "),
      formatTimeRange(classItem.startTime, classItem.endTime),
    ]
      .filter(Boolean)
      .join(" · ");

  return schedule ? `${classItem.title} · ${schedule}` : classItem.title;
}

function formatEmail(email?: string | string[]) {
  if (Array.isArray(email)) return email.join(", ");
  return email || "Email not set";
}

function formatEventType(eventType: string) {
  return eventType
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

const enrollmentColumns: ColumnDef<EnrollmentRow>[] = [
  {
    accessorFn: (row) => row.classItem?.title || "",
    id: "class",
    header: "Class",
    cell: ({ row }) =>
      row.original.classItem ? (
        <Button asChild variant="link" className="h-auto p-0">
          <Link
            to="/admin/classes/$classId"
            params={{ classId: row.original.classItem._id }}
          >
            {row.original.classItem.title}
          </Link>
        </Button>
      ) : (
        "Missing class"
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
  },
  {
    accessorKey: "startDate",
    header: "Starts",
    cell: ({ row }) => row.original.startDate || "Now",
  },
  {
    accessorKey: "endDate",
    header: "Ends",
    cell: ({ row }) => row.original.endDate || "Open",
  },
  {
    id: "proration",
    header: "Tuition",
    cell: ({ row }) =>
      row.original.prorateTuition === false ? "Full period" : "Prorated",
  },
  {
    id: "requestedBy",
    header: "Requested by",
    cell: ({ row }) => row.original.requestedBy?.name || "Not set",
  },
];

function AdminStudentDetailPage() {
  const { studentId } = Route.useParams();
  const typedStudentId = studentId as Id<"students">;
  const studentData = useConvexQuery(api.classes.adminGetStudent, {
    student: typedStudentId,
  });
  const weeklyClassMinutes = useConvexQuery(
    api.billing.adminWeeklyClassMinutes,
    { asOfDate: todayValue() },
  );
  const setStudentStatus = useConvexMutation(api.classes.adminSetStudentStatus);
  const [pendingStatus, setPendingStatus] = useState<StudentStatus | null>(
    null,
  );
  const [savingStatus, setSavingStatus] = useState(false);
  const studentWeeklyMinutes =
    weeklyClassMinutes?.find((row) => row.studentId === studentId)
      ?.weeklyMinutes || 0;

  async function saveStatus(status: StudentStatus) {
    setSavingStatus(true);
    try {
      await setStudentStatus({ student: typedStudentId, status });
      toast.success("Student status updated.");
      setPendingStatus(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update student status.",
      );
    } finally {
      setSavingStatus(false);
    }
  }

  const studentName = studentData
    ? `${studentData.student.firstName} ${studentData.student.lastName}`
    : "Student";

  return (
    <RoleGate allow="admin">
      {studentData === undefined ? (
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      ) : !studentData ? (
        <main className="mx-auto max-w-3xl p-4 lg:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Student not found</CardTitle>
            </CardHeader>
          </Card>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-6xl gap-4 p-4 lg:p-8">
          <section className="space-y-4">
            <Button asChild variant="ghost" className="-ml-3">
              <Link to="/admin/students">
                <ArrowLeft />
                Students
              </Link>
            </Button>
            <div className="space-y-4 p-0 lg:p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar className="h-16 w-16 rounded-full">
                    <AvatarImage
                      src={studentData.photoUrl || undefined}
                      alt={studentName}
                      className="h-full object-cover"
                    />
                    <AvatarFallback className="rounded-full">
                      {studentData.student.firstName.slice(0, 1)}
                      {studentData.student.lastName.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h1 className="truncate text-3xl font-bold">
                      {studentName}
                    </h1>
                    <p className="text-muted-foreground">
                      {studentData.student.preferredName
                        ? `Preferred name: ${studentData.student.preferredName}`
                        : "No preferred name"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button asChild variant="outline">
                    <Link
                      to="/admin/students/$studentId/report"
                      params={{ studentId: studentData.student._id }}
                    >
                      <ChartPie />
                      Report
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link
                      to="/admin/students/$studentId/edit"
                      params={{ studentId: studentData.student._id }}
                    >
                      <Pencil />
                      Edit
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Status</div>
                  <Select
                    value={studentData.student.status}
                    disabled={savingStatus}
                    onValueChange={(value) => {
                      const status = value as StudentStatus;
                      if (status === studentData.student.status) return;
                      if (
                        requiresStudentStatusConfirmation(
                          studentData.student.status,
                          status,
                        )
                      ) {
                        setPendingStatus(status);
                      } else {
                        void saveStatus(status);
                      }
                    }}
                  >
                    <SelectTrigger aria-label="Student status">
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
                  <div className="text-muted-foreground">Birthday</div>
                  <div className="font-medium">
                    {formatMDYYYY(studentData.student.dateOfBirth) || "Not set"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Age</div>
                  <div className="font-medium">
                    {formatAge(studentData.student.dateOfBirth)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">
                    Weekly class hours
                  </div>
                  <div className="font-medium">
                    {weeklyClassMinutes === undefined ? (
                      <Spinner className="inline size-3.5" />
                    ) : (
                      formatWeeklyHours(studentWeeklyMinutes)
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">School</div>
                  <div className="font-medium">
                    {studentData.student.school || "Not set"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Allergies</div>
                  <div className="font-medium">
                    {studentData.student.allergies || "Not set"}
                  </div>
                </div>
              </div>
            </div>
            <Separator className="my-4 w-full" />
          </section>

          <StudentDetailTabs studentData={studentData} />
        </main>
      )}

      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open && !savingStatus) setPendingStatus(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change {studentName} to {pendingStatus}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will drop current enrollments, remove pending or waitlisted
              requests, and cancel active per-session selections for this
              student. Dropped enrollment history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingStatus}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={savingStatus || !pendingStatus}
              onClick={(event) => {
                event.preventDefault();
                if (pendingStatus) void saveStatus(pendingStatus);
              }}
            >
              {savingStatus ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleGate>
  );
}

function StudentDetailTabs({
  studentData,
}: {
  studentData: AdminStudentData;
}) {
  const [selectedTab, setSelectedTab] = useState<StudentTabValue>("contacts");

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => setSelectedTab(value as StudentTabValue)}
      className="gap-4"
    >
      <TabsList className="text-muted-foreground h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b bg-transparent p-0">
        <TabsTrigger value="contacts" className={studentTabTriggerClass}>
          <Users />
          Contacts
        </TabsTrigger>
        <TabsTrigger value="enrollments" className={studentTabTriggerClass}>
          <GraduationCap />
          Enrollments
        </TabsTrigger>
        <TabsTrigger value="notes" className={studentTabTriggerClass}>
          <NotebookText />
          Notes
        </TabsTrigger>
        <TabsTrigger value="logs" className={studentTabTriggerClass}>
          <History />
          Logs
        </TabsTrigger>
      </TabsList>
      <TabsContent value="contacts" className="space-y-4">
        <StudentContactsTab studentData={studentData} />
      </TabsContent>
      <TabsContent value="enrollments" className="space-y-4">
        <StudentEnrollmentsTab studentData={studentData} />
      </TabsContent>
      <TabsContent value="notes" className="space-y-4">
        <StudentNotesTab student={studentData.student} />
      </TabsContent>
      <TabsContent value="logs" className="space-y-4">
        <StudentLogsTab activityLog={studentData.activityLog} />
      </TabsContent>
    </Tabs>
  );
}

function StudentContactsTab({
  studentData,
}: {
  studentData: AdminStudentData;
}) {
  const accounts = useConvexQuery(api.classes.adminListAccounts, {});
  const connectAccount = useConvexMutation(
    api.classes.adminConnectStudentAccount,
  );
  const [selectedAccount, setSelectedAccount] = useState("");
  const [relationship, setRelationship] = useState("");
  const [canManage, setCanManage] = useState(true);
  const [isPrimary, setIsPrimary] = useState(false);
  const [connectingAccount, setConnectingAccount] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  const accountOptions = useMemo(() => {
    const connectedAccountIds = new Set(
      studentData.contacts.flatMap((contact) =>
        contact.user ? [contact.user._id] : [],
      ),
    );
    return (accounts || [])
      .filter((account) => !connectedAccountIds.has(account._id))
      .map((account) => ({
        value: account._id,
        label: getAccountName(account),
        email: Array.isArray(account.email)
          ? account.email[0]
          : account.email,
      }))
      .sort(
        (left, right) =>
          left.label.localeCompare(right.label) ||
          left.value.localeCompare(right.value),
      );
  }, [accounts, studentData.contacts]);

  function resetConnectForm() {
    setSelectedAccount("");
    setRelationship("");
    setCanManage(true);
    setIsPrimary(false);
  }

  function handleConnectDialogChange(open: boolean) {
    if (connectingAccount) return;
    setConnectDialogOpen(open);
    if (!open) resetConnectForm();
  }

  async function handleConnectAccount(event: FormEvent) {
    event.preventDefault();
    if (!selectedAccount) return;
    setConnectingAccount(true);
    try {
      await connectAccount({
        student: studentData.student._id,
        user: selectedAccount as Id<"users">,
        relationship: relationship || undefined,
        canManage,
        isPrimary,
      });
      resetConnectForm();
      setConnectDialogOpen(false);
      toast.success("Account connected to student.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to connect account.",
      );
    } finally {
      setConnectingAccount(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Accounts and contact records connected to this student.
          </p>
        </div>
        <Dialog open={connectDialogOpen} onOpenChange={handleConnectDialogChange}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus />
              Connect account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Connect existing account</DialogTitle>
              <DialogDescription>
                Add another guardian or contact using an account already in
                Access Momentum.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={handleConnectAccount}
            >
              <div className="space-y-1 sm:col-span-2">
                <Label>Account</Label>
                <Combobox
                  items={accountOptions.map((option) => option.value)}
                  value={selectedAccount || null}
                  onValueChange={(value) => setSelectedAccount(value || "")}
                  itemToStringLabel={(value) => {
                    const option = accountOptions.find(
                      (candidate) => candidate.value === value,
                    );
                    return option
                      ? [option.label, option.email].filter(Boolean).join(" · ")
                      : "";
                  }}
                >
                  <ComboboxInput
                    className="w-full"
                    placeholder={
                      accounts === undefined
                        ? "Loading accounts..."
                        : accountOptions.length === 0
                          ? "No available accounts"
                          : "Search accounts"
                    }
                    disabled={accounts === undefined || accountOptions.length === 0}
                    showClear
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No accounts found.</ComboboxEmpty>
                    <ComboboxList>
                      {(value: string) => {
                        const option = accountOptions.find(
                          (candidate) => candidate.value === value,
                        );
                        return (
                          <ComboboxItem key={value} value={value}>
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {option?.label || value}
                              </div>
                              {option?.email ? (
                                <div className="truncate text-xs text-muted-foreground">
                                  {option.email}
                                </div>
                              ) : null}
                            </div>
                          </ComboboxItem>
                        );
                      }}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact-relationship">Relationship</Label>
                <Input
                  id="contact-relationship"
                  value={relationship}
                  onChange={(event) => setRelationship(event.target.value)}
                  placeholder="Parent, guardian, grandparent..."
                  maxLength={80}
                />
              </div>
              <div className="flex flex-col justify-end gap-3 pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={canManage}
                    onCheckedChange={(checked) =>
                      setCanManage(checked === true)
                    }
                  />
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  Can manage this student
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isPrimary}
                    onCheckedChange={(checked) =>
                      setIsPrimary(checked === true)
                    }
                  />
                  <Check className="size-4 text-muted-foreground" />
                  Set as primary contact
                </label>
              </div>
              <DialogFooter className="sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={connectingAccount}
                  onClick={() => handleConnectDialogChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!selectedAccount || connectingAccount}>
                  {connectingAccount ? <Spinner className="size-4" /> : <UserPlus />}
                  Connect account
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {studentData.contacts.map((contact) => (
          <Card key={contact._id} className="rounded-lg">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">
                    {contact.user
                      ? getAccountName(contact.user)
                      : contact.name || contact.inviteEmail || "Unnamed contact"}
                  </CardTitle>
                  <CardDescription>
                    {contact.relationship || "Relationship not set"}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {contact.isPrimary ? (
                    <Badge variant="secondary">Primary</Badge>
                  ) : null}
                  {contact.canManage ? (
                    <Badge variant="outline">Can manage</Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 rounded-full">
                  <AvatarImage
                    src={contact.user?.image || undefined}
                    alt={contact.user ? getAccountName(contact.user) : ""}
                    className="h-full object-cover"
                  />
                  <AvatarFallback className="rounded-full">
                    <User className="size-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="size-4 shrink-0" />
                    <span className="truncate">
                      {contact.user
                        ? formatEmail(contact.user.email)
                        : contact.inviteEmail || "Email not set"}
                    </span>
                  </div>
                  {contact.user?.phone ? (
                    <div className="text-muted-foreground truncate">
                      {contact.user.phone}
                    </div>
                  ) : null}
                </div>
              </div>
              {contact.user ? (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link
                    to="/admin/accounts/$userId"
                    params={{ userId: contact.user._id }}
                  >
                    View account
                  </Link>
                </Button>
              ) : (
                <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                  Contact record is not connected to an account yet.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {studentData.contacts.length === 0 ? (
          <Card className="rounded-lg md:col-span-2">
            <CardHeader>
              <CardTitle>No contacts</CardTitle>
              <CardDescription>
                Connect an existing account to add a guardian or contact.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </div>
    </section>
  );
}

function StudentEnrollmentsTab({
  studentData,
}: {
  studentData: AdminStudentData;
}) {
  const classes = useConvexQuery(api.classes.adminListClasses, {});
  const enrollStudent = useConvexMutation(api.classes.adminEnrollStudentInClass);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [status, setStatus] = useState<EnrollmentStatus>("enrolled");
  const [startDate, setStartDate] = useState(todayValue);
  const [endDate, setEndDate] = useState("");
  const [billingTreatment, setBillingTreatment] =
    useState<BillingTreatment>("");
  const [saving, setSaving] = useState(false);

  const classOptions = useMemo(
    () =>
      (classes || []).map((row) => ({
        value: row.classItem._id,
        label: formatClassOptionLabel(row.classItem),
      })),
    [classes],
  );

  function resetForm() {
    setSelectedClass("");
    setStatus("enrolled");
    setStartDate(todayValue());
    setEndDate("");
    setBillingTreatment("");
  }

  async function handleEnroll(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await enrollStudent({
        student: studentData.student._id,
        classId: selectedClass as Id<"classes">,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        prorateTuition:
          status === "enrolled" ? billingTreatment === "prorate" : undefined,
      });
      resetForm();
      setDialogOpen(false);
      toast.success("Enrollment added.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to add enrollment.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Enrollments</h1>
          <p className="text-muted-foreground">
            Classes connected to this student.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (saving) return;
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <UserPlus />
              Add enrollment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add enrollment</DialogTitle>
              <DialogDescription>
                Add this student to a standard tuition class.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleEnroll}>
              <div className="space-y-1">
                <Label>Class</Label>
                <Combobox
                  items={classOptions.map((option) => option.value)}
                  value={selectedClass || null}
                  onValueChange={(value) => setSelectedClass(value || "")}
                  itemToStringLabel={(value) =>
                    classOptions.find((option) => option.value === value)
                      ?.label || ""
                  }
                >
                  <ComboboxInput
                    className="w-full"
                    placeholder={
                      classes === undefined ? "Loading classes..." : "Select class"
                    }
                    disabled={classes === undefined}
                    showClear
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No classes found.</ComboboxEmpty>
                    <ComboboxList>
                      {(value: string) => (
                        <ComboboxItem key={value} value={value}>
                          {classOptions.find((option) => option.value === value)
                            ?.label || value}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value as EnrollmentStatus);
                    if (value !== "enrolled") setBillingTreatment("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="enrolled">Enrolled</SelectItem>
                    <SelectItem value="waitlisted">Waitlisted</SelectItem>
                    <SelectItem value="dropped">Dropped</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {status === "enrolled" ? (
                <div className="space-y-1">
                  <Label>Tuition treatment</Label>
                  <Select
                    value={billingTreatment}
                    onValueChange={(value) =>
                      setBillingTreatment(value as BillingTreatment)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose billing treatment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prorate">
                        Prorate for enrollment dates
                      </SelectItem>
                      <SelectItem value="full">
                        Charge the full billing period
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="student-enrollment-start">Start date</Label>
                  <Input
                    id="student-enrollment-start"
                    type="date"
                    required
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="student-enrollment-end">End date</Label>
                  <Input
                    id="student-enrollment-end"
                    type="date"
                    required={status === "dropped"}
                    min={startDate}
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    resetForm();
                    setDialogOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    saving ||
                    !selectedClass ||
                    (status === "enrolled" && !billingTreatment)
                  }
                >
                  {saving ? <Spinner className="size-4" /> : <UserPlus />}
                  Add enrollment
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={enrollmentColumns}
        data={studentData.enrollments}
        filterColumn="class"
        filterPlaceholder="Filter classes..."
      />
    </section>
  );
}

function StudentNotesTab({
  student,
}: {
  student: AdminStudentData["student"];
}) {
  const updateNotes = useConvexMutation(api.classes.adminUpdateStudentNotes);
  const savedNotes = student.notes || "";
  const [isEditing, setIsEditing] = useState(false);
  const [draftNotes, setDraftNotes] = useState(savedNotes);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraftNotes(savedNotes);
    }
  }, [isEditing, savedNotes]);

  function startEditing() {
    setDraftNotes(savedNotes);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftNotes(savedNotes);
    setIsEditing(false);
  }

  async function saveNotes() {
    setIsSaving(true);
    try {
      await updateNotes({
        student: student._id,
        notes: draftNotes,
      });
      toast.success("Student notes updated.");
      setIsEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update student notes.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Notes</h1>
          <p className="text-muted-foreground">
            Internal admin notes for this student.
          </p>
        </div>
        {!isEditing ? (
          <Button onClick={startEditing}>
            <Pencil />
            Edit
          </Button>
        ) : null}
      </div>
      <Card className="rounded-lg">
        <CardContent className="pt-6">
          {isEditing ? (
            <div className="space-y-4">
              <Textarea
                value={draftNotes}
                onChange={(event) => setDraftNotes(event.target.value)}
                className="min-h-64 resize-y"
                maxLength={5000}
                placeholder="Add internal notes about this student..."
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm">
                  {draftNotes.length.toLocaleString()} / 5,000 characters
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSaving}
                    onClick={cancelEditing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void saveNotes()}
                  >
                    {isSaving ? "Saving..." : "Save notes"}
                  </Button>
                </div>
              </div>
            </div>
          ) : savedNotes ? (
            <p className="whitespace-pre-wrap text-sm leading-6">
              {savedNotes}
            </p>
          ) : (
            <div className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
              No notes have been added for this student yet.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function StudentLogsTab({
  activityLog,
}: {
  activityLog: AdminStudentData["activityLog"];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Logs</h1>
        <p className="text-muted-foreground">
          Recent operational changes connected to this student.
        </p>
      </div>
      {activityLog.length === 0 ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>No activity yet</CardTitle>
            <CardDescription>
              This student does not have any matching activity log entries.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activityLog.map((event) => (
                <TableRow key={event._id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(event._creationTime)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatEventType(event.eventType)}
                  </TableCell>
                  <TableCell className="min-w-72">{event.summary}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {event.actor ? getAccountName(event.actor) : "System"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline">{event.entityType}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

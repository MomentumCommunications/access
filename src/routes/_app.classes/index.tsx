import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  MapPin,
  Users,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  enrollmentEstimateBillingNote,
  enrollmentSaveButtonState,
  enrollmentSaveErrorMessage,
  enrollmentSaveSuccessMessage,
  normalizeEnrollmentSelectionRequest,
} from "../../../shared/class-enrollment-estimate";
import {
  buildEnrollmentReview,
  emptyEnrollmentSelectionDraft,
  enrollmentReviewTriggerLabel,
  recurringClassSelectionStatus,
  resolvedClassEnrollmentOpen,
  sessionSelectionStatus,
  toggleRecurringClassSelection,
  toggleSessionSelection,
  type EnrollmentReview,
  type EnrollmentSelectionDraft,
  type EnrollmentSelectionStatus,
} from "../../../shared/class-enrollment-selection";
import { resolvedClassEnrollmentMode } from "../../../shared/per-session-signup";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { formatMDYYYY, formatTimeRange } from "~/lib/date-utils";
import { ScrollArea } from "~/components/ui/scroll-area";

export const Route = createFileRoute("/_app/classes/")({
  validateSearch: z.object({
    season: z.string().optional(),
    student: z.string().optional(),
    ageFilter: z.literal("off").optional(),
  }),
  component: ClassesPage,
});

type Catalog = FunctionReturnType<typeof api.classes.listPublishedClasses>;
type CatalogClass = Catalog[number];
type SelectionEstimate = FunctionReturnType<
  typeof api.classes.estimateMyClassSelections
>;

function ClassesPage() {
  const navigate = useNavigate();
  const {
    season: selectedSeason,
    student: selectedStudent,
    ageFilter,
  } = Route.useSearch();
  const seasons = useConvexQuery(api.classes.listCurrentAndFutureSeasons, {});
  const students = useConvexQuery(
    api.classes.listMyStudentsForClassSelection,
    {},
  );
  const selectedStudentRow =
    students?.find((row) => row.student._id === selectedStudent) ||
    students?.[0];
  const selectedStudentId = selectedStudentRow?.student._id;
  const filterByAge = ageFilter !== "off";
  const selectedSeasonId =
    selectedSeason === "all"
      ? undefined
      : seasons?.find((season) => season._id === selectedSeason)?._id ||
        seasons?.[0]?._id;
  const classes = useConvexQuery(
    api.classes.listPublishedClasses,
    students === undefined
      ? "skip"
      : {
          seasonId: selectedSeasonId,
          studentId: selectedStudentId,
          filterByAge: filterByAge && Boolean(selectedStudentId),
        },
  );
  const [draft, setDraft] = useState<EnrollmentSelectionDraft>(
    emptyEnrollmentSelectionDraft,
  );
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const saveSelections = useConvexMutation(api.classes.saveMyClassSelections);
  const normalizedRequest = useMemo(
    () => normalizeEnrollmentSelectionRequest(draft),
    [draft],
  );
  const estimate = useConvexQuery(
    api.classes.estimateMyClassSelections,
    selectedStudentId
      ? {
          student: selectedStudentId,
          recurringClassIds:
            normalizedRequest.recurringClassIds as Id<"classes">[],
          sessionSelections: normalizedRequest.sessionSelections.map(
            (selection) => ({
              classId: selection.classId as Id<"classes">,
              sessionIds: selection.sessionIds as Id<"sessions">[],
            }),
          ),
        }
      : "skip",
  );

  useEffect(() => {
    if (
      seasons &&
      students &&
      ((selectedSeason !== "all" && selectedSeason !== selectedSeasonId) ||
        selectedStudent !== selectedStudentId)
    ) {
      void navigate({
        to: "/classes",
        search: (previous) => ({
          ...previous,
          season: selectedSeason === "all" ? "all" : selectedSeasonId,
          student: selectedStudentId,
        }),
        replace: true,
      });
    }
  }, [
    navigate,
    seasons,
    selectedSeason,
    selectedSeasonId,
    selectedStudent,
    selectedStudentId,
    students,
  ]);

  useEffect(() => {
    setDraft(emptyEnrollmentSelectionDraft());
    setSaveFeedback(null);
  }, [selectedSeasonId, selectedStudentId]);

  const review = useMemo(
    () => buildEnrollmentReview(toReviewClasses(classes || []), draft),
    [classes, draft],
  );
  const selectedStudentName = selectedStudentRow
    ? getStudentName(selectedStudentRow.student)
    : null;
  const loading =
    classes === undefined || seasons === undefined || students === undefined;

  async function handleSaveSelections() {
    if (!selectedStudentId || review.changeCount === 0 || saving) return;
    setSaving(true);
    setSaveFeedback(null);
    try {
      const result = await saveSelections({
        student: selectedStudentId,
        recurringClassIds:
          normalizedRequest.recurringClassIds as Id<"classes">[],
        sessionSelections: normalizedRequest.sessionSelections.map(
          (selection) => ({
            classId: selection.classId as Id<"classes">,
            sessionIds: selection.sessionIds as Id<"sessions">[],
          }),
        ),
      });
      const message = enrollmentSaveSuccessMessage(result);
      setDraft(emptyEnrollmentSelectionDraft());
      setSaveFeedback({ tone: "success", message });
      toast.success(message);
    } catch (error) {
      const message = enrollmentSaveErrorMessage(error);
      setSaveFeedback({ tone: "error", message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-4 pb-24 lg:p-8">
      <div className="mb-5">
        <h1 className="text-3xl font-bold">Classes</h1>
        <p className="text-muted-foreground">
          Choose classes and dates, then review them together.
        </p>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <Label>Student</Label>
            <Select
              value={selectedStudentId}
              onValueChange={(value) =>
                navigate({
                  to: "/classes",
                  search: (previous) => ({ ...previous, student: value }),
                })
              }
              disabled={!students?.length}
            >
              <SelectTrigger className="w-full" aria-label="Student">
                {selectedStudentRow && selectedStudentName ? (
                  <StudentOption
                    name={selectedStudentName}
                    photoUrl={selectedStudentRow.photoUrl}
                    firstName={selectedStudentRow.student.firstName}
                    lastName={selectedStudentRow.student.lastName}
                  />
                ) : (
                  <SelectValue
                    placeholder={
                      students === undefined
                        ? "Loading students..."
                        : "No students linked"
                    }
                  />
                )}
              </SelectTrigger>
              <SelectContent>
                {students?.map(({ student, photoUrl }) => (
                  <SelectItem key={student._id} value={student._id}>
                    <StudentOption
                      name={getStudentName(student)}
                      photoUrl={photoUrl}
                      firstName={student.firstName}
                      lastName={student.lastName}
                    />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>Season</Label>
            <Select
              value={selectedSeason === "all" ? "all" : selectedSeasonId}
              onValueChange={(value) =>
                navigate({
                  to: "/classes",
                  search: (previous) => ({ ...previous, season: value }),
                })
              }
              disabled={seasons === undefined}
            >
              <SelectTrigger className="w-full" aria-label="Season">
                <SelectValue
                  placeholder={
                    seasons === undefined
                      ? "Loading seasons..."
                      : "Filter by season"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All seasons</SelectItem>
                {seasons?.map((season) => (
                  <SelectItem key={season._id} value={season._id}>
                    {season.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex h-9 items-center justify-between gap-3 rounded-md border px-3 sm:justify-start">
          <Label htmlFor="age-filter">Match student age</Label>
          <Switch
            id="age-filter"
            checked={filterByAge}
            disabled={!selectedStudentId}
            onCheckedChange={(checked) =>
              navigate({
                to: "/classes",
                search: (previous) => ({
                  ...previous,
                  ageFilter: checked ? undefined : "off",
                }),
              })
            }
          />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner className="size-5" />
        </div>
      ) : !students.length ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Add a student first</CardTitle>
            <CardDescription>
              A student profile is required before classes can be selected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/students/create">Add student</Link>
            </Button>
          </CardContent>
        </Card>
      ) : classes.length === 0 ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>No classes posted</CardTitle>
            <CardDescription>
              {filterByAge && selectedStudentId
                ? "No published classes match this student's age and the current filters."
                : selectedSeasonId
                  ? "No published classes are available for this season."
                  : "Published classes will appear here when they are ready for signup."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-3">
            {classes.map((row) => (
              <EnrollmentClassCard
                key={row.classItem._id}
                row={row}
                draft={draft}
                setDraft={setDraft}
              />
            ))}
          </section>
          <aside className="hidden lg:sticky lg:top-16 lg:block">
            <ReviewCard
              review={review}
              studentName={selectedStudentName || "Student"}
              estimate={estimate}
              saving={saving}
              feedback={saveFeedback}
              onSave={handleSaveSelections}
            />
          </aside>
        </div>
      )}

      {!loading && students.length > 0 ? (
        <div className="fixed inset-x-4 bottom-4 z-40 lg:hidden">
          <Drawer>
            <DrawerTrigger asChild>
              <Button className="h-11 w-full shadow-lg">
                <BookOpen />
                {enrollmentReviewTriggerLabel(review.changeCount)}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85svh]">
              <DrawerHeader className="text-left">
                <DrawerTitle>Review classes</DrawerTitle>
                <DrawerDescription>
                  Current classes and new choices for{" "}
                  {selectedStudentName || "this student"}.
                </DrawerDescription>
              </DrawerHeader>
              <ScrollArea className="overflow-y-auto px-4 pb-6">
                <ReviewContent
                  review={review}
                  estimate={estimate}
                  saving={saving}
                  feedback={saveFeedback}
                  onSave={handleSaveSelections}
                />
              </ScrollArea>
            </DrawerContent>
          </Drawer>
        </div>
      ) : null}
    </main>
  );
}

function EnrollmentClassCard({
  row,
  draft,
  setDraft,
}: {
  row: CatalogClass;
  draft: EnrollmentSelectionDraft;
  setDraft: Dispatch<SetStateAction<EnrollmentSelectionDraft>>;
}) {
  const classItem = row.classItem;
  const mode = resolvedClassEnrollmentMode(classItem.enrollmentMode);
  const selected = draft.recurringClassIds.includes(classItem._id);
  const full =
    classItem.capacity !== undefined &&
    row.activeEnrollmentCount >= classItem.capacity;
  const enrollmentOpen = resolvedClassEnrollmentOpen(classItem.enrollmentOpen);
  const eligible = row.ageEligible;
  const recurringStatus = recurringClassSelectionStatus({
    enrollmentStatus: row.enrollment?.status,
    selected,
    full,
    enrollmentOpen,
    ageEligible: eligible,
    canManage: row.canManage,
  });
  const selectedSessionCount =
    (draft.sessionIdsByClass[classItem._id] || []).length +
    row.sessions.filter(
      ({ signup }) =>
        signup?.status === "enrolled" ||
        signup?.status === "pending" ||
        signup?.status === "waitlisted",
    ).length;
  const [open, setOpen] = useState(
    mode === "per_session" && selectedSessionCount > 0,
  );

  return (
    <Card className="gap-4 rounded-lg py-5">
      <CardHeader className="gap-3 px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{classItem.title}</CardTitle>
              {mode === "per_session" ? (
                <Badge variant="secondary">Per-session</Badge>
              ) : null}
              <StatusBadge
                status={
                  mode === "standard"
                    ? recurringStatus
                    : perSessionCardStatus(row, draft)
                }
              />
            </div>
            <CardDescription>
              {classItem.scheduleSummary || "Schedule to be announced"}
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="ghost" className="self-start">
            <Link to="/classes/$classId" params={{ classId: classItem._id }}>
              Details
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        {classItem.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {classItem.description}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {classItem.location ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" />
              {classItem.location}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <Users className="size-4" />
            {classItem.capacity === undefined
              ? "No set capacity"
              : mode === "per_session"
                ? `${classItem.capacity} per session`
                : `${row.activeEnrollmentCount}/${classItem.capacity} requested`}
          </span>
          {classItem.minAge !== undefined || classItem.maxAge !== undefined ? (
            <span>{formatAgeRange(classItem.minAge, classItem.maxAge)}</span>
          ) : null}
        </div>

        {mode === "standard" ? (
          <RecurringSelectionAction
            status={recurringStatus}
            onToggle={() =>
              setDraft((current) =>
                toggleRecurringClassSelection(current, classItem._id),
              )
            }
          />
        ) : (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>
                  {selectedSessionCount > 0
                    ? `${selectedSessionCount} ${
                        selectedSessionCount === 1 ? "session" : "sessions"
                      } selected`
                    : "Choose session dates"}
                </span>
                <ChevronDown
                  className={`transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <PerSessionChoices row={row} draft={draft} setDraft={setDraft} />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

function RecurringSelectionAction({
  status,
  onToggle,
}: {
  status: EnrollmentSelectionStatus;
  onToggle: () => void;
}) {
  if (status === "available" || status === "selected") {
    return (
      <Button
        variant={status === "selected" ? "secondary" : "default"}
        onClick={onToggle}
      >
        {status === "selected" ? (
          <>
            <Check />
            Selected
          </>
        ) : (
          "Select class"
        )}
      </Button>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">{statusExplanation(status)}</p>
  );
}

function PerSessionChoices({
  row,
  draft,
  setDraft,
}: {
  row: CatalogClass;
  draft: EnrollmentSelectionDraft;
  setDraft: Dispatch<SetStateAction<EnrollmentSelectionDraft>>;
}) {
  const classItem = row.classItem;
  const draftIds = new Set(draft.sessionIdsByClass[classItem._id] || []);
  const selectableSessions = row.sessions.filter(
    ({ session, signup, activeSignupCount }) => {
      const full =
        classItem.capacity !== undefined &&
        activeSignupCount >= classItem.capacity;
      return (
        !signup &&
        row.canManage &&
        resolvedClassEnrollmentOpen(classItem.enrollmentOpen) &&
        row.ageEligible &&
        (!full || draftIds.has(session._id))
      );
    },
  );
  const allSelectableSelected =
    selectableSessions.length > 0 &&
    selectableSessions.every(({ session }) => draftIds.has(session._id));

  function setAll(checked: boolean) {
    setDraft((current) => {
      const nextIds = checked
        ? selectableSessions.map(({ session }) => session._id)
        : [];
      const sessionIdsByClass = { ...current.sessionIdsByClass };
      if (nextIds.length === 0) {
        delete sessionIdsByClass[classItem._id];
      } else {
        sessionIdsByClass[classItem._id] = nextIds.sort();
      }
      return { ...current, sessionIdsByClass };
    });
  }

  if (!row.canManage || !row.ageEligible) {
    return (
      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
        {statusExplanation(!row.canManage ? "managed" : "ineligible")}
      </p>
    );
  }

  if (!resolvedClassEnrollmentOpen(classItem.enrollmentOpen)) {
    return (
      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
        {statusExplanation("closed")}
      </p>
    );
  }

  if (row.sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No upcoming sessions are available.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`select-all-${classItem._id}`}
            checked={allSelectableSelected}
            disabled={selectableSessions.length === 0}
            onCheckedChange={(checked) => setAll(checked === true)}
          />
          <Label htmlFor={`select-all-${classItem._id}`}>
            Select all available
          </Label>
        </div>
        {classItem.perSessionPriceCents !== undefined ? (
          <span className="text-sm font-medium">
            {formatCurrency(classItem.perSessionPriceCents)} each
          </span>
        ) : null}
      </div>
      {row.sessions.map(({ session, signup, activeSignupCount }) => {
        const selected = draftIds.has(session._id);
        const full =
          classItem.capacity !== undefined &&
          activeSignupCount >= classItem.capacity;
        const status = sessionSelectionStatus({
          signupStatus: signup?.status,
          selected,
          full,
          enrollmentOpen: resolvedClassEnrollmentOpen(classItem.enrollmentOpen),
          ageEligible: row.ageEligible,
          canManage: row.canManage,
        });
        const locked = status !== "available" && status !== "selected";
        return (
          <label
            key={session._id}
            className="flex min-h-14 items-center justify-between gap-3 rounded-md border p-3"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Checkbox
                checked={
                  selected ||
                  status === "active" ||
                  status === "pending" ||
                  status === "waitlisted"
                }
                disabled={locked}
                onCheckedChange={() =>
                  setDraft((current) =>
                    toggleSessionSelection(current, classItem._id, session._id),
                  )
                }
              />
              <span>
                <span className="block text-sm font-medium">
                  {formatMDYYYY(session.date)}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3" />
                  {formatTimeRange(session.startTime, session.endTime) ||
                    "Time TBD"}
                </span>
              </span>
            </span>
            {status !== "available" ? <StatusBadge status={status} /> : null}
          </label>
        );
      })}
    </div>
  );
}

function ReviewCard({
  review,
  studentName,
  estimate,
  saving,
  feedback,
  onSave,
}: {
  review: EnrollmentReview;
  studentName: string;
  estimate: SelectionEstimate | undefined;
  saving: boolean;
  feedback: { tone: "success" | "error"; message: string } | null;
  onSave: () => void;
}) {
  return (
    <Card className="gap-4 rounded-lg py-5">
      <CardHeader className="px-5">
        <CardTitle>Review classes</CardTitle>
        <CardDescription>
          Current classes and new choices for {studentName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <ReviewContent
          review={review}
          estimate={estimate}
          saving={saving}
          feedback={feedback}
          onSave={onSave}
        />
      </CardContent>
    </Card>
  );
}

function ReviewContent({
  review,
  estimate,
  saving,
  feedback,
  onSave,
}: {
  review: EnrollmentReview;
  estimate: SelectionEstimate | undefined;
  saving: boolean;
  feedback: { tone: "success" | "error"; message: string } | null;
  onSave: () => void;
}) {
  const hasCurrent =
    review.currentActive.length > 0 || review.currentPending.length > 0;
  const saveButton = enrollmentSaveButtonState({
    changeCount: review.changeCount,
    saving,
  });
  return (
    <div className="space-y-5">
      <ReviewSection
        title="Active"
        rows={review.currentActive}
        emptyText={hasCurrent ? undefined : "No current enrollments"}
      />
      <ReviewSection title="Pending" rows={review.currentPending} />
      <ReviewSection
        title="New recurring classes"
        rows={review.selectedRecurring}
      />
      {review.selectedPerSession.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">New session dates</h3>
          {review.selectedPerSession.map((row) => (
            <div key={row.classId} className="rounded-md border p-3">
              <p className="text-sm font-medium">{row.title}</p>
              <div className="mt-2 space-y-1">
                {row.sessions.map((session) => (
                  <p
                    key={session.sessionId}
                    className="flex items-start gap-2 text-xs text-muted-foreground"
                  >
                    <CalendarDays className="mt-0.5 size-3 shrink-0" />
                    {session.label}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}
      <EstimateSummary estimate={estimate} />
      <Button
        className="w-full"
        disabled={saveButton.disabled}
        onClick={onSave}
      >
        {saveButton.label}
      </Button>
      {feedback ? (
        <p
          className={`text-center text-sm ${
            feedback.tone === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}

function EstimateSummary({
  estimate,
}: {
  estimate: SelectionEstimate | undefined;
}) {
  return (
    <section className="space-y-3 rounded-md bg-muted p-3">
      <div>
        <h3 className="text-sm font-semibold">Estimated billing plan</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Recurring tuition is monthly. Selected session charges are one-time.
        </p>
      </div>
      {estimate === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Calculating estimate...
        </div>
      ) : estimate.available ? (
        <div className="space-y-2 text-sm">
          <EstimateRow
            label="Current monthly tuition"
            value={formatCurrency(estimate.currentMonthlyTuitionCents || 0)}
          />
          <EstimateRow
            label="Proposed monthly tuition"
            value={formatCurrency(estimate.proposedMonthlyTuitionCents || 0)}
          />
          <EstimateRow
            label="New session charges"
            value={formatCurrency(estimate.selectedSessionChargesCents)}
          />
          <div className="border-t pt-2">
            <EstimateRow
              label="Current estimated total"
              value={formatCurrency(estimate.currentEstimatedTotalCents || 0)}
            />
            <EstimateRow
              label="Estimated new total"
              value={formatCurrency(estimate.proposedEstimatedTotalCents || 0)}
              emphasized
            />
            <EstimateRow
              label="Estimated difference"
              value={formatSignedCurrency(
                estimate.estimatedDifferenceCents || 0,
              )}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {estimate.warning || "Pricing estimate is temporarily unavailable."}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {enrollmentEstimateBillingNote}
      </p>
    </section>
  );
}

function EstimateRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 ${
        emphasized ? "font-semibold" : ""
      }`}
    >
      <span>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

function ReviewSection({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: Array<{ classId: string; title: string; detail?: string }>;
  emptyText?: string;
}) {
  if (rows.length === 0 && !emptyText) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={`${title}-${row.classId}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <span>{row.title}</span>
              {row.detail ? (
                <span className="text-right text-xs text-muted-foreground">
                  {row.detail}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: EnrollmentSelectionStatus }) {
  if (status === "available") return null;
  const labels: Record<
    Exclude<EnrollmentSelectionStatus, "available">,
    string
  > = {
    active: "Active",
    pending: "Pending",
    waitlisted: "Waitlisted",
    selected: "Selected",
    full: "Full",
    closed: "Closed",
    ineligible: "Age mismatch",
    managed: "Managed by staff",
  };
  return (
    <Badge
      variant={
        status === "active" || status === "selected"
          ? "default"
          : status === "full" || status === "ineligible"
            ? "destructive"
            : "secondary"
      }
    >
      {labels[status]}
    </Badge>
  );
}

function perSessionCardStatus(
  row: CatalogClass,
  draft: EnrollmentSelectionDraft,
): EnrollmentSelectionStatus {
  if (row.sessions.some(({ signup }) => signup?.status === "enrolled")) {
    return "active";
  }
  if (row.sessions.some(({ signup }) => signup?.status === "pending")) {
    return "pending";
  }
  if (row.sessions.some(({ signup }) => signup?.status === "waitlisted")) {
    return "waitlisted";
  }
  if (!row.canManage) return "managed";
  if (!row.ageEligible) return "ineligible";
  if (!resolvedClassEnrollmentOpen(row.classItem.enrollmentOpen)) {
    return "closed";
  }
  if ((draft.sessionIdsByClass[row.classItem._id] || []).length > 0) {
    return "selected";
  }
  if (
    row.sessions.length > 0 &&
    row.sessions.every(
      ({ activeSignupCount }) =>
        row.classItem.capacity !== undefined &&
        activeSignupCount >= row.classItem.capacity,
    )
  ) {
    return "full";
  }
  return "available";
}

function statusExplanation(status: EnrollmentSelectionStatus) {
  const messages: Record<EnrollmentSelectionStatus, string> = {
    active: "This student is actively enrolled.",
    pending: "An enrollment request is already pending.",
    waitlisted: "This student is currently waitlisted.",
    selected: "Selected for review.",
    full: "This class is currently full.",
    closed: "Enrollment is closed.",
    ineligible: "This class does not match the student's age.",
    managed:
      "This student's class choices are managed by staff. Please contact us to make changes.",
    available: "Available to select.",
  };
  return messages[status];
}

function toReviewClasses(classes: Catalog) {
  return classes.map((row) => ({
    classId: row.classItem._id,
    title: row.classItem.title,
    mode: resolvedClassEnrollmentMode(row.classItem.enrollmentMode),
    enrollmentStatus: row.enrollment?.status,
    sessions: row.sessions.map(({ session, signup }) => ({
      sessionId: session._id,
      label: sessionLabel(session),
      signupStatus: signup?.status,
    })),
  }));
}

function sessionLabel(session: {
  date: string;
  startTime?: string;
  endTime?: string;
}) {
  const time = formatTimeRange(session.startTime, session.endTime);
  return time
    ? `${formatMDYYYY(session.date)} · ${time}`
    : formatMDYYYY(session.date);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatSignedCurrency(cents: number) {
  if (cents === 0) return formatCurrency(0);
  return `${cents > 0 ? "+" : "-"}${formatCurrency(Math.abs(cents))}`;
}

function formatAgeRange(minAge?: number, maxAge?: number) {
  if (minAge !== undefined && maxAge !== undefined) {
    return `Ages ${minAge}-${maxAge}`;
  }
  if (minAge !== undefined) return `Ages ${minAge}+`;
  return `Up to age ${maxAge}`;
}

function getStudentName(student: {
  firstName: string;
  lastName: string;
  preferredName?: string;
}) {
  return student.preferredName || `${student.firstName} ${student.lastName}`;
}

function StudentOption({
  name,
  photoUrl,
  firstName,
  lastName,
}: {
  name: string;
  photoUrl: string | null;
  firstName: string;
  lastName: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6">
        <AvatarImage
          src={photoUrl || undefined}
          alt=""
          className="object-cover"
        />
        <AvatarFallback className="text-[10px] font-medium">
          {firstName.slice(0, 1)}
          {lastName.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}

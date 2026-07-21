import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { CalendarCheck, CheckCircle2, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";
import { formatMDYYYY, formatTimeRange } from "~/lib/date-utils";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/_app/trial/$classId")({
  validateSearch: z.object({ student: z.string().optional() }),
  component: TrialDateSelectionPage,
});

function TrialDateSelectionPage() {
  const { classId } = Route.useParams();
  const { student } = Route.useSearch();
  const data = useConvexQuery(
    api.trials.getClassRequestView,
    student
      ? {
          classId: classId as Id<"classes">,
          studentId: student as Id<"students">,
        }
      : "skip",
  );
  const submitTrial = useConvexMutation(api.trials.submit);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!student) return <Navigate to="/trial" replace />;
  if (data === undefined) {
    return (
      <main className="min-h-64 flex items-center justify-center">
        <Spinner className="size-5" />
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto w-full max-w-2xl p-4 lg:p-8">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Trial unavailable</CardTitle>
            <CardDescription>
              This class is not currently available for this student.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/trial" search={{ student }}>
                Choose another class
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const pending = data.existingRequest?.status === "pending";
  const approved = data.existingRequest?.status === "approved";
  if (submitted || pending || approved) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col p-4 lg:p-8">
        <Card className="rounded-lg text-center">
          <CardHeader className="items-center">
            <CheckCircle2 className="size-10 text-primary" />
            <CardTitle>
              {approved ? "Trial approved" : "Trial request submitted"}
            </CardTitle>
            <CardDescription>
              {approved
                ? `${data.student.name} is approved for this paid trial.`
                : "The studio will review the requested date. This trial is not confirmed until it is approved."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/trial" search={{ student }}>
                Back to paid trials
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  async function submit() {
    if (!selectedSessionId || submitting) return;
    setSubmitting(true);
    try {
      await submitTrial({
        studentId: student as Id<"students">,
        classId: classId as Id<"classes">,
        sessionId: selectedSessionId as Id<"sessions">,
      });
      setSubmitted(true);
      toast.success("Trial request submitted for approval.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The request could not be submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSession = data.sessions.find(
    (sessionItem) => sessionItem.id === selectedSessionId,
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 lg:p-8">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">{data.classItem.title}</h1>
          <Badge variant="secondary">Paid trial</Badge>
        </div>
        <p className="text-muted-foreground">
          Select one date for {data.student.name}. Approval is required before
          attending.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-3 pb-10">
          {data.sessions.length === 0 ? (
            <Card className="rounded-lg border-dashed">
              <CardHeader>
                <CardTitle>No upcoming dates</CardTitle>
                <CardDescription>
                  This class does not currently have an eligible trial date.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            data.sessions.map((sessionItem) => {
              const selected = selectedSessionId === sessionItem.id;
              return (
                <button
                  key={sessionItem.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedSessionId(sessionItem.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {formatMDYYYY(sessionItem.date)}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {formatTimeRange(
                        sessionItem.startTime,
                        sessionItem.endTime,
                      ) || "Time TBD"}
                    </div>
                    {sessionItem.location || data.classItem.location ? (
                      <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                        <MapPin className="size-3.5" />
                        {sessionItem.location || data.classItem.location}
                      </div>
                    ) : null}
                  </div>
                  <CalendarCheck
                    className={cn(
                      "size-5 shrink-0",
                      selected ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                </button>
              );
            })
          )}
        </section>

        <aside className="hidden lg:sticky lg:top-20 lg:block">
          <TrialReviewCard
            studentName={data.student.name}
            className={data.classItem.title}
            classLocation={data.classItem.location}
            session={selectedSession}
            submitting={submitting}
            onSubmit={submit}
            studentId={student}
          />
        </aside>
      </div>

      {data.sessions.length > 0 ? (
        <div className="fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 md:bottom-4 lg:hidden">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="h-11 w-full shadow-lg">
                <CalendarCheck />
                {selectedSession
                  ? `Review ${formatMDYYYY(selectedSession.date)}`
                  : "Review trial request"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Review paid trial</DialogTitle>
                <DialogDescription>
                  Confirm the student, class, and one trial date before sending
                  the request.
                </DialogDescription>
              </DialogHeader>
              <TrialSelectionSummary
                studentName={data.student.name}
                className={data.classItem.title}
                classLocation={data.classItem.location}
                session={selectedSession}
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <DialogClose asChild>
                  <Button variant="outline">Keep choosing</Button>
                </DialogClose>
                <Button
                  disabled={!selectedSession || submitting}
                  onClick={() => void submit()}
                >
                  {submitting ? "Submitting..." : "Request paid trial"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
    </main>
  );
}

type TrialSession = {
  id: Id<"sessions">;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
};

function TrialReviewCard({
  studentName,
  className,
  classLocation,
  session,
  submitting,
  onSubmit,
  studentId,
}: {
  studentName: string;
  className: string;
  classLocation?: string;
  session?: TrialSession;
  submitting: boolean;
  onSubmit: () => Promise<void>;
  studentId: string;
}) {
  return (
    <Card className="bg-muted/30 rounded-lg">
      <CardHeader>
        <CardTitle>Review paid trial</CardTitle>
        <CardDescription>
          Confirm the selection before sending it to the studio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TrialSelectionSummary
          studentName={studentName}
          className={className}
          classLocation={classLocation}
          session={session}
        />
        <div className="grid gap-2">
          <Button
            disabled={!session || submitting}
            onClick={() => void onSubmit()}
          >
            {submitting ? "Submitting..." : "Request paid trial"}
          </Button>
          <Button asChild variant="outline">
            <Link to="/trial" search={{ student: studentId }}>
              Choose another class
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TrialSelectionSummary({
  studentName,
  className,
  classLocation,
  session,
}: {
  studentName: string;
  className: string;
  classLocation?: string;
  session?: TrialSession;
}) {
  const location = session?.location || classLocation;
  return (
    <div className="space-y-4">
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Student
          </dt>
          <dd className="mt-1 font-medium">{studentName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Class
          </dt>
          <dd className="mt-1 font-medium">{className}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Trial date
          </dt>
          <dd className="bg-background mt-1 rounded-md border p-3">
            {session ? (
              <>
                <div className="font-medium">{formatMDYYYY(session.date)}</div>
                <div className="text-muted-foreground">
                  {formatTimeRange(session.startTime, session.endTime) ||
                    "Time TBD"}
                </div>
                {location ? (
                  <div className="text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {location}
                  </div>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">
                Select one date to continue.
              </span>
            )}
          </dd>
        </div>
      </dl>
      <p className="text-muted-foreground text-sm">
        Trials are paid. The studio will confirm the price during approval and
        prepare the household invoice. This request does not collect payment or
        confirm attendance yet.
      </p>
    </div>
  );
}

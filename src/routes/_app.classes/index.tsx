import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { BookOpen, MapPin, Users } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";

export const Route = createFileRoute("/_app/classes/")({
  validateSearch: z.object({
    season: z.string().optional(),
    student: z.string().optional(),
    ageFilter: z.literal("off").optional(),
  }),
  component: ClassesPage,
});

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
    students?.find((row) => row.student._id === selectedStudent) || students?.[0];
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
          season:
            selectedSeason === "all" ? "all" : selectedSeasonId,
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

  const selectedStudentName = selectedStudentRow
    ? getStudentName(selectedStudentRow.student)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Classes</h1>
        <p className="text-muted-foreground">
          Browse current classes and request a spot.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Student</label>
            <Select
              value={selectedStudentId}
              onValueChange={(value) =>
                navigate({
                  to: "/classes",
                  search: (previous) => ({
                    ...previous,
                    student: value,
                  }),
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
            <label className="text-sm font-medium">Season</label>
            <Select
              value={selectedSeason === "all" ? "all" : selectedSeasonId}
              onValueChange={(value) =>
                navigate({
                  to: "/classes",
                  search: (previous) => ({
                    ...previous,
                    season: value,
                  }),
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
          <label htmlFor="age-filter" className="text-sm font-medium">
            Match student age
          </label>
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
      {classes === undefined ||
      seasons === undefined ||
      students === undefined ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner className="size-5" />
        </div>
      ) : classes.length === 0 ? (
        <Card>
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
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((classItem) => (
            <Card key={classItem._id} className="rounded-lg">
              <CardHeader>
                <CardTitle>{classItem.title}</CardTitle>
                <CardDescription>{classItem.scheduleSummary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {classItem.description ? (
                  <p className="text-sm text-muted-foreground">
                    {classItem.description}
                  </p>
                ) : null}
                <div className="grid gap-2 text-sm text-muted-foreground">
                  {classItem.location ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4" />
                      {classItem.location}
                    </div>
                  ) : null}
                  {classItem.capacity ? (
                    <div className="flex items-center gap-2">
                      <Users className="size-4" />
                      {classItem.capacity} spots
                    </div>
                  ) : null}
                </div>
                <Button asChild>
                  <Link
                    to="/classes/$classId"
                    params={{ classId: classItem._id }}
                  >
                    <BookOpen />
                    View Class
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
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

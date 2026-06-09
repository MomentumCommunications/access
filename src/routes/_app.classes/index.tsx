import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { BookOpen, MapPin, Users } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";
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

export const Route = createFileRoute("/_app/classes/")({
  validateSearch: z.object({
    season: z.string().optional(),
  }),
  component: ClassesPage,
});

function ClassesPage() {
  const navigate = useNavigate();
  const { season: selectedSeason } = Route.useSearch();
  const seasons = useConvexQuery(api.classes.listCurrentAndFutureSeasons, {});
  const selectedSeasonId = seasons?.some(
    (season) => season._id === selectedSeason,
  )
    ? (selectedSeason as Id<"seasons">)
    : undefined;
  const classes = useConvexQuery(api.classes.listPublishedClasses, {
    seasonId: selectedSeasonId,
  });

  useEffect(() => {
    if (seasons && selectedSeason && !selectedSeasonId) {
      void navigate({
        to: "/classes",
        search: (previous) => ({ ...previous, season: undefined }),
        replace: true,
      });
    }
  }, [navigate, seasons, selectedSeason, selectedSeasonId]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Classes</h1>
        <p className="text-muted-foreground">
          Browse current classes and request a spot.
        </p>
      </div>
      <Select
        value={selectedSeasonId || "all"}
        onValueChange={(value) =>
          navigate({
            to: "/classes",
            search: (previous) => ({
              ...previous,
              season: value === "all" ? undefined : value,
            }),
          })
        }
        disabled={seasons === undefined}
      >
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue
            placeholder={
              seasons === undefined ? "Loading seasons..." : "Filter by season"
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
      {classes === undefined || seasons === undefined ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner className="size-5" />
        </div>
      ) : classes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No classes posted</CardTitle>
            <CardDescription>
              {selectedSeasonId
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

import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { BookOpen, MapPin, Users } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/classes/")({
  component: ClassesPage,
});

function ClassesPage() {
  const classes = useConvexQuery(api.classes.listPublishedClasses, {});

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Classes</h1>
        <p className="text-muted-foreground">
          Browse current classes and request a spot.
        </p>
      </div>
      {classes === undefined ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner className="size-5" />
        </div>
      ) : classes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No classes posted</CardTitle>
            <CardDescription>
              Published classes will appear here when they are ready for signup.
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

import { createFileRoute } from "@tanstack/react-router";
import { BulletinFeed } from "~/components/bulletin-feed";

export const Route = createFileRoute("/_app/calendar/")({
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Calendar</h1>
        <p className="text-muted-foreground">
          Upcoming events and announcements for your groups.
        </p>
      </div>
      <BulletinFeed />
    </main>
  );
}

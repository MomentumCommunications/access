import { createFileRoute } from "@tanstack/react-router";
import { Id } from "convex/_generated/dataModel";
import AttendanceSession from "~/components/attendance-session";

export const Route = createFileRoute("/_app/admin/attendance_/$sessionId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { sessionId } = Route.useParams();
  return <AttendanceSession sessionId={sessionId as Id<"sessions">} />;
}

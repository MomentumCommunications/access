import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { ChevronLeft, ChevronRight, Scan } from "lucide-react";
import { useState } from "react";
import AttendanceSession from "~/components/attendance-session";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { useIsMobile } from "~/hooks/use-mobile";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";

export const Route = createFileRoute("/_app/admin/attendance")({
  component: AttendancePage,
});

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return toDateInputValue(next);
}

function AttendancePage() {
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [targetSessionId, setTargetSessionId] = useState<string | null>();
  const [showUnmarked, setShowUnmarked] = useState(false);

  const isMobile = useIsMobile();

  const datedSessions = useConvexQuery(api.classes.adminListSessionsByDate, {
    date,
  });

  const unmarkedSessions = useConvexQuery(api.classes.listUnmarkedAttendance);

  const sessions = showUnmarked ? unmarkedSessions : datedSessions;

  return (
    <RoleGate allow="admin">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <ScrollArea className="h-screen pb-12">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-bold">Attendance</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDate((value) => shiftDate(value, -1))}
                  disabled={showUnmarked}
                >
                  <ChevronLeft />
                </Button>
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-auto"
                  disabled={showUnmarked}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDate((value) => shiftDate(value, 1))}
                  disabled={showUnmarked}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full justify-between">
              <p> Sessions: {sessions?.length || 0}</p>
              <div className="flex items-center gap-2">
                <Switch
                  checked={showUnmarked}
                  onCheckedChange={setShowUnmarked}
                />
                <Label className="text-muted-foreground">Incomplete</Label>
              </div>
            </div>
            {sessions === undefined ? (
              <div className="flex min-h-40 items-center justify-center">
                <Spinner className="size-5" />
              </div>
            ) : sessions.length === 0 ? (
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle>No sessions</CardTitle>
                  <CardDescription>
                    No sessions match this date and filter.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Marked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((row) => (
                    <TableRow
                      key={row.session._id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50",
                        targetSessionId === row.session._id && "bg-muted",
                      )}
                    >
                      <TableCell>
                        {isMobile && (
                          <Button asChild variant="link" className="h-auto p-0">
                            <Link
                              to="/staff/attendance/$sessionId"
                              params={{ sessionId: row.session._id }}
                            >
                              {row.classItem?.title || "Untitled class"}
                            </Link>
                          </Button>
                        )}
                        {!isMobile && (
                          <Button
                            variant="link"
                            className="h-auto p-0"
                            onClick={() => setTargetSessionId(row.session._id)}
                          >
                            {row.classItem?.title || "Untitled class"}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(row.session.date, "MM/dd/yy") || "Date TBD"}
                        {" · "}
                        {row.session.startTime}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "text-muted-foreground",
                            row.attendance.length === row.enrollments.length &&
                              "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
                            row.attendance.length === 0 &&
                              "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
                          )}
                        >{`${row.attendance.length}/${row.enrollments.length}`}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </ScrollArea>
        <div className="hidden h-screen w-full px-6 pt-6 pb-48 md:block">
          <Card className="h-full rounded-lg">
            {!targetSessionId && (
              <div className="flex h-full items-center justify-center">
                <Scan className="size-12 text-muted-foreground" />
              </div>
            )}
            {targetSessionId && (
              <AttendanceSession
                sessionId={targetSessionId as Id<"sessions">}
              />
            )}
          </Card>
        </div>
      </div>
    </RoleGate>
  );
}

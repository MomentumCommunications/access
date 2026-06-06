import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Label, Pie, PieChart } from "recharts";
import { RoleGate } from "~/components/role-gate";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatMDYYYY } from "~/lib/date-utils";

const chartConfig = {
  present: {
    label: "Present",
    color: "var(--chart-2)",
  },
  absent: {
    label: "Absent",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

export const Route = createFileRoute("/_app/admin/students/$studentId_/report")(
  {
    component: AdminStudentReportPage,
  },
);

function AdminStudentReportPage() {
  const { studentId } = Route.useParams();
  const report = useConvexQuery(api.classes.adminGetStudentAttendanceReport, {
    student: studentId as Id<"students">,
  });

  if (report === undefined) {
    return (
      <RoleGate allow="admin">
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      </RoleGate>
    );
  }

  if (!report) {
    return (
      <RoleGate allow="admin">
        <main className="mx-auto max-w-3xl p-4 lg:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Student not found</CardTitle>
            </CardHeader>
          </Card>
        </main>
      </RoleGate>
    );
  }

  const fullName = `${report.student.firstName} ${report.student.lastName}`;
  const totalMarks = report.summary.present + report.summary.absent;
  const presentPercentage =
    totalMarks === 0
      ? 0
      : Math.round((report.summary.present / totalMarks) * 100);
  const chartData = [
    {
      status: "present",
      count: report.summary.present,
      fill: "var(--color-present)",
    },
    {
      status: "absent",
      count: report.summary.absent,
      fill: "var(--color-absent)",
    },
  ];

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:p-8">
        <header className="flex items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {report.photoUrl ? (
              <img
                src={report.photoUrl}
                alt={fullName}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-2xl font-semibold text-muted-foreground">
                {report.student.firstName.slice(0, 1)}
                {report.student.lastName.slice(0, 1)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold">{fullName}</h1>
            <p className="text-muted-foreground">Attendance report</p>
          </div>
        </header>

        <div className="gap-4 flex flex-col">
          <Card className="rounded-lg max-w-[92vw] mx-auto w-full sm:max-w-none">
            <CardHeader>
              <CardTitle>Attendance</CardTitle>
              <CardDescription>
                Present and absent marks recorded for this student.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row">
              {totalMarks === 0 ? (
                <div className="flex h-72 items-center justify-center text-center text-sm text-muted-foreground">
                  No present or absent marks recorded.
                </div>
              ) : (
                <ChartContainer
                  config={chartConfig}
                  className="mx-auto w-full max-w-sm"
                  style={{ height: 288, minHeight: 288 }}
                >
                  <PieChart accessibilityLayer>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent hideLabel nameKey="status" />
                      }
                    />
                    <Pie
                      data={chartData}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={58}
                      outerRadius={72}
                      strokeWidth={2}
                    >
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  className="fill-foreground text-3xl font-bold"
                                >
                                  {presentPercentage}%
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 24}
                                  className="fill-muted-foreground"
                                >
                                  Present
                                </tspan>
                              </text>
                            );
                          }

                          return null;
                        }}
                      />
                    </Pie>
                    <ChartLegend
                      content={<ChartLegendContent nameKey="status" />}
                    />
                  </PieChart>
                </ChartContainer>
              )}
              <div className="flex w-full sm:w-1/2 flex-row sm:flex-col justify-around border-t sm:border-t-0 sm:border-l pt-4 text-center">
                <div>
                  <div className="text-2xl font-semibold">
                    {report.summary.present}
                  </div>
                  <div className="text-sm text-muted-foreground">Present</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold">
                    {report.summary.absent}
                  </div>
                  <div className="text-sm text-muted-foreground">Absent</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 rounded-lg">
            <CardHeader>
              <CardTitle>Absences</CardTitle>
              <CardDescription>
                Dates and classes connected to absent marks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Class</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.absences.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No absences recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.absences.map(({ record, session, classItem }) => (
                      <TableRow key={record._id}>
                        <TableCell className="whitespace-nowrap">
                          {formatMDYYYY(session.date)}
                        </TableCell>
                        <TableCell>
                          {classItem ? (
                            <Link
                              to="/admin/classes/$classId"
                              params={{ classId: classItem._id }}
                              className="font-medium hover:underline"
                            >
                              {classItem.title}
                            </Link>
                          ) : (
                            "Missing class"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </RoleGate>
  );
}

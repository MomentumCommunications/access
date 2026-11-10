import { useConvexQuery } from "@convex-dev/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
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

type AbsenceReason = NonNullable<Doc<"attendanceRecords">["reason"]>;

const absenceReasonLabels = {
  sick: "Sick",
  injured: "Injured",
  homework: "Homework",
  vacation: "Vacation",
  "school-event": "School event",
  "no-ride": "No ride",
  none: "No Reason Provided",
} satisfies Record<AbsenceReason | "none", string>;

const reasonChartConfig = {
  count: { label: "Absences", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function StudentAttendanceTab({
  studentId,
}: {
  studentId: Id<"students">;
}) {
  const report = useConvexQuery(api.classes.adminGetStudentAttendanceReport, {
    student: studentId,
  });

  if (report === undefined) {
    return (
      <div
        className="flex min-h-72 items-center justify-center"
        role="status"
        aria-label="Loading attendance"
      >
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!report) {
    return <p className="text-muted-foreground">Student not found.</p>;
  }

  const reasonData = Object.entries(absenceReasonLabels).map(
    ([reason, label]) => ({
      reason: label,
      count: report.absences.filter(
        ({ record }) => (record.reason ?? "none") === reason,
      ).length,
    }),
  );
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
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Attendance</h2>
        <p className="text-muted-foreground">
          Attendance history and absence reasons for this student.
        </p>
      </div>
      <Card className="min-w-0 rounded-lg">
        <CardHeader>
          <CardTitle>Marks</CardTitle>
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
                  content={<ChartTooltipContent hideLabel nameKey="status" />}
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
          <CardTitle>Absence reasons</CardTitle>
          <CardDescription>
            Each absent mark counts once. Absences without a reason are included
            as No Reason Provided.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.absences.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No absences recorded.
            </p>
          ) : (
            <ChartContainer config={reasonChartConfig} className="h-80 w-full">
              <BarChart
                accessibilityLayer
                data={reasonData}
                layout="vertical"
                margin={{ top: 8, right: 32, bottom: 8, left: 0 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="reason"
                  width={140}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[0, 4, 4, 0]}
                >
                  <LabelList
                    dataKey="count"
                    position="right"
                    className="fill-foreground"
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 rounded-lg">
        <CardHeader>
          <CardTitle>Absences</CardTitle>
          <CardDescription>
            Dates, classes, and reasons connected to absent marks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.absences.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
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
                    <TableCell>
                      {absenceReasonLabels[record.reason ?? "none"]}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

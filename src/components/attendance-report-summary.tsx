import { Label, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import {
  attendanceReportTotals,
  formatAttendanceRate,
  type AttendanceReportRow,
} from "../../shared/attendance-report";

const config = {
  present: { label: "Present (includes late)", color: "var(--chart-2)" },
  absent: { label: "Absent", color: "var(--destructive)" },
};

export function AttendanceReportSummary({
  rows,
}: {
  rows: AttendanceReportRow[];
}) {
  const totals = attendanceReportTotals(rows);
  const data = [
    { status: "present", count: totals.present, fill: "var(--color-present)" },
    { status: "absent", count: totals.absent, fill: "var(--color-absent)" },
  ];
  return (
    <section
      aria-label="Filtered attendance summary"
      className="attendance-report-summary flex flex-wrap items-center justify-center gap-6 rounded-lg border p-4"
    >
      {totals.rate === null ? (
        <p className="text-muted-foreground py-8 text-sm">
          No present or absent records in this selection.
        </p>
      ) : (
        <ChartContainer
          config={config}
          className="h-48 w-48 shrink-0"
          aria-label={`${formatAttendanceRate(totals.rate)} present, ${formatAttendanceRate(100 - totals.rate)} absent`}
        >
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel nameKey="status" />}
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius={62}
              outerRadius={85}
              isAnimationActive={false}
            >
              <Label
                position="center"
                content={({ viewBox }) =>
                  viewBox && "cx" in viewBox && "cy" in viewBox ? (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        className="fill-foreground text-2xl font-bold"
                      >
                        {formatAttendanceRate(totals.rate)}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        dy={22}
                        className="fill-muted-foreground text-xs"
                      >
                        Present
                      </tspan>
                    </text>
                  ) : null
                }
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      )}
      <div className="space-y-3">
        <dl className="flex flex-wrap gap-6">
          <div>
            <dt className="text-muted-foreground text-sm">Students</dt>
            <dd className="text-2xl font-semibold">{totals.students}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Present</dt>
            <dd className="text-2xl font-semibold">{totals.present}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Absent</dt>
            <dd className="text-2xl font-semibold">{totals.absent}</dd>
          </div>
        </dl>
        {totals.rate !== null && (
          <p className="text-sm">
            {formatAttendanceRate(totals.rate)} present ·{" "}
            {formatAttendanceRate(100 - totals.rate)} absent
          </p>
        )}
        <p className="text-muted-foreground max-w-sm text-xs">
          Present includes late arrivals and attended makeups. Excused and
          unmarked visits are excluded. Totals include all matching students.
        </p>
      </div>
    </section>
  );
}

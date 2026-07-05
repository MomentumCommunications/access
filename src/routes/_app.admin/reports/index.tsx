import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { RoleGate } from "~/components/role-gate";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import { Separator } from "~/components/ui/separator";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/admin/reports/")({
  component: AdminReportsPage,
});

const monthlyChartConfig = {
  activeEnrollments: {
    label: "Active enrollments",
    color: "var(--chart-1)",
  },
  activeStudents: {
    label: "Active students",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const requestsChartConfig = {
  requests: {
    label: "Requests",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const statusChartConfig = {
  pending: {
    label: "Pending",
    color: "var(--chart-1)",
  },
  enrolled: {
    label: "Enrolled",
    color: "var(--chart-2)",
  },
  waitlisted: {
    label: "Waitlisted",
    color: "var(--chart-3)",
  },
  declined: {
    label: "Declined",
    color: "var(--chart-4)",
  },
  dropped: {
    label: "Dropped",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const activeClassChartConfig = {
  count: {
    label: "Active enrollments",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function AdminReportsPage() {
  const report = useConvexQuery(api.reports.adminEnrollmentDashboard, {});

  return (
    <RoleGate allow="admin">
      <main className="flex min-w-0 w-full max-w-full flex-col gap-6 overflow-hidden p-4 lg:p-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="break-words text-muted-foreground">
            A first pass at enrollment reporting from current class enrollment
            records.
          </p>
        </div>

        {report === undefined ? (
          <div className="flex min-h-80 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <>
            <section className="min-w-0 max-w-full space-y-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold">
                  Monthly participation
                </h2>
                <p className="break-words text-sm text-muted-foreground">
                  Counts reflect enrollments and distinct students active at any
                  point during the month.
                </p>
              </div>
              <div className="min-w-0 max-w-full overflow-x-auto">
                <ChartContainer
                  config={monthlyChartConfig}
                  className="h-[340px] min-w-[38rem] max-w-full"
                >
                  <LineChart
                    accessibilityLayer
                    data={report.months}
                    margin={{ left: 8, right: 16, top: 12, bottom: 8 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      dataKey="activeEnrollments"
                      type="monotone"
                      stroke="var(--color-activeEnrollments)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      dataKey="activeStudents"
                      type="monotone"
                      stroke="var(--color-activeStudents)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </section>

            <Separator />

            <section className="grid min-w-0 max-w-full gap-6 lg:grid-cols-6">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-4">
                <KpiStat
                  label="Active enrollments"
                  value={report.kpis.currentActiveEnrollments}
                  description="Currently enrolled and in range"
                />
                <KpiStat
                  label="Active students"
                  value={report.kpis.currentActiveStudents}
                  description="Distinct students currently enrolled"
                />
                <KpiStat
                  label="Pending requests"
                  value={report.kpis.currentPendingRequests}
                  description="Awaiting admin review"
                />
                <KpiStat
                  label="Waitlisted"
                  value={report.kpis.currentWaitlistedEnrollments}
                  description="Current waitlist rows"
                />
              </div>

              <ReportSection
                title="Requests per month"
                description="Enrollment requests by creation month."
                className="lg:col-span-4"
              >
                <div className="min-w-0 max-w-full overflow-x-auto">
                  <ChartContainer
                    config={requestsChartConfig}
                    className="h-[280px] min-w-[34rem] max-w-full"
                  >
                    <BarChart
                      accessibilityLayer
                      data={report.months}
                      margin={{ left: 8, right: 12, top: 12, bottom: 8 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="requests"
                        fill="var(--color-requests)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              </ReportSection>

              <ReportSection
                title="Current status mix"
                description="All current class enrollment rows by status."
                className="lg:col-span-2"
              >
                <StatusMixChart data={report.statusCounts} />
              </ReportSection>

              <ReportSection
                title="Top classes by active enrollments"
                description="Currently enrolled students whose enrollment overlaps today."
                className="lg:col-span-4"
              >
                <RankingBarChart
                  data={report.topClassesByActiveEnrollments}
                  config={activeClassChartConfig}
                  emptyMessage="No active enrollments right now."
                />
              </ReportSection>

              <ReportSection
                title="Waitlist pressure"
                description="Classes with the highest current waitlist count."
                className="lg:col-span-2"
              >
                <RankingList
                  data={report.topClassesByWaitlist}
                  emptyMessage="No waitlisted enrollments right now."
                />
              </ReportSection>
            </section>
          </>
        )}
      </main>
    </RoleGate>
  );
}

function KpiStat({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

function ReportSection({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 max-w-full space-y-3 ${className ?? ""}`}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="break-words text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

function StatusMixChart({
  data,
}: {
  data: { status: keyof typeof statusChartConfig; count: number }[];
}) {
  const total = data.reduce((sum, row) => sum + row.count, 0);
  const chartData = data.map((row) => ({
    ...row,
    fill: `var(--color-${row.status})`,
  }));

  if (total === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        No enrollment rows yet.
      </div>
    );
  }

  return (
    <ChartContainer
      config={statusChartConfig}
      className="h-[280px] min-w-0 max-w-full"
    >
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="status"
          innerRadius={58}
          outerRadius={76}
          strokeWidth={2}
        >
          {chartData.map((row) => (
            <Cell key={row.status} fill={row.fill} />
          ))}
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
                      {total}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 24}
                      className="fill-muted-foreground"
                    >
                      Rows
                    </tspan>
                  </text>
                );
              }

              return null;
            }}
          />
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="status" />} />
      </PieChart>
    </ChartContainer>
  );
}

function RankingBarChart({
  data,
  config,
  emptyMessage,
}: {
  data: { classTitle: string; count: number }[];
  config: ChartConfig;
  emptyMessage: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <ChartContainer config={config} className="h-[300px] min-w-[32rem]">
        <BarChart
          accessibilityLayer
          data={data}
          layout="vertical"
          margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
        >
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="classTitle"
            tickLine={false}
            axisLine={false}
            width={140}
            tickMargin={8}
          />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function RankingList({
  data,
  emptyMessage,
}: {
  data: { classTitle: string; count: number }[];
  emptyMessage: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const maxCount = Math.max(...data.map((row) => row.count), 1);

  return (
    <div className="space-y-3">
      {data.map((row, index) => (
        <div key={row.classTitle} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {index + 1}. {row.classTitle}
            </span>
            <span className="font-medium tabular-nums">{row.count}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-[var(--chart-3)]"
              style={{ width: `${Math.max(8, (row.count / maxCount) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, ClipboardList } from "lucide-react";
import { RoleGate } from "~/components/role-gate";

export const Route = createFileRoute("/_app/admin/reports/")({
  component: ReportsIndexPage,
});

const reportLinks = [
  {
    title: "Overview",
    description: "Enrollment activity, participation, and tuition estimates.",
    to: "/admin/reports/overview",
    icon: BarChart3,
  },
  {
    title: "Onboarding",
    description: "Incomplete onboarding and absent trial follow-ups.",
    to: "/admin/reports/onboarding",
    icon: ClipboardList,
  },
] as const;

function ReportsIndexPage() {
  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Review studio activity and follow-up work.
          </p>
        </div>
        <nav className="divide-y rounded-md border" aria-label="Reports">
          {reportLinks.map(({ title, description, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="hover:bg-muted/40 focus-visible:ring-ring flex min-h-24 items-center gap-4 p-4 outline-none first:rounded-t-md last:rounded-b-md focus-visible:ring-2 sm:p-5"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {description}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </nav>
      </main>
    </RoleGate>
  );
}

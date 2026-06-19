import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Banknote,
  CalendarRange,
  Layers3,
  ReceiptText,
  SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const Route = createFileRoute("/_app/admin/billing/")({
  component: BillingHomePage,
});

const destinations = [
  {
    title: "Pricing",
    description: "Configure tuition tiers and future billing adjustments.",
    to: "/admin/billing/pricing",
    icon: <SlidersHorizontal />,
  },
  {
    title: "Adjustments",
    description:
      "Schedule recurring student tuition and private-charge adjustments.",
    to: "/admin/billing/adjustments",
    icon: <CalendarRange />,
  },
  {
    title: "Tuitions",
    description: "Review regular class hours and tuition calculations.",
    to: "/admin/billing/tuitions",
    icon: <Banknote />,
  },
  {
    title: "Charges",
    description:
      "Review app-calculated private lesson and per-session class charges.",
    to: "/admin/billing/charges",
    icon: <ReceiptText />,
  },
  {
    title: "Runs",
    description: "Prepare and review period-based billing batches.",
    to: "/admin/billing/runs",
    icon: <Layers3 />,
  },
] as const;

function BillingHomePage() {
  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground">
            Configure pricing and review charges before generating billing
            runs.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {destinations.map((destination) => (
            <BillingCard key={destination.to} {...destination} />
          ))}
        </div>
      </main>
    </RoleGate>
  );
}

function BillingCard({
  title,
  description,
  to,
  icon,
}: {
  title: string;
  description: string;
  to: (typeof destinations)[number]["to"];
  icon: ReactNode;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link to={to}>
            {icon}
            Open
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

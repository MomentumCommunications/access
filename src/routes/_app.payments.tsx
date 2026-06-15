import {
  useConvexAction,
  useConvexQuery,
} from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { CreditCard, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/payments")({
  validateSearch: z.object({
    portal: z.literal("returned").optional(),
  }),
  component: PaymentsRoute,
});

const fallbackCopy = {
  unauthenticated: {
    title: "Sign in required",
    description: "Sign in to manage payments.",
  },
  not_billable: {
    title: "You are not set as a payment account",
    description:
      "Only the household's primary payment account can open the payment portal. Please contact an administrator.",
  },
  missing_household: {
    title: "Household not connected",
    description:
      "This account is not connected to a billing household. Please contact an administrator.",
  },
  missing_billing_responsibility: {
    title: "Payment account not configured",
    description:
      "Your household does not have a primary payment account yet. Please contact an administrator.",
  },
  missing_stripe_customer: {
    title: "Your billing access is not ready yet",
    description:
      "The payment account is configured, but its Stripe connection is not ready. Please contact an administrator.",
  },
} as const;

function PaymentsRoute() {
  const { portal } = Route.useSearch();
  const access = useConvexQuery(api.paymentsData.getCurrentAccess, {});
  const createPortalSession = useConvexAction(
    api.payments.createCurrentUserStripePortalSession,
  );
  const attemptedLaunch = useRef(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const launchPortal = useCallback(async () => {
    setLaunchError(null);
    setIsLaunching(true);
    try {
      const returnUrl = new URL("/payments", window.location.origin);
      returnUrl.searchParams.set("portal", "returned");
      const session = await createPortalSession({
        returnUrl: returnUrl.toString(),
      });
      window.location.assign(session.url);
    } catch (error) {
      setLaunchError(
        error instanceof Error
          ? error.message
          : "The payment portal could not be opened.",
      );
      setIsLaunching(false);
    }
  }, [createPortalSession]);

  useEffect(() => {
    if (
      access?.status !== "ready" ||
      portal === "returned" ||
      attemptedLaunch.current
    ) {
      return;
    }
    attemptedLaunch.current = true;
    void launchPortal();
  }, [access?.status, launchPortal, portal]);

  if (access === undefined || (access.status === "ready" && isLaunching)) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <div
          className="flex items-center gap-3 text-sm text-muted-foreground"
          role="status"
        >
          <Spinner className="size-5" />
          {access === undefined
            ? "Checking payment access..."
            : "Opening payment portal..."}
        </div>
      </main>
    );
  }

  if (access.status !== "ready") {
    const copy = fallbackCopy[access.status];
    return (
      <PaymentsCard title={copy.title} description={copy.description} />
    );
  }

  return (
    <PaymentsCard
      title={
        launchError ? "Payment portal unavailable" : "Manage payments"
      }
      description={
        launchError ||
        "Open Stripe's secure portal to manage payment methods and billing details."
      }
    >
      <Button
        className="w-full sm:w-auto"
        disabled={isLaunching}
        onClick={() => void launchPortal()}
      >
        {isLaunching ? (
          <Spinner className="size-4" />
        ) : (
          <ExternalLink className="size-4" />
        )}
        {isLaunching ? "Opening..." : "Open payment portal"}
      </Button>
    </PaymentsCard>
  );
}

function PaymentsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center p-4 lg:p-8">
      <div className="w-full space-y-4">
        <h1 className="text-3xl font-bold">Payments</h1>
        <Card>
          <CardHeader>
            <CreditCard className="mb-2 size-8 text-muted-foreground" />
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            {children}
            <Button variant="outline" asChild>
              <Link to="/home">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

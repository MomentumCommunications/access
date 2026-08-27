import {
  useConvexAction,
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { CreditCard, ExternalLink, ReceiptText } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";

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
  const access = useConvexQuery(api.paymentsData.getCurrentAccess, {});
  const createPortalSession = useConvexAction(
    api.payments.createCurrentUserStripePortalSession,
  );
  const setAutopay = useConvexMutation(
    api.paymentsData.setCurrentUserAutopay,
  );
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSavingAutopay, setIsSavingAutopay] = useState(false);
  const [confirmAutopay, setConfirmAutopay] = useState(false);
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

  const updateAutopay = useCallback(
    async (enabled: boolean) => {
      setIsSavingAutopay(true);
      try {
        await setAutopay({ enabled });
        toast.success(
          enabled
            ? "Automatic payments are on."
            : "Automatic payments are off.",
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Automatic payments could not be updated.",
        );
      } finally {
        setIsSavingAutopay(false);
      }
    },
    [setAutopay],
  );

  if (access === undefined) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <div
          className="flex items-center gap-3 text-sm text-muted-foreground"
          role="status"
        >
          <Spinner className="size-5" />
          Checking payment access...
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
    <>
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center p-4 lg:p-8">
        <div className="w-full space-y-4">
          <div>
            <h1 className="text-3xl font-bold">Payments</h1>
            <p className="text-muted-foreground">
              Manage how your household pays invoices and update billing
              details.
            </p>
          </div>
          <Card>
            <CardContent className="space-y-5 pt-6">
              <section className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="size-5 text-muted-foreground" />
                    <Label htmlFor="member-autopay" className="font-semibold">
                      Automatic payments
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Charge future billing invoices to your default payment
                    method. If no usable default method is available, we will
                    send the invoice for manual payment instead.
                  </p>
                </div>
                <Switch
                  id="member-autopay"
                  className="shrink-0"
                  checked={access.autopayEnabled === true}
                  disabled={isSavingAutopay}
                  onCheckedChange={(enabled) => {
                    if (enabled) {
                      setConfirmAutopay(true);
                    } else {
                      void updateAutopay(false);
                    }
                  }}
                />
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-start gap-2">
                  <CreditCard className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">
                      Payment methods and billing details
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Use Stripe&apos;s secure portal to update your payment
                      method, billing information, and invoice history.
                    </p>
                  </div>
                </div>
                {launchError ? (
                  <p className="text-sm text-destructive">{launchError}</p>
                ) : null}
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
                  {isLaunching ? "Opening..." : "Manage payment methods"}
                </Button>
              </section>
            </CardContent>
          </Card>
          <Button variant="outline" asChild>
            <Link to="/home">Back to home</Link>
          </Button>
        </div>
      </main>

      <AlertDialog open={confirmAutopay} onOpenChange={setConfirmAutopay}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn on automatic payments?</AlertDialogTitle>
            <AlertDialogDescription>
              By turning this on, you authorize future billing invoices to be
              charged automatically using your default payment method. You can
              turn automatic payments off here at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingAutopay}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSavingAutopay}
              onClick={() => void updateAutopay(true)}
            >
              Turn on automatic payments
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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

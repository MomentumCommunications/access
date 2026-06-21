import {
  convexQuery,
  useConvexAction,
} from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import {
  BookOpenCheck,
  CalendarDays,
  CreditCard,
  Download,
  GraduationCap,
  ReceiptText,
  TriangleAlert,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { BillingAttentionStatus } from "../../shared/billing-attention";
import { billingAttentionPortalHref } from "../../shared/billing-attention";
import { findNextUpcomingBulletin } from "../../shared/bulletin-audience";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useActiveRole } from "~/contexts/ActiveRoleContext";
import { useCurrentUser } from "~/hooks/useCurrentUser";
import { formatBulletinDate } from "~/lib/bulletin-date";
import { hasUserRole, ROLE_HOME } from "~/lib/roles";

export const Route = createFileRoute("/_app/home")({
  component: Home,
});

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true)
  );
}

function PwaInstallBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const isMobileBrowser =
      window.matchMedia("(max-width: 767px)").matches &&
      navigator.maxTouchPoints > 0 &&
      !isStandaloneApp();

    setIsVisible(isMobileBrowser);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  async function handleInstall() {
    if (!installPrompt) {
      window.location.href = "/help#install-app";
      return;
    }

    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary p-2 text-primary-foreground">
          <Download className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h2 className="text-sm font-semibold">Install Access Momentum</h2>
            <p className="text-sm text-muted-foreground">
              Add the portal to your home screen for a faster app-like launch.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleInstall}>
              {installPrompt ? "Install" : "Show me how"}
            </Button>
            {installPrompt && (
              <Button variant="outline" size="sm" asChild>
                <a href="/help#install-app">Show me how</a>
              </Button>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-m-2 size-8 shrink-0"
          onClick={() => setIsVisible(false)}
          aria-label="Dismiss install prompt"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Home() {
  const { activeRole, isReady } = useActiveRole();

  if (!isReady) {
    return (
      <div className="flex min-h-[calc(100svh-54px)] items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    );
  }

  if (activeRole !== "member") {
    return <Navigate to={ROLE_HOME[activeRole]} replace />;
  }

  return <MemberHome />;
}

function MemberHome() {
  const { data: userData, isLoading } = useCurrentUser();
  const { data: bulletins, isLoading: bulletinsLoading } = useQuery(
    convexQuery(api.bulletins.getMyBulletins, {}),
  );
  const getBillingAttention = useConvexAction(
    api.payments.getCurrentUserBillingAttention,
  );
  const billingLookupStarted = useRef(false);
  const [billingAttention, setBillingAttention] =
    useState<BillingAttentionStatus | null>(null);

  useEffect(() => {
    if (
      !userData ||
      billingLookupStarted.current ||
      hasUserRole(userData, "staff") ||
      hasUserRole(userData, "admin")
    ) {
      return;
    }

    billingLookupStarted.current = true;
    void getBillingAttention({})
      .then((result) => {
        if (
          result.status === "delinquent" ||
          result.status === "missing_default_payment_method"
        ) {
          setBillingAttention(result.status);
        }
      })
      .catch(() => {
        // Billing status is advisory and must never prevent Home from loading.
      });
  }, [getBillingAttention, userData]);

  if (isLoading) {
    return null;
  }

  const nextEvent = bulletins
    ? findNextUpcomingBulletin(bulletins)
    : undefined;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Home</h1>
        <p className="text-muted-foreground">
          Your students, classes, billing, and upcoming events in one place.
        </p>
      </div>
      <div>
        <PwaInstallBanner />
        <BillingAttentionBanner status={billingAttention} />
      </div>
      <NextEventCard
        event={nextEvent}
        isLoading={bulletinsLoading}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MemberCard
          title="My Students"
          description="View and manage the students connected to your account."
          to="/students"
          icon={<GraduationCap />}
        />
        <MemberCard
          title="Enroll in Classes"
          description="Browse available classes and request enrollment."
          to="/classes"
          icon={<BookOpenCheck />}
        />
        <MemberCard
          title="Tuition Plan"
          description="Review your monthly household tuition breakdown."
          to="/tuition-plan"
          icon={<ReceiptText />}
        />
        <MemberCard
          title="Payments"
          description="Open billing tools and manage your payment settings."
          to="/payments"
          icon={<CreditCard />}
        />
      </div>
    </main>
  );
}

type MemberDestination =
  | "/students"
  | "/classes"
  | "/tuition-plan"
  | "/payments";

function MemberCard({
  title,
  description,
  to,
  icon,
}: {
  title: string;
  description: string;
  to: MemberDestination;
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

function NextEventCard({
  event,
  isLoading,
}: {
  event:
    | {
        _id: string;
        title: string;
        subtitle?: string;
        date?: string;
        endDate?: string;
        venue?: { name: string; url?: string };
      }
    | undefined;
  isLoading: boolean;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Next Event</CardTitle>
          <CardDescription>
            The next upcoming event connected to your groups.
          </CardDescription>
        </div>
        <CalendarDays className="text-muted-foreground size-5 shrink-0" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading event…</p>
          ) : event ? (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">
                {formatBulletinDate(event)}
              </p>
              <p className="text-lg font-semibold">{event.title}</p>
              {event.subtitle && (
                <p className="text-muted-foreground text-sm">
                  {event.subtitle}
                </p>
              )}
              {event.venue && (
                <p className="text-muted-foreground text-sm">
                  {event.venue.name}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              There are no upcoming events for your groups.
            </p>
          )}
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link to="/calendar">See all events</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function BillingAttentionBanner({
  status,
}: {
  status: BillingAttentionStatus | null;
}) {
  if (!status || status === "ok") {
    return null;
  }

  const delinquent = status === "delinquent";
  return (
    <Alert
      variant={delinquent ? "destructive" : "default"}
      className={
        delinquent
          ? "mt-4"
          : "mt-4 border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100"
      }
    >
      {delinquent ? <TriangleAlert /> : <CreditCard />}
      <AlertTitle>
        {delinquent
          ? "Your account has a billing issue that needs attention"
          : "No default payment method on file"}
      </AlertTitle>
      <AlertDescription>
        <p>
          {delinquent
            ? "Please review your payment settings in Stripe."
            : "Add a payment method to help avoid billing issues."}
        </p>
        <Button
          asChild
          size="sm"
          variant={delinquent ? "destructive" : "outline"}
          className="mt-2"
        >
          <Link to={billingAttentionPortalHref()}>
            Manage billing in Stripe
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

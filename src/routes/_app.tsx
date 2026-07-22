import { useConvexQuery } from "@convex-dev/react-query";
import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { memo, Suspense, useEffect, useRef } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import { Header } from "~/components/header";
import { MobileBottomNav } from "~/components/mobile-bottom-nav";
import { SidebarSkeleton } from "~/components/SidebarSkeleton";
import { SidebarDataProvider } from "~/contexts/SidebarDataContext";
import { SidebarProvider } from "~/components/ui/sidebar";
import { ActiveRoleProvider } from "~/contexts/ActiveRoleContext";
import { setAppBadge } from "~/lib/push-notifications";
import { useLocation } from "@tanstack/react-router";
import { saveOnboardingReturn } from "~/lib/onboarding-return";
import {
  markStartupOnce,
  measureStartupOnce,
  STARTUP_PERFORMANCE,
} from "~/lib/startup-performance";

export const Route = createFileRoute("/_app")({
  component: AppLayoutComponent,
});

const MemoizedAppSidebar = memo(AppSidebar);
const MemoizedHeader = memo(Header);
const MemoizedMobileBottomNav = memo(MobileBottomNav);

function AppLayoutComponent() {
  const user = useConvexQuery(api.users.current, {});
  const unreadCount = useConvexQuery(api.notifications.unreadCount, {});
  const location = useLocation();
  const onboarding = useConvexQuery(
    api.onboarding.getState,
    user?.onboardingStatus === "pending" ? {} : "skip",
  );

  if (user !== undefined) {
    // The auth marker normally starts this timer. Keep this fallback for
    // cached query results that settle in the same commit as auth restoration.
    markStartupOnce(STARTUP_PERFORMANCE.usersCurrentStart);
    markStartupOnce(STARTUP_PERFORMANCE.usersCurrentEnd);
    measureStartupOnce(
      STARTUP_PERFORMANCE.usersCurrentMeasure,
      STARTUP_PERFORMANCE.usersCurrentStart,
      STARTUP_PERFORMANCE.usersCurrentEnd,
    );
  }

  if (user === undefined) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </main>
    );
  }

  if (user === null) {
    if (location.pathname === "/login") {
      return null;
    }
    return (
      <Navigate
        to="/login"
        search={{ redirect: `${location.pathname}${location.searchStr}` }}
        replace
      />
    );
  }

  if (user.onboardingStatus === "pending" && onboarding === undefined) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </main>
    );
  }

  if (user.onboardingStatus === "pending") {
    const step = onboarding?.onboarding?.currentStep;
    const destination =
      step === "students"
        ? "/register/students"
        : step === "review"
          ? "/register/review"
          : step === "contract"
            ? "/register/contract"
          : step === "complete"
            ? "/register/complete"
            : "/register/profile";
    return (
      <PendingOnboardingRedirect
        destination={destination}
        returnPath={`${location.pathname}${location.searchStr}`}
      />
    );
  }

  markStartupOnce(STARTUP_PERFORMANCE.shellRenderStart);

  return (
    <SidebarProvider>
      <ActiveRoleProvider>
        <SidebarDataProvider>
          <StartupShellMarker />
          <NotificationStateSync unreadCount={unreadCount} />
          <Suspense fallback={<SidebarSkeleton />}>
            <MemoizedAppSidebar />
          </Suspense>
          <div className="flex min-w-0 w-full max-w-full flex-1 flex-col overflow-x-clip overscroll-contain pb-24 md:pb-0">
            <MemoizedHeader />
            <div className="min-w-0 max-w-full">
              <Outlet />
            </div>
          </div>
          <MemoizedMobileBottomNav />
        </SidebarDataProvider>
      </ActiveRoleProvider>
    </SidebarProvider>
  );
}

function StartupShellMarker() {
  useEffect(() => {
    markStartupOnce(STARTUP_PERFORMANCE.shellRenderEnd);
    measureStartupOnce(
      STARTUP_PERFORMANCE.shellRenderMeasure,
      STARTUP_PERFORMANCE.shellRenderStart,
      STARTUP_PERFORMANCE.shellRenderEnd,
    );
    measureStartupOnce(
      STARTUP_PERFORMANCE.startupToShellMeasure,
      STARTUP_PERFORMANCE.hydrationStart,
      STARTUP_PERFORMANCE.shellRenderEnd,
    );
  }, []);

  return null;
}

function PendingOnboardingRedirect({
  destination,
  returnPath,
}: {
  destination: string;
  returnPath: string;
}) {
  useEffect(() => {
    if (returnPath.startsWith("/trial")) saveOnboardingReturn(returnPath);
  }, [returnPath]);
  return <Navigate to={destination as never} replace />;
}

function NotificationStateSync({
  unreadCount,
}: {
  unreadCount: number | undefined;
}) {
  const baseTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (unreadCount === undefined) return;

    baseTitleRef.current ??= document.title.replace(/^\(\d+\)\s*/, "");
    document.title =
      unreadCount > 0
        ? `(${unreadCount}) ${baseTitleRef.current}`
        : baseTitleRef.current;
    void setAppBadge(unreadCount);
  }, [unreadCount]);

  useEffect(
    () => () => {
      if (baseTitleRef.current) document.title = baseTitleRef.current;
    },
    [],
  );

  return null;
}

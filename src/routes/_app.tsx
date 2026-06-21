import { useConvexQuery } from "@convex-dev/react-query";
import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { memo, Suspense, useEffect, useRef } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import { Header } from "~/components/header";
import { SidebarSkeleton } from "~/components/SidebarSkeleton";
import { SidebarDataProvider } from "~/contexts/SidebarDataContext";
import { SidebarProvider } from "~/components/ui/sidebar";
import { ActiveRoleProvider } from "~/contexts/ActiveRoleContext";
import { setAppBadge } from "~/lib/push-notifications";
import { useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/_app")({
  component: AppLayoutComponent,
});

const MemoizedAppSidebar = memo(AppSidebar);
const MemoizedHeader = memo(Header);

function AppLayoutComponent() {
  const user = useConvexQuery(api.users.current, {});
  const unreadCount = useConvexQuery(api.notifications.unreadCount, {});
  const location = useLocation();
  const onboarding = useConvexQuery(
    api.onboarding.getState,
    user?.onboardingStatus === "pending" ? {} : "skip",
  );

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
    return <Navigate to={destination} replace />;
  }

  return (
    <SidebarProvider>
      <ActiveRoleProvider>
        <SidebarDataProvider>
          <NotificationStateSync unreadCount={unreadCount} />
          <Suspense fallback={<SidebarSkeleton />}>
            <MemoizedAppSidebar />
          </Suspense>
          <div className="flex flex-1 flex-col overscroll-contain">
            <MemoizedHeader />
            <Outlet />
          </div>
        </SidebarDataProvider>
      </ActiveRoleProvider>
    </SidebarProvider>
  );
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

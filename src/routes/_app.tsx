import { useConvexQuery } from "@convex-dev/react-query";
import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { memo, Suspense } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import { Header } from "~/components/header";
import { SidebarSkeleton } from "~/components/SidebarSkeleton";
import { SidebarDataProvider } from "~/contexts/SidebarDataContext";
import { SidebarProvider } from "~/components/ui/sidebar";
import { ActiveRoleProvider } from "~/contexts/ActiveRoleContext";

export const Route = createFileRoute("/_app")({
  component: AppLayoutComponent,
});

const MemoizedAppSidebar = memo(AppSidebar);
const MemoizedHeader = memo(Header);

function AppLayoutComponent() {
  const user = useConvexQuery(api.users.current, {});
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
    return <Navigate to="/login" replace />;
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

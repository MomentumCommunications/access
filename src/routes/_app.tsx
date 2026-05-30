import { Outlet, createFileRoute } from "@tanstack/react-router";
import { memo, Suspense } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import { Header } from "~/components/header";
import { SidebarSkeleton } from "~/components/SidebarSkeleton";
import { SidebarDataProvider } from "~/contexts/SidebarDataContext";
import { SidebarProvider } from "~/components/ui/sidebar";

export const Route = createFileRoute("/_app")({
  component: AppLayoutComponent,
});

const MemoizedAppSidebar = memo(AppSidebar);
const MemoizedHeader = memo(Header);

function AppLayoutComponent() {
  return (
    <SidebarProvider>
      <SidebarDataProvider>
        <Suspense fallback={<SidebarSkeleton />}>
          <MemoizedAppSidebar />
        </Suspense>
        <div className="flex flex-1 flex-col overscroll-contain">
          <MemoizedHeader />
          <Outlet />
        </div>
      </SidebarDataProvider>
    </SidebarProvider>
  );
}

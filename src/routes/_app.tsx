import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { SidebarProvider } from "~/components/ui/sidebar";
import { AppSidebar } from "~/components/app-sidebar";
import { SidebarDataProvider } from "~/contexts/SidebarDataContext";
import { Header } from "~/components/header";
import { useUnreadCounts } from "~/hooks/useUnreadCounts";
import { useDocumentTitle } from "~/hooks/useDocumentTitle";
import { memo, Suspense } from "react";
import { SidebarSkeleton } from "~/components/SidebarSkeleton";

export const Route = createFileRoute("/_app")({
  component: AppLayoutComponent,
});

// Memoize sidebar and header components to prevent unnecessary re-renders
const MemoizedAppSidebar = memo(AppSidebar);
const MemoizedHeader = memo(Header);

// Separate component for sidebar data loading
const SidebarWithData = memo(() => {
  const user = useUser();

  // Only load essential user data immediately
  const { data: convexUser } = useQuery({
    ...convexQuery(api.users.getUserByClerkId, { ClerkId: user.user?.id }),
    enabled: !!user.user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  // Lazy load unread counts for document title
  const {
    publicChannelUnreads,
    privateChannelUnreads,
    dmUnreads,
    isLoading: unreadLoading,
  } = useUnreadCounts(convexUser?._id);

  // Update document title with unread count
  useDocumentTitle({
    publicChannelUnreads,
    privateChannelUnreads,
    dmUnreads,
    isLoading: unreadLoading,
  });

  return <MemoizedAppSidebar />;
});
SidebarWithData.displayName = "SidebarWithData";

function AppLayoutComponent() {
  return (
    <SidebarProvider>
      <SidebarDataProvider>
        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarWithData />
        </Suspense>
        <div className="flex flex-1 flex-col overscroll-contain">
          <MemoizedHeader />
          <Outlet />
        </div>
      </SidebarDataProvider>
    </SidebarProvider>
  );
}

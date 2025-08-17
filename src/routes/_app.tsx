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
import { memo } from "react";

export const Route = createFileRoute("/_app")({
  component: AppLayoutComponent,
});

// Memoize sidebar and header components to prevent unnecessary re-renders
const MemoizedAppSidebar = memo(AppSidebar);
const MemoizedHeader = memo(Header);

function AppLayoutComponent() {
  const user = useUser();

  // Pre-fetch all sidebar data at layout level to ensure it's cached
  const { data: convexUser } = useQuery({
    ...convexQuery(api.users.getUserByClerkId, { ClerkId: user.user?.id }),
    enabled: !!user.user?.id,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // Pre-fetch channel data with longer stale times for better performance
  useQuery({
    ...convexQuery(api.channels.getPublicChannels, {}),
    enabled: !!convexUser,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  useQuery({
    ...convexQuery(api.channels.getChannelsByUser, { user: convexUser?._id }),
    enabled: !!convexUser?._id,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  useQuery({
    ...convexQuery(api.channels.getDMsByUser, { user: convexUser?._id }),
    enabled: !!convexUser?._id,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // Get unread counts and update document title
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

  return (
    <SidebarDataProvider>
      <SidebarProvider>
        <MemoizedAppSidebar />
        <div className="flex flex-1 flex-col overscroll-contain">
          <MemoizedHeader />
          <Outlet />
        </div>
      </SidebarProvider>
    </SidebarDataProvider>
  );
}

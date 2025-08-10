import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { SidebarProvider } from "~/components/ui/sidebar";
import { AppSidebar } from "~/components/app-sidebar";
import { SidebarDataProvider } from "~/contexts/SidebarDataContext";
import { Header } from "~/components/header";

export const Route = createFileRoute("/_app")({
  component: AppLayoutComponent,
});

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

  // Pre-fetch channel data
  useQuery({
    ...convexQuery(api.channels.getPublicChannels, {}),
    enabled: !!convexUser,
    staleTime: 30 * 60 * 1000,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  useQuery({
    ...convexQuery(api.channels.getChannelsByUser, { user: convexUser?._id }),
    enabled: !!convexUser?._id,
    staleTime: 30 * 60 * 1000,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  useQuery({
    ...convexQuery(api.channels.getDMsByUser, { user: convexUser?._id }),
    enabled: !!convexUser?._id,
    staleTime: 15 * 60 * 1000,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  return (
    <SidebarDataProvider>
      <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <Header />
          <Outlet />
        </div>
      </SidebarProvider>
    </SidebarDataProvider>
  );
}
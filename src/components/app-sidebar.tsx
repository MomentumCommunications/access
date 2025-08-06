import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { ChevronsRight, ChevronUp, Hash, Home, Lock } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "~/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { NewChannel } from "./new-channel";

export function AppSidebar() {
  const user = useUser();

  const { data: convexUser } = useQuery(
    convexQuery(api.users.getUserByClerkId, { ClerkId: user.user?.id }),
  );

  const { data: publicChannels, isLoading: isPublicChannelsLoading } = useQuery(
    convexQuery(api.channels.getPublicChannels, {}),
  );

  const { data: privateChannels, isLoading: isPrivateChannelsLoading } =
    useQuery(
      convexQuery(api.channels.getChannelsByUser, { user: convexUser?._id }),
    );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="hover:bg-transparent" asChild>
              <div className="text-nowrap text-center text-lg font-semibold uppercase tracking-wide">
                <ChevronsRight color="#ce2128" />
                ACCESS MOMENTUM
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenuButton asChild>
            <a href="/">
              <Home />
              <span>Home</span>
            </a>
          </SidebarMenuButton>
        </SidebarGroup>
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Chat
                <ChevronUp className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              {convexUser?.role === "admin" && (
                <NewChannel userId={convexUser._id} />
              )}
              {isPublicChannelsLoading ? (
                <SidebarMenuSkeleton />
              ) : (
                publicChannels?.map((channel) => (
                  <SidebarMenuButton asChild key={channel?._id}>
                    <a href={`/channel/${channel?._id}`}>
                      <Hash />
                      <span>{channel?.name}</span>
                    </a>
                  </SidebarMenuButton>
                ))
              )}
              {isPrivateChannelsLoading ? (
                <>
                  <SidebarMenuSkeleton />
                  <SidebarMenuSkeleton />
                  <SidebarMenuSkeleton />
                </>
              ) : (
                privateChannels?.map((channel) => (
                  <SidebarMenuButton asChild key={channel?._id}>
                    <a href={`/channel/${channel?._id}`}>
                      <Lock />
                      <span>{channel?.name}</span>
                    </a>
                  </SidebarMenuButton>
                ))
              )}
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}

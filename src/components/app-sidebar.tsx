import { SignedIn, SignedOut } from "@clerk/tanstack-react-start";
import { memo, useCallback } from "react";
import {
  ChevronsRight,
  ChevronUp,
  Hash,
  Home,
  Lock,
  MessageSquare,
} from "lucide-react";
import { Id } from "convex/_generated/dataModel";
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
  SidebarMenuBadge,
} from "~/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { NewChannel } from "./new-channel";
import { NewDm } from "./new-dm";
import { channelNameOrFallback } from "~/lib/utils";
import { useSidebarDataContext } from "~/contexts/SidebarDataContext";

// Memoized components for individual sidebar items
const PublicChannelItem = memo<{
  channel: { _id: Id<"channels">; name?: string; description?: string };
  unreadCount: number;
}>(({ channel, unreadCount }) => (
  <SidebarMenuItem key={channel._id}>
    <SidebarMenuButton asChild>
      <a href={`/channel/${channel._id}`}>
        <Hash />
        <span>{channelNameOrFallback(channel.name)}</span>
      </a>
    </SidebarMenuButton>
    {unreadCount > 0 && (
      <SidebarMenuBadge>
        {unreadCount > 99 ? "99+" : unreadCount}
      </SidebarMenuBadge>
    )}
  </SidebarMenuItem>
));
PublicChannelItem.displayName = "PublicChannelItem";

const PrivateChannelItem = memo<{
  channel: { _id: Id<"channels">; name?: string; description?: string };
  unreadCount: number;
}>(({ channel, unreadCount }) => (
  <SidebarMenuItem key={channel._id}>
    <SidebarMenuButton asChild>
      <a href={`/channel/${channel._id}`}>
        <Lock />
        <span>{channelNameOrFallback(channel.name)}</span>
      </a>
    </SidebarMenuButton>
    {unreadCount > 0 && (
      <SidebarMenuBadge>
        {unreadCount > 99 ? "99+" : unreadCount}
      </SidebarMenuBadge>
    )}
  </SidebarMenuItem>
));
PrivateChannelItem.displayName = "PrivateChannelItem";

const DMItem = memo<{
  channel: { _id: Id<"channels">; otherMembers: string };
  unreadCount: number;
}>(({ channel, unreadCount }) => (
  <SidebarMenuItem key={channel._id}>
    <SidebarMenuButton asChild>
      <a href={`/dm/${channel._id}`}>
        <MessageSquare />
        <span>{channel.otherMembers}</span>
      </a>
    </SidebarMenuButton>
    {unreadCount > 0 && (
      <SidebarMenuBadge>
        {unreadCount > 99 ? "99+" : unreadCount}
      </SidebarMenuBadge>
    )}
  </SidebarMenuItem>
));
DMItem.displayName = "DMItem";

const AppSidebarComponent = memo(() => {
  const {
    convexUser,
    publicChannels,
    privateChannels,
    dms,
    isPublicChannelsLoading,
    isPrivateChannelsLoading,
    isDMsLoading,
    publicChannelUnreads,
    privateChannelUnreads,
    dmUnreads,
  } = useSidebarDataContext();

  // Memoize the channel rendering functions to prevent unnecessary re-renders
  const renderPublicChannel = useCallback((channel: typeof publicChannels[0]) => {
    if (!channel?._id) return null;
    const unreadCount = publicChannelUnreads[channel._id] || 0;
    
    return (
      <PublicChannelItem
        key={channel._id}
        channel={channel}
        unreadCount={unreadCount}
      />
    );
  }, [publicChannelUnreads]);

  const renderPrivateChannel = useCallback((channel: typeof privateChannels[0]) => {
    if (!channel?._id) return null;
    const unreadCount = privateChannelUnreads[channel._id] || 0;
    
    return (
      <PrivateChannelItem
        key={channel._id}
        channel={channel}
        unreadCount={unreadCount}
      />
    );
  }, [privateChannelUnreads]);

  const renderDMChannel = useCallback((channel: typeof dms[0]) => {
    if (!channel?._id) return null;
    const unreadCount = dmUnreads[channel._id] || 0;
    
    return (
      <DMItem
        key={channel._id}
        channel={channel}
        unreadCount={unreadCount}
      />
    );
  }, [dmUnreads]);

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
            <a href="/home">
              <Home />
              <span>Home</span>
            </a>
          </SidebarMenuButton>
        </SidebarGroup>
        <SignedIn>
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
                <SidebarMenu>
                  {isPublicChannelsLoading ? (
                    <SidebarMenuSkeleton />
                  ) : (
                    publicChannels?.map(renderPublicChannel)
                  )}
                  {isPrivateChannelsLoading ? (
                    <>
                      <SidebarMenuSkeleton />
                      <SidebarMenuSkeleton />
                      <SidebarMenuSkeleton />
                    </>
                  ) : (
                    privateChannels?.map(renderPrivateChannel)
                  )}
                </SidebarMenu>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger>
                  Direct Messages
                  <ChevronUp className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <NewDm userId={convexUser?._id} />
                <SidebarMenu>
                  {isDMsLoading ? (
                    <SidebarMenuSkeleton />
                  ) : (
                    dms?.map(renderDMChannel)
                  )}
                </SidebarMenu>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        </SignedIn>
        <SignedOut>
          <SidebarGroup>
            <SidebarGroupLabel>Chat</SidebarGroupLabel>
            <SidebarMenuButton asChild>
              <a href="/sign-in">Must be signed in to chat</a>
            </SidebarMenuButton>
          </SidebarGroup>
        </SignedOut>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
});

AppSidebarComponent.displayName = "AppSidebar";

export const AppSidebar = AppSidebarComponent;

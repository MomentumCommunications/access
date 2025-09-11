import { SignedIn, SignedOut } from "@clerk/tanstack-react-start";
import { memo, useCallback, useRef } from "react";
import {
  ChevronUp,
  Cog,
  Hash,
  HelpCircle,
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
  useSidebar,
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
import { Link } from "@tanstack/react-router";

// Memoized components for individual sidebar items
const PublicChannelItem = memo<{
  channel: { _id: Id<"channels">; name?: string; description: string };
  // eslint-disable-next-line react/prop-types
}>(({ channel }) => (
  // eslint-disable-next-line react/prop-types
  <SidebarMenuItem key={channel._id}>
    <SidebarMenuButton asChild onClick={() => useSidebar().toggleSidebar()}>
      {/* eslint-disable-next-line react/prop-types */}
      <Link to="/channel/$channelId" params={{ channelId: channel._id }}>
        <Hash />
        {/* eslint-disable-next-line react/prop-types */}
        <span>{channelNameOrFallback(channel.name)}</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
));
PublicChannelItem.displayName = "PublicChannelItem";

const PrivateChannelItem = memo<{
  channel: { _id: Id<"channels">; name?: string; description: string };
  // eslint-disable-next-line react/prop-types
}>(({ channel }) => (
  // eslint-disable-next-line react/prop-types
  <SidebarMenuItem key={channel._id}>
    <SidebarMenuButton asChild onClick={() => useSidebar().toggleSidebar()}>
      {/* eslint-disable-next-line react/prop-types */}
      <Link to="/channel/$channelId" params={{ channelId: channel._id }}>
        <Lock />
        {/* eslint-disable-next-line react/prop-types */}
        <span>{channelNameOrFallback(channel.name)}</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
));
PrivateChannelItem.displayName = "PrivateChannelItem";

const DMItem = memo<{
  channel: { _id: Id<"channels">; otherMembers: string };
  // eslint-disable-next-line react/prop-types
}>(({ channel }) => (
  // eslint-disable-next-line react/prop-types
  <SidebarMenuItem key={channel._id}>
    <SidebarMenuButton asChild onClick={() => useSidebar().toggleSidebar()}>
      {/* eslint-disable-next-line react/prop-types */}
      <Link to="/dm/$dmId" params={{ dmId: channel._id }}>
        <MessageSquare />
        {/* eslint-disable-next-line react/prop-types */}
        <span>{channel.otherMembers}</span>
      </Link>
    </SidebarMenuButton>
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
  } = useSidebarDataContext();

  const sidebar = useSidebar();

  // Refs to track touch positions
  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);

  // Swipe threshold in pixels
  const swipeThreshold = 50;

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current !== null && touchCurrentX.current !== null) {
      const deltaX = touchCurrentX.current - touchStartX.current;

      // Swipe from left edge to right to open sidebar
      if (touchStartX.current < 30 && deltaX > swipeThreshold) {
        sidebar.toggleSidebar();
      }

      // Swipe right to left to close sidebar if open
      if (sidebar.open && deltaX < -swipeThreshold) {
        sidebar.toggleSidebar();
      }
    }
    touchStartX.current = null;
    touchCurrentX.current = null;
  };

  // Memoize the channel rendering functions to prevent unnecessary re-renders
  const renderPublicChannel = useCallback(
    (channel: NonNullable<typeof publicChannels>[number]) => {
      if (!channel?._id) return null;

      return <PublicChannelItem key={channel._id} channel={channel} />;
    },
    [],
  );

  const renderPrivateChannel = useCallback(
    (channel: NonNullable<typeof privateChannels>[number]) => {
      if (!channel?._id) return null;

      return <PrivateChannelItem key={channel._id} channel={channel} />;
    },
    [],
  );

  const renderDMChannel = useCallback(
    (channel: NonNullable<typeof dms>[number]) => {
      if (!channel?._id) return null;

      return <DMItem key={channel._id} channel={channel} />;
    },
    [],
  );

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ height: "100vh" }} // Ensure full height for touch detection
    >
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="hover:bg-transparent" asChild>
                <div className="text-nowrap text-center text-lg font-semibold uppercase tracking-wide">
                  <img
                    src="/icons/icon-120x120.png"
                    alt="Access Momentum Logo"
                    className="h-4 w-4 aspect-square rounded-lg"
                  />
                  ACCESS MOMENTUM
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenuButton
              asChild
              onClick={() => useSidebar().toggleSidebar()}
            >
              <Link to="/home">
                <Home />
                <span>Home</span>
              </Link>
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
                    {publicChannels?.length === 0 && (
                      <SidebarMenuItem>
                        <SidebarMenuButton disabled>
                          no public channels
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
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
                    {privateChannels?.length === 0 && null}
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
                    {dms?.length === 0 && (
                      <SidebarMenuItem>
                        <SidebarMenuButton disabled>no DMs</SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
            <SidebarGroup>
              <SidebarGroupLabel>Etc</SidebarGroupLabel>
              <SidebarMenuButton
                asChild
                onClick={() => useSidebar().toggleSidebar()}
              >
                <Link to="/settings">
                  <Cog />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuButton asChild>
                <a href="/help">
                  <HelpCircle />
                  <span>Help</span>
                </a>
              </SidebarMenuButton>
            </SidebarGroup>
          </SignedIn>
          <SignedOut>
            <SidebarGroup>
              <SidebarGroupLabel>Chat</SidebarGroupLabel>
              <SidebarMenuButton asChild>
                <a href="/sign-in">Must be signed in to chat</a>
              </SidebarMenuButton>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Etc</SidebarGroupLabel>
              <SidebarMenuButton asChild>
                <Link to="/settings">
                  <Cog />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuButton asChild>
                <a href="/help">
                  <HelpCircle />
                  <span>Help</span>
                </a>
              </SidebarMenuButton>
            </SidebarGroup>
          </SignedOut>
        </SidebarContent>
        <SidebarFooter />
      </Sidebar>
    </div>
  );
});

AppSidebarComponent.displayName = "AppSidebar";

export const AppSidebar = AppSidebarComponent;

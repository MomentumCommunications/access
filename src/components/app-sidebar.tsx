import {
  SignedIn,
  SignedOut,
  SignIn,
  useUser,
} from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import {
  ChevronsRight,
  ChevronUp,
  Hash,
  Home,
  Lock,
  MessageSquare,
} from "lucide-react";
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
import { NewDm } from "./new-dm";
import { channelNameOrFallback } from "~/lib/utils";

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

  const { data: dms, isLoading: isDMsLoading } = useQuery(
    convexQuery(api.channels.getDMsByUser, { user: convexUser?._id }),
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
                {isPublicChannelsLoading ? (
                  <SidebarMenuSkeleton />
                ) : (
                  publicChannels?.map((channel) => (
                    <SidebarMenuButton asChild key={channel?._id}>
                      <a href={`/channel/${channel?._id}`}>
                        <Hash />
                        <span>{channelNameOrFallback(channel?.name)}</span>
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
                        <span>{channelNameOrFallback(channel?.name)}</span>
                      </a>
                    </SidebarMenuButton>
                  ))
                )}
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
                {isDMsLoading ? (
                  <SidebarMenuSkeleton />
                ) : (
                  dms?.map((channel) => (
                    <SidebarMenuButton asChild key={channel?._id}>
                      <a href={`/dm/${channel?._id}`}>
                        <MessageSquare />
                        <span>{channel.otherMembers}</span>
                      </a>
                    </SidebarMenuButton>
                  ))
                )}
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
}

import { useUser } from "@clerk/tanstack-react-start";
import { ChevronsRight, Hash, Home } from "lucide-react";
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
} from "~/components/ui/sidebar";

export function AppSidebar() {
  const user = useUser();

  if (!user) {
    return null;
  }

  // const { data: userData, isLoading } = useQuery(
  //   convexQuery(api.users.getUserById, {
  //     id: user.user?.publicMetadata.convexId as Id<"users">,
  //   }),
  // );

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
        <SidebarGroup>
          <SidebarGroupLabel>Chat</SidebarGroupLabel>
          <SidebarMenuButton asChild>
            <a href="/chat/general">
              <Hash />
              <span>General</span>
            </a>
          </SidebarMenuButton>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}

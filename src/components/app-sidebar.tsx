import { memo, useRef } from "react";
import { Cog, HelpCircle, Home, LogIn } from "lucide-react";
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
  useSidebar,
} from "~/components/ui/sidebar";
import { useSidebarDataContext } from "~/contexts/SidebarDataContext";
import { Link } from "@tanstack/react-router";
import { NavUser } from "./user";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Spinner } from "./ui/spinner";
import { Button } from "./ui/button";

const AppSidebarComponent = memo(() => {
  const { convexUser } = useSidebarDataContext();
  const sidebar = useSidebar();

  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);
  const swipeThreshold = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current !== null && touchCurrentX.current !== null) {
      const deltaX = touchCurrentX.current - touchStartX.current;

      if (touchStartX.current < 30 && deltaX > swipeThreshold) {
        sidebar.toggleSidebar();
      }

      if (sidebar.open && deltaX < -swipeThreshold) {
        sidebar.toggleSidebar();
      }
    }

    touchStartX.current = null;
    touchCurrentX.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ height: "100vh" }}
    >
      <Sidebar variant="floating" collapsible="icon">
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
            <SidebarMenuButton asChild onClick={() => sidebar.toggleSidebar()}>
              <Link to="/home">
                <Home />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Etc</SidebarGroupLabel>
            <SidebarMenuButton asChild onClick={() => sidebar.toggleSidebar()}>
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
        </SidebarContent>
        <SidebarFooter>
          <AuthLoading>
            <Spinner />
          </AuthLoading>
          <Unauthenticated>
            <Button variant="outline" asChild>
              <a href="/login">
                <LogIn />
                <span>Sign In</span>
              </a>
            </Button>
          </Unauthenticated>
          <Authenticated>
            {convexUser && <NavUser user={convexUser} />}
          </Authenticated>
        </SidebarFooter>
      </Sidebar>
    </div>
  );
});

AppSidebarComponent.displayName = "AppSidebar";

export const AppSidebar = AppSidebarComponent;

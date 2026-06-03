import { memo } from "react";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CoffeeIcon,
  Cog,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogIn,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
import { canAccessAdmin, canAccessStaff, UserRole } from "~/lib/roles";

const AppSidebarComponent = memo(() => {
  const { convexUser } = useSidebarDataContext();
  const { isMobile, setOpenMobile } = useSidebar();
  const role = convexUser?.role as UserRole | undefined;
  const showStaff = canAccessStaff(role);
  const showAdmin = canAccessAdmin(role);

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <div className="h-svh">
      <Sidebar variant="floating" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="hover:bg-transparent" asChild>
                <div className="text-nowrap text-center text-lg font-semibold uppercase tracking-wide">
                  <img
                    src="/icons/icon-120x120.png"
                    alt="Access Momentum Logo"
                    className="aspect-square h-4 w-4 rounded-lg"
                  />
                  ACCESS MOMENTUM
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Home"
                    onClick={closeMobileSidebar}
                  >
                    <Link to="/home">
                      <Home />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Students"
                    onClick={closeMobileSidebar}
                  >
                    <Link to="/students">
                      <GraduationCap />
                      <span>Students</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Classes"
                    onClick={closeMobileSidebar}
                  >
                    <Link to="/classes">
                      <BookOpen />
                      <span>Classes</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {showStaff && (
            <SidebarGroup>
              <SidebarGroupLabel>Staff</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Staffroom"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/staff">
                        <CoffeeIcon />
                        <span>Staff Room</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Attendance"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/staff/attendance">
                        <CalendarCheck />
                        <span>Attendance</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="My Classes"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/staff/classes">
                        <GraduationCap />
                        <span>My Classes</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
          {showAdmin && (
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Admin"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/admin">
                        <LayoutDashboard />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Accounts"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/admin/accounts">
                        <Users />
                        <span>Accounts</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Students"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/admin/students">
                        <GraduationCap />
                        <span>Students</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Classes"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/admin/classes">
                        <BookOpen />
                        <span>All Classes</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Scheduling"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/admin/scheduling">
                        <CalendarDays />
                        <span>Scheduling</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
          <SidebarGroup>
            <SidebarGroupLabel>Etc</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href="https://momentumdanceavl.com"
                    >
                      <ExternalLink />
                      <span>Main Site</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Settings"
                    onClick={closeMobileSidebar}
                  >
                    <Link to="/settings">
                      <Cog />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Help"
                    onClick={closeMobileSidebar}
                  >
                    <Link to="/help">
                      <HelpCircle />
                      <span>Help</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <AuthLoading>
              <SidebarMenuItem>
                <SidebarMenuButton disabled>
                  <Spinner />
                  <span>Loading...</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </AuthLoading>
            <Unauthenticated>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  variant="outline"
                  tooltip="Sign In"
                  onClick={closeMobileSidebar}
                >
                  <Link to="/login">
                    <LogIn />
                    <span>Sign In</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </Unauthenticated>
          </SidebarMenu>
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

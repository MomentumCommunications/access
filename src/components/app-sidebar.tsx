import { memo } from "react";
import {
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  CoffeeIcon,
  Cog,
  DollarSign,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogIn,
  CreditCard,
  ReceiptText,
  Users,
  Group,
  SportShoe,
  PersonStanding,
  BookOpen,
  BarChart3,
  Calendar,
  Newspaper,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { useSidebarDataContext } from "~/contexts/SidebarDataContext";
import { Link, useLocation } from "@tanstack/react-router";
import { NavUser } from "./user";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Spinner } from "./ui/spinner";
import { useActiveRole } from "~/contexts/ActiveRoleContext";
import { RoleSwitcher } from "./role-switcher";

const AppSidebarComponent = memo(() => {
  const { convexUser } = useSidebarDataContext();
  const { isMobile, setOpenMobile } = useSidebar();
  const { activeRole } = useActiveRole();
  const { pathname } = useLocation();

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
          <RoleSwitcher />
        </SidebarHeader>
        <SidebarContent>
          {activeRole === "member" ? (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, "/home", {
                        exact: true,
                      })}
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
                      isActive={isActivePath(pathname, "/students")}
                      tooltip="Students"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/students">
                        <PersonStanding />
                        <span>My Students</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, "/classes")}
                      tooltip="Classes"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/classes">
                        <BookOpenCheck />
                        <span>Enroll in Classes</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, "/tuition-plan")}
                      tooltip="Tuition Plan"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/tuition-plan">
                        <ReceiptText />
                        <span>Tuition Plan</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
          {activeRole === "staff" ? (
            <SidebarGroup>
              <SidebarGroupLabel>Staff</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, "/staff", {
                        exact: true,
                      })}
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
                      isActive={isActivePath(pathname, "/staff/attendance")}
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
                      isActive={isActivePath(pathname, "/staff/classes")}
                      tooltip="My Classes"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/staff/classes">
                        <BookOpen />
                        <span>My Classes</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
          {activeRole === "admin" ? (
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, "/admin", {
                        exact: true,
                      })}
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
                      isActive={isActivePath(pathname, "/admin/accounts")}
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
                      isActive={isActivePath(pathname, "/admin/students")}
                      tooltip="Students"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/admin/students">
                        <PersonStanding />
                        <span>Students</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, "/admin/groups")}
                      tooltip="Groups"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/admin/groups">
                        <Group />
                        <span>Groups</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, "/admin/bulletins")}
                      tooltip="Bulletins"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/admin/bulletins">
                        <Newspaper />
                        <span>Bulletins</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, "/admin/reports")}
                      tooltip="Reports"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/admin/reports">
                        <BarChart3 />
                        <span>Reports</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, "/admin/scheduling")}
                      tooltip="Scheduling"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/admin/scheduling">
                        <CalendarDays />
                        <span>Scheduling</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <Collapsible asChild className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={isAdminClassesSectionActive(pathname)}
                          tooltip="Classes"
                        >
                          <SportShoe />
                          <span>Classes</span>
                          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {[
                            ["All", "/admin/classes"],
                            ["Create", "/admin/classes/create"],
                            ["Attendance", "/admin/attendance"],
                            ["Enrollments", "/admin/classes/enrollments"],
                            ["Privates", "/admin/privates"],
                          ].map(([label, to]) => (
                            <SidebarMenuSubItem key={to}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isAdminClassesSubItemActive(
                                  pathname,
                                  to,
                                )}
                                onClick={closeMobileSidebar}
                              >
                                <Link to={to as never}>{label}</Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                  <Collapsible asChild className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={isActivePath(pathname, "/admin/billing")}
                          tooltip="Billing"
                        >
                          <DollarSign />
                          <span>Billing</span>
                          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {[
                            ["Pricing", "/admin/billing/pricing"],
                            ["Adjustments", "/admin/billing/adjustments"],
                            ["Tuitions", "/admin/billing/tuitions"],
                            ["Charges", "/admin/billing/charges"],
                            ["Runs", "/admin/billing/runs"],
                          ].map(([label, to]) => (
                            <SidebarMenuSubItem key={to}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActivePath(pathname, to)}
                                onClick={closeMobileSidebar}
                              >
                                <Link to={to as never}>{label}</Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
          <SidebarGroup>
            <SidebarGroupLabel>Etc</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(pathname, "/calendar")}
                    tooltip="Calendar"
                    onClick={closeMobileSidebar}
                  >
                    <Link to="/calendar">
                      <Calendar />
                      <span>Calendar</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(pathname, "/payments")}
                    tooltip="Payments"
                    onClick={closeMobileSidebar}
                  >
                    <Link to="/payments">
                      <CreditCard />
                      <span>Payments</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(pathname, "/settings")}
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
                    isActive={isActivePath(pathname, "/help")}
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

function isActivePath(
  pathname: string,
  target: string,
  options: { exact?: boolean } = {},
) {
  const normalizedTarget = target.endsWith("/")
    ? target.slice(0, -1)
    : target;
  const normalizedPath = pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;

  if (options.exact) {
    return normalizedPath === normalizedTarget;
  }
  return (
    normalizedPath === normalizedTarget ||
    normalizedPath.startsWith(`${normalizedTarget}/`)
  );
}

function isAdminClassesSectionActive(pathname: string) {
  return (
    isActivePath(pathname, "/admin/classes") ||
    isActivePath(pathname, "/admin/attendance") ||
    isActivePath(pathname, "/admin/privates")
  );
}

function isAdminClassesSubItemActive(pathname: string, target: string) {
  if (target === "/admin/classes") {
    return (
      isActivePath(pathname, "/admin/classes") &&
      !isActivePath(pathname, "/admin/classes/create") &&
      !isActivePath(pathname, "/admin/classes/enrollments")
    );
  }
  return isActivePath(pathname, target);
}

import { memo, useState } from "react";
import type { LucideIcon } from "lucide-react";
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
  MessageCircle,
  CreditCard,
  ReceiptText,
  Users,
  Group,
  SportShoe,
  PersonStanding,
  BookOpen,
  BarChart3,
  Calendar,
  CalendarPlus,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

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
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, "/trial")}
                      tooltip="Paid Trial"
                      onClick={closeMobileSidebar}
                    >
                      <Link to="/trial">
                        <CalendarPlus />
                        <span>Request a Trial</span>
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
                  <SidebarCollapsibleGroup
                    label="Classes"
                    icon={SportShoe}
                    isActive={isAdminClassesSectionActive(pathname)}
                    items={ADMIN_CLASS_ITEMS.map(([label, to]) => ({
                      label,
                      to,
                      isActive: isAdminClassesSubItemActive(pathname, to),
                    }))}
                    onNavigate={closeMobileSidebar}
                  />
                  <SidebarCollapsibleGroup
                    label="Billing"
                    icon={DollarSign}
                    isActive={isActivePath(pathname, "/admin/billing")}
                    items={ADMIN_BILLING_ITEMS.map(([label, to]) => ({
                      label,
                      to,
                      isActive: isActivePath(pathname, to),
                    }))}
                    onNavigate={closeMobileSidebar}
                  />
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
                    isActive={isActivePath(pathname, "/contact")}
                    tooltip="Contact"
                    onClick={closeMobileSidebar}
                  >
                    <Link to="/contact">
                      <MessageCircle />
                      <span>Contact</span>
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

const ADMIN_CLASS_ITEMS = [
  ["All", "/admin/classes"],
  ["Create", "/admin/classes/create"],
  ["Attendance", "/admin/attendance"],
  ["Enrollments", "/admin/classes/enrollments"],
  ["Trials", "/admin/classes/trials"],
  ["Privates", "/admin/privates"],
] as const;

const ADMIN_BILLING_ITEMS = [
  ["Pricing", "/admin/billing/pricing"],
  ["Adjustments", "/admin/billing/adjustments"],
  ["Tuitions", "/admin/billing/tuitions"],
  ["Charges", "/admin/billing/charges"],
  ["Runs", "/admin/billing/runs"],
] as const;

type SidebarCollapsibleGroupProps = {
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  items: Array<{
    label: string;
    to: string;
    isActive: boolean;
  }>;
  onNavigate: () => void;
};

function SidebarCollapsibleGroup({
  label,
  icon: Icon,
  isActive,
  items,
  onNavigate,
}: SidebarCollapsibleGroupProps) {
  const { state, isMobile } = useSidebar();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const usesPopover = state === "collapsed" && !isMobile;

  if (usesPopover) {
    return (
      <SidebarMenuItem>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              isActive={isActive}
              tooltip={label}
              aria-label={`Open ${label} navigation`}
            >
              <Icon />
              <span>{label}</span>
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-56 p-2"
          >
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold">
              <Icon className="size-4" />
              <span>{label}</span>
            </div>
            <nav
              aria-label={`${label} navigation`}
              className="mt-1 flex flex-col gap-1"
            >
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to as never}
                  aria-current={item.isActive ? "page" : undefined}
                  className={cn(
                    "hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex h-8 items-center rounded-md px-2 text-sm outline-none focus-visible:ring-2",
                    item.isActive &&
                      "bg-accent text-accent-foreground font-medium",
                  )}
                  onClick={() => {
                    setPopoverOpen(false);
                    onNavigate();
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild className="group/collapsible" defaultOpen={isActive}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isActive} tooltip={label}>
            <Icon />
            <span>{label}</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <SidebarMenuSubItem key={item.to}>
                <SidebarMenuSubButton
                  asChild
                  isActive={item.isActive}
                  onClick={onNavigate}
                >
                  <Link to={item.to as never}>{item.label}</Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function isActivePath(
  pathname: string,
  target: string,
  options: { exact?: boolean } = {},
) {
  const normalizedTarget = target.endsWith("/") ? target.slice(0, -1) : target;
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
      !isActivePath(pathname, "/admin/classes/enrollments") &&
      !isActivePath(pathname, "/admin/classes/trials")
    );
  }
  return isActivePath(pathname, target);
}

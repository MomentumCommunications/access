import { Link, useLocation } from "@tanstack/react-router";
import {
  BookOpen,
  BookOpenCheck,
  Calendar,
  CalendarCheck,
  CoffeeIcon,
  DollarSign,
  Home,
  LayoutDashboard,
  PersonStanding,
  ReceiptText,
  SportShoe,
  User,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { useActiveRole } from "~/contexts/ActiveRoleContext";
import { useSidebarDataContext } from "~/contexts/SidebarDataContext";
import type { UserRole } from "~/lib/roles";
import { cn } from "~/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

type MobileNavItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
};

const MOBILE_NAV_ITEMS: Record<UserRole, MobileNavItem[]> = {
  member: [
    { label: "Home", to: "/home", icon: Home },
    { label: "Students", to: "/students", icon: PersonStanding },
    { label: "Classes", to: "/classes", icon: BookOpenCheck },
    { label: "Tuition", to: "/tuition-plan", icon: ReceiptText },
  ],
  staff: [
    { label: "Staff", to: "/staff", icon: CoffeeIcon },
    { label: "Attendance", to: "/staff/attendance", icon: CalendarCheck },
    { label: "Classes", to: "/staff/classes", icon: BookOpen },
    { label: "Calendar", to: "/calendar", icon: Calendar },
  ],
  admin: [
    { label: "Admin", to: "/admin", icon: LayoutDashboard },
    { label: "Classes", to: "/admin/classes", icon: SportShoe },
    { label: "Accounts", to: "/admin/accounts", icon: Users },
    { label: "Billing", to: "/admin/billing", icon: DollarSign },
  ],
};

export function MobileBottomNav() {
  const { activeRole } = useActiveRole();
  const { convexUser } = useSidebarDataContext();
  const { pathname } = useLocation();
  const navItems = MOBILE_NAV_ITEMS[activeRole];
  const name = formatUserName(convexUser);
  const initials = getInitials(name);

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-3 bottom-3 z-50 md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-around gap-1 rounded-2xl border bg-background/92 p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/78">
        {navItems.map((item) => (
          <MobileBottomNavLink
            key={item.to}
            item={item}
            active={isActivePath(pathname, item.to)}
          />
        ))}
        <Link
          to="/account"
          aria-label="Account"
          aria-current={isActivePath(pathname, "/account") ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[0.68rem] font-medium text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isActivePath(pathname, "/account") && "bg-muted text-foreground",
          )}
        >
          <Avatar className="size-5 rounded-full">
            <AvatarImage src={convexUser?.image} alt={name || "Account"} />
            <AvatarFallback className="text-[0.58rem]">
              {initials || <User className="size-3" />}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-full truncate">Account</span>
        </Link>
      </div>
    </nav>
  );
}

function MobileBottomNavLink({
  item,
  active,
}: {
  item: MobileNavItem;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      to={item.to as never}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[0.68rem] font-medium text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-muted text-foreground",
      )}
    >
      <Icon className="size-5" />
      <span className="max-w-full truncate">{item.label}</span>
    </Link>
  );
}

function isActivePath(pathname: string, target: string) {
  if (target === "/admin" || target === "/staff" || target === "/home") {
    return pathname === target || pathname === `${target}/`;
  }
  return pathname === target || pathname.startsWith(`${target}/`);
}

function getInitials(name?: string | null) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || ""
  );
}

function formatUserName(
  user?:
    | {
        firstName?: string;
        lastName?: string;
        displayName?: string;
        name?: string;
      }
    | null,
) {
  const fullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || user?.displayName || user?.name || "Account";
}

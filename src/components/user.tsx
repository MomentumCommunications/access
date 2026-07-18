import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut, User, UserIcon } from "lucide-react";
import { Doc } from "convex/_generated/dataModel";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useConvexMutation } from "@convex-dev/react-query";
import {
  disableDevicePush,
  disablePushSubscriptionRef,
} from "~/lib/push-notifications";
import { getAccountName } from "~/lib/account-name";

export function NavUser({ user }: { user: Doc<"users"> }) {
  const { isMobile } = useSidebar();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const disablePushSubscription = useConvexMutation(disablePushSubscriptionRef);

  const name = getAccountName(user);
  const email = Array.isArray(user.email) ? user.email[0] : user.email;
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      try {
        await disableDevicePush(disablePushSubscription);
      } catch {
        // The browser subscription is removed even if server cleanup fails.
      }
      await signOut();
      await navigate({ to: "/home" });
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.image} alt={name} />
                <AvatarFallback className="rounded-lg">
                  {initials || <User className="size-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex h-full flex-1 items-end text-left text-sm leading-tight">
                <span className="h-min truncate font-medium">{name}</span>
              </div>
              <ChevronsUpDown className="size-4 ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.image} alt={name} />
                  <AvatarFallback className="rounded-lg">
                    {initials || <User className="size-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  {email && <span className="truncate text-xs">{email}</span>}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <a href="/account">
                  <UserIcon className="h-4 w-4" />
                  <span>Account</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut} disabled={isSigningOut}>
              <LogOut />
              {isSigningOut ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

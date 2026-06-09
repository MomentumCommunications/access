import { useNavigate } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  ChevronsUpDown,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useActiveRole } from "~/contexts/ActiveRoleContext";
import { ROLE_HOME, type UserRole } from "~/lib/roles";
import {
  DropdownMenu,
  DropdownMenuContent,
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

const roleDetails = {
  admin: { label: "Admin", icon: ShieldCheck },
  staff: { label: "Staff", icon: BriefcaseBusiness },
  member: { label: "Member", icon: UserRound },
} satisfies Record<UserRole, { label: string; icon: typeof ShieldCheck }>;

export function RoleSwitcher() {
  const { activeRole, availableRoles, setActiveRole } = useActiveRole();
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const activeDetails = roleDetails[activeRole];
  const ActiveIcon = activeDetails.icon;

  async function selectRole(role: UserRole) {
    setActiveRole(role);
    if (isMobile) {
      setOpenMobile(false);
    }
    await navigate({ to: ROLE_HOME[role] });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip={`Role: ${activeDetails.label}`}>
              <ActiveIcon />
              <span>{activeDetails.label}</span>
              {availableRoles.length > 1 ? (
                <ChevronsUpDown className="ml-auto" />
              ) : null}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-48"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel>View as</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableRoles.map((role) => {
              const details = roleDetails[role];
              const Icon = details.icon;
              return (
                <DropdownMenuItem
                  key={role}
                  onSelect={() => void selectRole(role)}
                >
                  <Icon />
                  {details.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

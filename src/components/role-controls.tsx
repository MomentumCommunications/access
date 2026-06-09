import { ChevronDown } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  USER_ROLES,
  toggleUserRole,
  type UserRole,
} from "~/lib/roles";

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  staff: "Staff",
  member: "Member",
};

export function RoleBadges({ roles }: { roles: UserRole[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role} variant="secondary">
          {roleLabels[role]}
        </Badge>
      ))}
    </div>
  );
}

export function RoleDropdown({
  roles,
  onRolesChange,
}: {
  roles: UserRole[];
  onRolesChange: (roles: UserRole[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="h-auto min-h-9">
          <RoleBadges roles={roles} />
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {USER_ROLES.map((role) => (
          <DropdownMenuCheckboxItem
            key={role}
            checked={roles.includes(role)}
            disabled={roles.length === 1 && roles.includes(role)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onRolesChange(toggleUserRole(roles, role, checked))
            }
          >
            {roleLabels[role]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RoleCheckboxes({
  roles,
  onRolesChange,
}: {
  roles: UserRole[];
  onRolesChange: (roles: UserRole[]) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {USER_ROLES.map((role) => {
        const id = `account-role-${role}`;
        return (
          <label
            key={role}
            htmlFor={id}
            className="flex items-center gap-2 rounded-md border p-3 text-sm"
          >
            <Checkbox
              id={id}
              checked={roles.includes(role)}
              disabled={roles.length === 1 && roles.includes(role)}
              onCheckedChange={(checked) =>
                onRolesChange(toggleUserRole(roles, role, checked === true))
              }
            />
            {roleLabels[role]}
          </label>
        );
      })}
    </div>
  );
}

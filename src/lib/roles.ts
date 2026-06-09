export type UserRole = "admin" | "staff" | "member";

export const USER_ROLES: UserRole[] = ["admin", "staff", "member"];

export type RoleSource = {
  role?: UserRole;
  roles?: UserRole[];
};

export function resolveUserRoles(user?: RoleSource | null): UserRole[] {
  if (user?.roles?.length) {
    return USER_ROLES.filter((role) => user.roles?.includes(role));
  }

  if (user?.role === "admin") {
    return ["admin", "staff", "member"];
  }
  if (user?.role === "staff") {
    return ["staff", "member"];
  }
  return ["member"];
}

export function hasUserRole(
  user: RoleSource | null | undefined,
  role: UserRole,
) {
  return resolveUserRoles(user).includes(role);
}

export function highestUserRole(roles: UserRole[]): UserRole {
  return USER_ROLES.find((role) => roles.includes(role)) || "member";
}

export function normalizeUserRoles(roles: UserRole[]) {
  return USER_ROLES.filter((role) => roles.includes(role));
}

export function toggleUserRole(
  roles: UserRole[],
  role: UserRole,
  checked: boolean,
) {
  if (checked && role === "admin") {
    return [...USER_ROLES];
  }
  return normalizeUserRoles(
    checked ? [...roles, role] : roles.filter((candidate) => candidate !== role),
  );
}

export function getDefaultActiveRole(user?: RoleSource | null) {
  return highestUserRole(resolveUserRoles(user));
}

export function getValidActiveRole(
  user: RoleSource | null | undefined,
  candidate?: string | null,
) {
  const roles = resolveUserRoles(user);
  return roles.includes(candidate as UserRole)
    ? (candidate as UserRole)
    : highestUserRole(roles);
}

export function canAccessStaff(user?: RoleSource | null) {
  return hasUserRole(user, "staff");
}

export function canAccessAdmin(user?: RoleSource | null) {
  return hasUserRole(user, "admin");
}

export const ROLE_HOME: Record<UserRole, "/admin" | "/staff" | "/home"> = {
  admin: "/admin",
  staff: "/staff",
  member: "/home",
};

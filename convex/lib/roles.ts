import type { Doc } from "../_generated/dataModel";

export type UserRole = "admin" | "staff" | "member";

export const USER_ROLES: UserRole[] = ["admin", "staff", "member"];

type RoleSource = Pick<Doc<"users">, "role" | "roles">;

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

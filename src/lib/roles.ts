export type UserRole = "admin" | "staff" | "member";

export function canAccessStaff(role: UserRole | undefined) {
  return role === "staff" || role === "admin";
}

export function canAccessAdmin(role: UserRole | undefined) {
  return role === "admin";
}

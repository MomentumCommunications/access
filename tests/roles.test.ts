import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessAdmin,
  canAccessStaff,
  getDefaultActiveRole,
  getValidActiveRole,
  highestUserRole,
  resolveUserRoles,
} from "../src/lib/roles.ts";

describe("resolveUserRoles", () => {
  it("maps legacy roles through the existing hierarchy", () => {
    assert.deepEqual(resolveUserRoles({ role: "admin" }), [
      "admin",
      "staff",
      "member",
    ]);
    assert.deepEqual(resolveUserRoles({ role: "staff" }), ["staff", "member"]);
    assert.deepEqual(resolveUserRoles({ role: "member" }), ["member"]);
  });

  it("uses explicit roles instead of the legacy role", () => {
    assert.deepEqual(
      resolveUserRoles({ role: "admin", roles: ["staff"] }),
      ["staff"],
    );
  });

  it("defaults an unassigned legacy account to member", () => {
    assert.deepEqual(resolveUserRoles({}), ["member"]);
  });
});

describe("role access", () => {
  it("checks assigned roles without hierarchy expansion for explicit arrays", () => {
    const user = { role: "admin" as const, roles: ["admin" as const] };
    assert.equal(canAccessAdmin(user), true);
    assert.equal(canAccessStaff(user), false);
  });

  it("selects the highest assigned role by default", () => {
    assert.equal(highestUserRole(["member", "staff"]), "staff");
    assert.equal(getDefaultActiveRole({ roles: ["member", "admin"] }), "admin");
  });

  it("falls back when a stored active role is no longer assigned", () => {
    assert.equal(
      getValidActiveRole({ roles: ["staff", "member"] }, "admin"),
      "staff",
    );
    assert.equal(
      getValidActiveRole({ roles: ["staff", "member"] }, "member"),
      "member",
    );
  });
});

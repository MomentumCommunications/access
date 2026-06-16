import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classVisibleToStudentGroup,
  groupManagedEnrollment,
  studentSelfServiceEnrollmentAllowed,
} from "../shared/class-enrollment-policy.ts";

describe("class enrollment policy", () => {
  it("shows unrestricted classes to every student", () => {
    assert.equal(classVisibleToStudentGroup({}), true);
    assert.equal(
      classVisibleToStudentGroup({
        studentGroupId: "team",
        visibleToGroupIds: [],
      }),
      true,
    );
  });

  it("shows group-gated classes only to students in an allowed group", () => {
    assert.equal(
      classVisibleToStudentGroup({
        studentGroupId: "team",
        visibleToGroupIds: ["team", "company"],
      }),
      true,
    );
    assert.equal(
      classVisibleToStudentGroup({
        studentGroupId: "recreational",
        visibleToGroupIds: ["team", "company"],
      }),
      false,
    );
    assert.equal(
      classVisibleToStudentGroup({
        visibleToGroupIds: ["team"],
      }),
      false,
    );
  });

  it("keeps managed enrollment separate from visibility", () => {
    assert.equal(groupManagedEnrollment({ managedEnrollment: true }), true);
    assert.equal(groupManagedEnrollment({ managedEnrollment: false }), false);
    assert.equal(groupManagedEnrollment(null), false);
    assert.equal(
      studentSelfServiceEnrollmentAllowed({ managedEnrollment: true }),
      false,
    );
    assert.equal(studentSelfServiceEnrollmentAllowed(undefined), true);
  });
});

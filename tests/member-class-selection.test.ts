import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveManagedStudentId } from "../shared/member-class-selection.ts";

describe("member class student selection", () => {
  it("preselects a requested student managed by the current user", () => {
    assert.equal(
      resolveManagedStudentId("student-b", ["student-a", "student-b"]),
      "student-b",
    );
  });

  it("ignores a requested student outside the current user's students", () => {
    assert.equal(
      resolveManagedStudentId("another-user-student", [
        "student-a",
        "student-b",
      ]),
      "student-a",
    );
  });

  it("uses the first managed student when no student is requested", () => {
    assert.equal(
      resolveManagedStudentId(undefined, ["student-a", "student-b"]),
      "student-a",
    );
  });

  it("returns no selection when the user manages no students", () => {
    assert.equal(resolveManagedStudentId("student-a", []), undefined);
  });
});

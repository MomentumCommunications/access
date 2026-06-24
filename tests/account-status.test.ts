import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountStatusChanged,
  accountStatusConfirmationCopy,
  resolveAccountStatus,
  shouldSkipSharedStudentOnInactivation,
} from "../shared/account-status.ts";

describe("account status policy", () => {
  it("treats missing legacy status as active", () => {
    assert.equal(resolveAccountStatus(undefined), "active");
    assert.equal(accountStatusChanged(undefined, "active"), false);
    assert.equal(accountStatusChanged(undefined, "inactive"), true);
  });

  it("uses household and account-specific confirmation copy", () => {
    assert.equal(
      accountStatusConfirmationCopy({
        status: "inactive",
        householdName: "Rivera household",
        accountName: "Alex Rivera",
      }),
      "Do you want to mark Rivera household as inactive?",
    );
    assert.equal(
      accountStatusConfirmationCopy({
        status: "active",
        accountName: "Alex Rivera",
      }),
      "Do you want to mark Alex Rivera and their connected students as active?",
    );
  });

  it("keeps a student active when an outside active account is connected", () => {
    assert.equal(
      shouldSkipSharedStudentOnInactivation({
        targetAccountIds: new Set(["household-account"]),
        connectedAccountIds: ["household-account", "outside-account"],
        accountStatuses: new Map([
          ["household-account", "active"],
          ["outside-account", "active"],
        ]),
      }),
      true,
    );
  });

  it("does not skip for outside inactive accounts or accounts in the cascade", () => {
    assert.equal(
      shouldSkipSharedStudentOnInactivation({
        targetAccountIds: new Set(["one", "two"]),
        connectedAccountIds: ["one", "two", "outside"],
        accountStatuses: new Map([
          ["one", "active"],
          ["two", undefined],
          ["outside", "inactive"],
        ]),
      }),
      false,
    );
  });

  it("treats an outside legacy account without a status as active", () => {
    assert.equal(
      shouldSkipSharedStudentOnInactivation({
        targetAccountIds: new Set(["target"]),
        connectedAccountIds: ["target", "legacy-outside"],
        accountStatuses: new Map([["legacy-outside", undefined]]),
      }),
      true,
    );
  });
});

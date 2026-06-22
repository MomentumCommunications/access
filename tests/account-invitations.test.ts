import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectiveInvitationStatus,
  evaluateAccountInvitationClaim,
  isWorkforceAccount,
  nextOnboardingDestination,
  normalizeInvitationEmail,
  replacementInvitationStatus,
  shouldProvisionCustomerBilling,
} from "../shared/account-invitations.ts";

describe("account invitation policy", () => {
  it("normalizes invited emails", () => {
    assert.equal(normalizeInvitationEmail(" Ada@Example.COM "), "ada@example.com");
  });

  it("expires only pending invitations", () => {
    assert.equal(effectiveInvitationStatus("pending", 10, 10), "expired");
    assert.equal(effectiveInvitationStatus("consumed", 10, 20), "consumed");
  });

  it("supersedes only active pending invitations", () => {
    assert.equal(replacementInvitationStatus("pending", 20, 10), "superseded");
    assert.equal(replacementInvitationStatus("pending", 10, 10), "expired");
    assert.equal(replacementInvitationStatus("consumed", 20, 10), "consumed");
  });

  it("accepts only the intended verified account and email", () => {
    const valid = {
      status: "pending" as const,
      expiresAt: 20,
      invitedEmail: "member@example.com",
      currentEmail: "MEMBER@example.com",
      targetUserId: "user-1",
      currentUserId: "user-1",
      emailVerified: true,
      now: 10,
    };
    assert.deepEqual(evaluateAccountInvitationClaim(valid), { ok: true });
    assert.equal(
      evaluateAccountInvitationClaim({
        ...valid,
        currentUserId: "user-2",
      }).reason,
      "wrong_account",
    );
    assert.equal(
      evaluateAccountInvitationClaim({
        ...valid,
        currentEmail: "other@example.com",
      }).reason,
      "wrong_email",
    );
    assert.equal(
      evaluateAccountInvitationClaim({ ...valid, emailVerified: false }).reason,
      "wrong_email",
    );
    assert.equal(
      evaluateAccountInvitationClaim({ ...valid, now: 20 }).reason,
      "expired",
    );
  });

  it("uses workforce onboarding whenever staff or admin is assigned", () => {
    assert.equal(isWorkforceAccount(["member", "staff"]), true);
    assert.equal(
      nextOnboardingDestination({
        roles: ["member", "admin"],
        connectedStudentCount: 0,
      }),
      "/admin",
    );
    assert.equal(
      nextOnboardingDestination({
        roles: ["member", "staff"],
        connectedStudentCount: 0,
      }),
      "/staff",
    );
  });

  it("skips student creation for members with connected students", () => {
    assert.equal(
      nextOnboardingDestination({
        roles: ["member"],
        connectedStudentCount: 1,
      }),
      "/register/review",
    );
    assert.equal(
      nextOnboardingDestination({
        roles: ["member"],
        connectedStudentCount: 0,
      }),
      "/register/students",
    );
  });

  it("preserves imported billing and skips workforce billing", () => {
    assert.equal(
      shouldProvisionCustomerBilling({
        onboardingSource: "imported",
        roles: ["member"],
      }),
      false,
    );
    assert.equal(
      shouldProvisionCustomerBilling({
        onboardingSource: "new",
        roles: ["staff", "member"],
      }),
      false,
    );
    assert.equal(
      shouldProvisionCustomerBilling({
        onboardingSource: "new",
        roles: ["member"],
      }),
      true,
    );
  });
});

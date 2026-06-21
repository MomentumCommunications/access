import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPushFailure,
  canManagePushSubscription,
  pushRetryDelay,
  safeInternalPath,
  shouldShowPushPrompt,
  selectPushTargets,
  shouldSendPush,
} from "../shared/push-notifications.ts";

describe("push notification policy", () => {
  it("allows only the initial selected event types", () => {
    assert.equal(shouldSendPush("user.registered"), true);
    assert.equal(shouldSendPush("enrollment.pending"), true);
    assert.equal(shouldSendPush("enrollment.enrolled"), true);
    assert.equal(shouldSendPush("billing.delinquent"), false);
  });

  it("uses the planned retry schedule", () => {
    assert.equal(pushRetryDelay(1), 60_000);
    assert.equal(pushRetryDelay(2), 300_000);
    assert.equal(pushRetryDelay(3), 1_800_000);
    assert.equal(pushRetryDelay(4), undefined);
  });

  it("classifies expired, retryable, and permanent failures", () => {
    assert.equal(classifyPushFailure(410), "expired");
    assert.equal(classifyPushFailure(429), "retryable");
    assert.equal(classifyPushFailure(503), "retryable");
    assert.equal(classifyPushFailure(400), "permanent");
  });

  it("accepts only same-origin relative destinations", () => {
    assert.equal(
      safeInternalPath("/students/one?tab=billing"),
      "/students/one?tab=billing",
    );
    assert.equal(safeInternalPath("//example.com/path"), null);
    assert.equal(safeInternalPath("https://example.com/path"), null);
  });

  it("shows the Home prompt only for actionable permission states", () => {
    assert.equal(shouldShowPushPrompt("prompt", false), true);
    assert.equal(shouldShowPushPrompt("requires_install", false), true);
    assert.equal(shouldShowPushPrompt("denied", false), false);
    assert.equal(shouldShowPushPrompt("enabled", false), false);
    assert.equal(shouldShowPushPrompt("prompt", true), false);
  });

  it("fans out only to active devices owned by the recipient", () => {
    const subscriptions = [
      { id: "one", recipientUserId: "user-a" },
      { id: "two", recipientUserId: "user-a" },
      { id: "three", recipientUserId: "user-b" },
      { id: "four", recipientUserId: "user-a", disabledAt: 10 },
    ];
    assert.deepEqual(
      selectPushTargets(subscriptions, "user-a").map((row) => row.id),
      ["one", "two"],
    );
    assert.deepEqual(
      selectPushTargets(subscriptions, "user-a", "two").map((row) => row.id),
      ["two"],
    );
  });

  it("allows subscription cleanup only for its current owner", () => {
    assert.equal(
      canManagePushSubscription({ recipientUserId: "user-a" }, "user-a"),
      true,
    );
    assert.equal(
      canManagePushSubscription({ recipientUserId: "user-a" }, "user-b"),
      false,
    );
  });
});

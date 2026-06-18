import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeChallengeStatus,
  evaluateSendThrottle,
  nextAttemptState,
  normalizeAccountEmail,
  SECURITY_SEND_COOLDOWN_MS,
  SECURITY_SEND_MAX_PER_WINDOW,
  SECURITY_SEND_WINDOW_MS,
} from "../shared/account-security.ts";

describe("account security challenge lifecycle", () => {
  it("normalizes login emails consistently", () => {
    assert.equal(
      normalizeAccountEmail("  Person@Example.COM "),
      "person@example.com",
    );
  });

  it("marks pending and confirming challenges expired after their deadline", () => {
    assert.equal(activeChallengeStatus("pending", 100, 100), "expired");
    assert.equal(activeChallengeStatus("confirming", 99, 100), "expired");
    assert.equal(activeChallengeStatus("consumed", 99, 100), "consumed");
    assert.equal(
      activeChallengeStatus("superseded", 99, 100),
      "superseded",
    );
  });

  it("moves a matching code into confirmation without consuming an attempt", () => {
    assert.deepEqual(
      nextAttemptState({
        attemptCount: 2,
        maxAttempts: 5,
        matches: true,
      }),
      { attemptCount: 2, status: "confirming" },
    );
  });

  it("counts bad codes and closes the challenge at the attempt limit", () => {
    assert.deepEqual(
      nextAttemptState({
        attemptCount: 3,
        maxAttempts: 5,
        matches: false,
      }),
      { attemptCount: 4, status: "pending" },
    );
    assert.deepEqual(
      nextAttemptState({
        attemptCount: 4,
        maxAttempts: 5,
        matches: false,
      }),
      { attemptCount: 5, status: "too_many_attempts" },
    );
  });
});

describe("account security send throttling", () => {
  it("enforces the resend cooldown", () => {
    const now = 1_000_000;
    assert.deepEqual(
      evaluateSendThrottle({
        now,
        windowStartedAt: now - 5_000,
        sendCount: 1,
        lastSentAt: now - 1_000,
      }),
      {
        allowed: false,
        retryAt: now - 1_000 + SECURITY_SEND_COOLDOWN_MS,
      },
    );
  });

  it("enforces the hourly send cap", () => {
    const now = 2_000_000;
    const windowStartedAt = now - 10_000;
    assert.deepEqual(
      evaluateSendThrottle({
        now,
        windowStartedAt,
        sendCount: SECURITY_SEND_MAX_PER_WINDOW,
        lastSentAt: now - SECURITY_SEND_COOLDOWN_MS,
      }),
      {
        allowed: false,
        retryAt: windowStartedAt + SECURITY_SEND_WINDOW_MS,
      },
    );
  });

  it("resets an elapsed send window", () => {
    const now = 3_000_000;
    assert.deepEqual(
      evaluateSendThrottle({
        now,
        windowStartedAt: now - SECURITY_SEND_WINDOW_MS,
        sendCount: SECURITY_SEND_MAX_PER_WINDOW,
        lastSentAt: now - SECURITY_SEND_COOLDOWN_MS,
      }),
      {
        allowed: true,
        windowStartedAt: now,
        sendCount: 1,
        lastSentAt: now,
      },
    );
  });
});

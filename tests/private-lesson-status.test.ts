import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  privateParticipantPatch,
  privateParticipantTransition,
} from "../shared/private-lesson-status.ts";

describe("private lesson participant status policy", () => {
  it("marks participants attended and billable when completing a lesson", () => {
    const transition = privateParticipantTransition("scheduled", "completed");

    assert.equal(transition, "mark_attended_billable");
    assert.deepEqual(
      privateParticipantPatch(transition, {
        appliedPrivateRateId: "rate-1",
        appliedPriceCents: 1250,
      }),
      {
        status: "attended",
        billable: true,
        appliedPrivateRateId: "rate-1",
        appliedPriceCents: 1250,
      },
    );
  });

  it("allows completion without configured pricing", () => {
    assert.deepEqual(
      privateParticipantPatch(
        privateParticipantTransition("scheduled", "completed"),
        null,
      ),
      {
        status: "attended",
        billable: true,
        appliedPrivateRateId: undefined,
        appliedPriceCents: undefined,
      },
    );
  });

  it("preserves participant exceptions when an already-completed lesson is saved", () => {
    const transition = privateParticipantTransition("completed", "completed");

    assert.equal(transition, "preserve");
    assert.equal(privateParticipantPatch(transition), null);
  });

  it("resets participants when a completed or cancelled lesson is reopened", () => {
    for (const previousStatus of ["completed", "cancelled"] as const) {
      assert.deepEqual(
        privateParticipantPatch(
          privateParticipantTransition(previousStatus, "scheduled"),
        ),
        {
          status: "scheduled",
          billable: false,
          appliedPrivateRateId: undefined,
          appliedPriceCents: undefined,
        },
      );
    }
  });

  it("cancels participants and removes billing state", () => {
    assert.deepEqual(
      privateParticipantPatch(
        privateParticipantTransition("completed", "cancelled"),
      ),
      {
        status: "cancelled",
        billable: false,
        appliedPrivateRateId: undefined,
        appliedPriceCents: undefined,
      },
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canEditEnrollmentTuitionTreatment,
  enrollmentTuitionTreatmentPatch,
} from "../shared/enrollment-tuition-treatment.ts";

describe("enrollment tuition treatment", () => {
  it("is editable only for billable enrollment records", () => {
    assert.equal(canEditEnrollmentTuitionTreatment("enrolled"), true);
    assert.equal(canEditEnrollmentTuitionTreatment("dropped"), true);
    assert.equal(canEditEnrollmentTuitionTreatment("pending"), false);
    assert.equal(canEditEnrollmentTuitionTreatment("waitlisted"), false);
    assert.equal(canEditEnrollmentTuitionTreatment("declined"), false);
  });

  it("builds a patch that cannot alter enrollment status or dates", () => {
    assert.deepEqual(enrollmentTuitionTreatmentPatch(false, 1234), {
      prorateTuition: false,
      updatedAt: 1234,
    });
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  incompleteOnboardingStep,
  isDesertedTrial,
} from "../shared/onboarding-report.ts";

test("only pending onboarding accounts appear in the report", () => {
  assert.equal(incompleteOnboardingStep("pending", "profile"), "profile");
  assert.equal(incompleteOnboardingStep("pending", undefined), "not_started");
  assert.equal(incompleteOnboardingStep("complete", "complete"), null);
  assert.equal(incompleteOnboardingStep(undefined, undefined), null);
});

test("deserted trials are approved trials marked absent", () => {
  assert.equal(isDesertedTrial("approved", "absent"), true);
  assert.equal(isDesertedTrial("approved", "present"), false);
  assert.equal(isDesertedTrial("pending", "absent"), false);
  assert.equal(isDesertedTrial("cancelled", "absent"), false);
});

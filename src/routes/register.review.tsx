import { createFileRoute } from "@tanstack/react-router";
import { OnboardingGate } from "~/components/onboarding/onboarding-gate";
import { ReviewStep } from "~/components/onboarding/review-step";

export const Route = createFileRoute("/register/review")({
  component: RegisterReviewStep,
});

function RegisterReviewStep() {
  return (
    <OnboardingGate>
      <ReviewStep />
    </OnboardingGate>
  );
}

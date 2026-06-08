import { createFileRoute } from "@tanstack/react-router";
import { OnboardingGate } from "~/components/onboarding/onboarding-gate";
import { ProfileStep } from "~/components/onboarding/profile-step";

export const Route = createFileRoute("/register/profile")({
  component: RegisterProfileStep,
});

function RegisterProfileStep() {
  return (
    <OnboardingGate>
      <ProfileStep />
    </OnboardingGate>
  );
}

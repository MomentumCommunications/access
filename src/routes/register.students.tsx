import { createFileRoute } from "@tanstack/react-router";
import { OnboardingGate } from "~/components/onboarding/onboarding-gate";
import { StudentsStep } from "~/components/onboarding/students-step";

export const Route = createFileRoute("/register/students")({
  component: RegisterStudentsStep,
});

function RegisterStudentsStep() {
  return (
    <OnboardingGate>
      <StudentsStep />
    </OnboardingGate>
  );
}

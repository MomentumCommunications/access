import { createFileRoute } from "@tanstack/react-router";
import { ContractStep } from "~/components/onboarding/contract-step";
import { OnboardingGate } from "~/components/onboarding/onboarding-gate";

export const Route = createFileRoute("/register/contract")({
  component: RegisterContractStep,
});

function RegisterContractStep() {
  return (
    <OnboardingGate>
      <ContractStep />
    </OnboardingGate>
  );
}

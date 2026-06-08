import { createFileRoute } from "@tanstack/react-router";
import { OnboardingShell } from "~/components/onboarding/onboarding-shell";

export const Route = createFileRoute("/register")({
  component: OnboardingShell,
});

export type OnboardingReportStep =
  | "not_started"
  | "profile"
  | "students"
  | "review"
  | "contract";

export function incompleteOnboardingStep(
  onboardingStatus: string | undefined,
  currentStep: string | undefined,
): OnboardingReportStep | null {
  if (onboardingStatus !== "pending") return null;
  if (
    currentStep === "profile" ||
    currentStep === "students" ||
    currentStep === "review" ||
    currentStep === "contract"
  ) {
    return currentStep;
  }
  return "not_started";
}

export function isDesertedTrial(
  trialStatus: string,
  attendanceStatus: string | undefined,
) {
  return trialStatus === "approved" && attendanceStatus === "absent";
}

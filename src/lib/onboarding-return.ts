import { safeInternalPath } from "../../shared/push-notifications";

const ONBOARDING_RETURN_KEY = "access:onboarding-return";

export function saveOnboardingReturn(path: string) {
  if (typeof window === "undefined") return;
  const safePath = safeInternalPath(path);
  if (safePath) sessionStorage.setItem(ONBOARDING_RETURN_KEY, safePath);
}

export function getOnboardingReturn() {
  if (typeof window === "undefined") return null;
  return safeInternalPath(sessionStorage.getItem(ONBOARDING_RETURN_KEY));
}

export function clearOnboardingReturn() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ONBOARDING_RETURN_KEY);
  }
}

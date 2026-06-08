import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { Navigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useConvexAuth } from "convex/react";
import { useEffect, type ReactNode } from "react";
import { Spinner } from "~/components/ui/spinner";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const state = useConvexQuery(
    api.onboarding.getState,
    isAuthenticated ? {} : "skip",
  );
  const ensureState = useConvexMutation(api.onboarding.ensureState);
  const needsCompletionRepair =
    state?.user.onboardingStatus === "pending" &&
    (state.onboarding?.currentStep === "complete" ||
      state.onboarding?.completedAt !== undefined);

  useEffect(() => {
    if (
      isAuthenticated &&
      state?.user.onboardingStatus === "pending" &&
      (!state.onboarding || needsCompletionRepair)
    ) {
      void ensureState({});
    }
  }, [ensureState, isAuthenticated, needsCompletionRepair, state]);

  if (
    isLoading ||
    (isAuthenticated && state === undefined) ||
    needsCompletionRepair
  ) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/register" replace />;
  }

  if (!state?.onboarding) {
    if (state?.user.onboardingStatus !== "pending") {
      return <Navigate to="/home" replace />;
    }
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  return children;
}

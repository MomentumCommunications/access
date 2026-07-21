import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { OnboardingGate } from "~/components/onboarding/onboarding-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  clearOnboardingReturn,
  getOnboardingReturn,
} from "~/lib/onboarding-return";

export const Route = createFileRoute("/register/complete")({
  component: RegisterCompleteStep,
});

function RegisterCompleteStep() {
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => setReturnTo(getOnboardingReturn()), []);
  return (
    <OnboardingGate>
      <div className="mx-auto flex w-full max-w-lg flex-1 items-center pb-12">
        <Card className="w-full text-center">
          <CardHeader className="items-center">
            <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="size-6 text-primary" />
            </div>
            <CardTitle>Registration complete</CardTitle>
            <CardDescription>
              Your account and student information are ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full sm:w-auto" asChild>
              <Link
                to={(returnTo || "/home") as never}
                onClick={clearOnboardingReturn}
              >
                {returnTo?.startsWith("/trial")
                  ? "Continue to trial request"
                  : "Continue to Access Momentum"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </OnboardingGate>
  );
}

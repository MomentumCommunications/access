import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { getAccountName } from "~/lib/account-name";

export function ReviewStep() {
  const navigate = useNavigate();
  const state = useConvexQuery(api.onboarding.getState, {});
  const complete = useConvexMutation(api.onboarding.complete);
  const setStep = useConvexMutation(api.onboarding.setStep);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleComplete() {
    setError(null);
    setIsSubmitting(true);
    try {
      if (
        state?.user.contractTypeSigned &&
        state.user.contractVersionSigned &&
        state.user.contractSignedAt
      ) {
        await complete({});
        await navigate({ to: "/register/complete" });
      } else {
        await setStep({ step: "contract" });
        await navigate({ to: "/register/contract" });
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Registration could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-5">
        <h1 className="text-3xl font-bold">Review</h1>
        <p className="mt-1 text-muted-foreground">
          Make sure these details look right before finishing.
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Your information</CardTitle>
              <CardDescription>{String(state?.user.email || "")}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/register/profile">Edit</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium">
                {state?.user ? getAccountName(state.user) : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p className="font-medium">{state?.user.phone || "Not set"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Address</p>
              <p className="whitespace-pre-line font-medium">
                {state?.user.address || "Not set"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>
                {state?.students.length || 0} connected to this account
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/register/students">Edit</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {state?.students.map(({ contact, student }, index) => (
                <div key={student._id}>
                  {index > 0 ? <Separator className="mb-4" /> : null}
                  <p className="font-medium">
                    {student.preferredName || student.firstName}{" "}
                    {student.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[contact.relationship, student.school]
                      .filter(Boolean)
                      .join(" · ") || "Student details saved"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" asChild>
            <Link to="/register/students">Back</Link>
          </Button>
          <Button onClick={() => void handleComplete()} disabled={isSubmitting}>
            {isSubmitting
              ? "Continuing..."
              : state?.user.contractSignedAt
                ? "Complete registration"
                : "Continue to agreement"}
          </Button>
        </div>
      </div>
    </div>
  );
}

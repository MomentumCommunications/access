import { useAuthActions } from "@convex-dev/auth/react";
import {
  useConvexAction,
  useConvexQuery,
} from "@convex-dev/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useState } from "react";
import { z } from "zod";
import { PasswordResetForm } from "~/components/password-reset-form";
import { getAuthErrorMessage } from "~/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({
    accountChallenge: z.string().optional(),
  }),
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const { accountChallenge } = Route.useSearch();
  const { signIn } = useAuthActions();
  const confirmAccountPasswordReset = useConvexAction(
    api.stripe.confirmAccountPasswordReset,
  );
  const navigate = useNavigate();
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const accountReset = useConvexQuery(
    api.users.getAccountPasswordResetChallenge,
    accountChallenge ? { challengeId: accountChallenge } : "skip",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      if (accountChallenge) {
        await confirmAccountPasswordReset({
          challengeId: accountChallenge as Id<"accountSecurityChallenges">,
          code: String(formData.get("code") || ""),
          newPassword: String(formData.get("newPassword") || ""),
        });
        await navigate({ to: "/account" });
        return;
      }
      await signIn("password", formData);

      if (resetEmail) {
        await navigate({ to: "/home" });
        return;
      }

      setResetEmail(formData.get("email") as string);
    } catch (err) {
      setError(getAuthErrorMessage(err, "Could not reset your password."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (accountChallenge && accountReset === undefined) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </main>
    );
  }

  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src="/logo_transparent.png"
            alt="Access Momentum Logo"
            className="size-20 rounded-full"
          />
          <div>
            <h1 className="text-2xl font-bold">Access Momentum</h1>
            <p className="text-sm text-muted-foreground">
              Recover access to your portal.
            </p>
          </div>
        </div>
        <PasswordResetForm
          email={
            accountChallenge ? accountReset?.email : resetEmail ?? undefined
          }
          error={error}
          isSubmitting={isSubmitting}
          onCancelVerification={() => {
            if (accountChallenge) {
              void navigate({ to: "/account" });
              return;
            }
            setResetEmail(null);
            setError(null);
          }}
          onSubmit={handleSubmit}
          accountInitiated={Boolean(accountChallenge)}
          unavailable={
            accountChallenge && !accountReset
              ? "This password change request is invalid or is not associated with your current account."
              : accountReset &&
                  accountReset.status !== "pending"
                ? "This password change request is no longer active."
                : undefined
          }
        />
      </div>
    </main>
  );
}

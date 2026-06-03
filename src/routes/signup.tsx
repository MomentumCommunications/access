import { useAuthActions } from "@convex-dev/auth/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { EmailVerificationForm } from "~/components/email-verification-form";
import { SignupForm } from "~/components/signup-form";
import { getAuthErrorMessage } from "~/lib/auth-errors";

export const Route = createFileRoute("/signup")({
  component: SignupRoute,
});

function SignupRoute() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    if (formData.get("password") !== formData.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn("password", formData);
      if (result.signingIn) {
        await navigate({ to: "/home" });
        return;
      }
      setVerificationEmail(formData.get("email") as string);
    } catch (err) {
      setError(getAuthErrorMessage(err, "Could not create account."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerificationSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn("password", new FormData(event.currentTarget));
      await navigate({ to: "/home" });
    } catch (err) {
      setError(getAuthErrorMessage(err, "Could not verify your email."));
    } finally {
      setIsSubmitting(false);
    }
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
              Create your portal account.
            </p>
          </div>
        </div>
        {verificationEmail ? (
          <EmailVerificationForm
            email={verificationEmail}
            error={error}
            isSubmitting={isSubmitting}
            onCancel={() => {
              setVerificationEmail(null);
              setError(null);
            }}
            onSubmit={handleVerificationSubmit}
          />
        ) : (
          <SignupForm
            error={error}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </main>
  );
}

import { useAuthActions } from "@convex-dev/auth/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PasswordResetForm } from "~/components/password-reset-form";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      await signIn("password", formData);

      if (resetEmail) {
        await navigate({ to: "/home" });
        return;
      }

      setResetEmail(formData.get("email") as string);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reset your password.",
      );
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
              Recover access to your portal.
            </p>
          </div>
        </div>
        <PasswordResetForm
          email={resetEmail ?? undefined}
          error={error}
          isSubmitting={isSubmitting}
          onCancelVerification={() => {
            setResetEmail(null);
            setError(null);
          }}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}

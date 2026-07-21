import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAction, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useConvexAuth } from "convex/react";
import { useState } from "react";
import { useEffect } from "react";
import { EmailVerificationForm } from "~/components/email-verification-form";
import { SignupForm } from "~/components/signup-form";
import { Spinner } from "~/components/ui/spinner";
import { getAuthErrorMessage } from "~/lib/auth-errors";
import { saveOnboardingReturn } from "~/lib/onboarding-return";
import { safeInternalPath } from "../../shared/push-notifications";

export const Route = createFileRoute("/register/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { invite?: string; redirect?: string } => {
    const invite =
      typeof search.invite === "string" && search.invite.length <= 512
        ? search.invite
        : undefined;
    const redirect = safeInternalPath(
      typeof search.redirect === "string" ? search.redirect : undefined,
    );
    return { ...(invite ? { invite } : {}), ...(redirect ? { redirect } : {}) };
  },
  component: RegisterAccountStep,
});

function RegisterAccountStep() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { invite, redirect } = Route.useSearch();
  const user = useConvexQuery(api.users.current, isAuthenticated ? {} : "skip");
  const onboarding = useConvexQuery(
    api.onboarding.getState,
    isAuthenticated && user?.onboardingStatus === "pending" ? {} : "skip",
  );
  const { signIn } = useAuthActions();
  const previewInvitation = useConvexAction(api.invitationActions.preview);
  const consumeInvitation = useConvexAction(api.invitationActions.consume);
  const navigate = useNavigate();
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<Awaited<
    ReturnType<typeof previewInvitation>
  > | null | undefined>(invite ? undefined : null);

  useEffect(() => {
    if (!invite) {
      setInvitation(null);
      return;
    }
    void previewInvitation({ token: invite })
      .then(setInvitation)
      .catch(() => setInvitation(null));
  }, [invite, previewInvitation]);

  useEffect(() => {
    if (redirect?.startsWith("/trial")) saveOnboardingReturn(redirect);
  }, [redirect]);

  if (
    isLoading ||
    invitation === undefined ||
    (isAuthenticated && user === undefined) ||
    (user?.onboardingStatus === "pending" && onboarding === undefined)
  ) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (isAuthenticated) {
    if (user?.onboardingStatus !== "pending") {
      return <Navigate to={(redirect || "/home") as never} replace />;
    }

    const step = onboarding?.onboarding?.currentStep;
    const destination =
      step === "students"
        ? "/register/students"
        : step === "review"
          ? "/register/review"
          : step === "contract"
            ? "/register/contract"
          : step === "complete"
            ? "/register/complete"
            : "/register/profile";
    return <Navigate to={destination} replace />;
  }

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
        if (invite) await consumeInvitation({ token: invite });
        await navigate({ to: "/register/profile" });
        return;
      }
      setVerificationEmail(formData.get("email") as string);
    } catch (caught) {
      setError(getAuthErrorMessage(caught, "Could not create account."));
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
      if (invite) await consumeInvitation({ token: invite });
      await navigate({ to: "/register/profile" });
    } catch (caught) {
      setError(getAuthErrorMessage(caught, "Could not verify your email."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-12">
      <div className="mb-5">
        <h1 className="text-3xl font-bold">Create your account</h1>
        <p className="mt-1 text-muted-foreground">
          {invitation?.status === "pending"
            ? `Accept the invitation for ${invitation.email}.`
            : "We’ll check your email for an existing client record."}
        </p>
      </div>
      {invite && (!invitation || invitation.status !== "pending") ? (
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Invitation unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This invitation is invalid, expired, or no longer active. Ask an
            administrator for a new link.
          </p>
        </div>
      ) : verificationEmail ? (
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
          email={invitation?.email}
          lockEmail={Boolean(invitation)}
          error={error}
          isSubmitting={isSubmitting}
          redirect={redirect}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

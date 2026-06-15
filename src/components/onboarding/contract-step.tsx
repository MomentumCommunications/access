import * as DocusealReact from "@docuseal/react";
import type { DocusealFormCompleteData } from "@docuseal/react";
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";
import { getAccountName } from "~/lib/account-name";

const contractUrl = import.meta.env.DOCUSEAL_RECREATIONAL_URL as
  | string
  | undefined;
const DocusealForm = DocusealReact.DocusealForm;

function getEmail(email?: string | string[]) {
  return Array.isArray(email) ? email[0] : email;
}

export function ContractStep() {
  const navigate = useNavigate();
  const state = useConvexQuery(api.onboarding.getState, {});
  const recordSignature = useConvexMutation(
    api.onboarding.recordContractSignature,
  );
  const complete = useConvexMutation(api.onboarding.complete);
  const [signed, setSigned] = useState(false);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signedThisSession = useRef(false);
  const alreadySigned = Boolean(
    state?.user.contractTypeSigned &&
      state.user.contractVersionSigned &&
      state.user.contractSignedAt,
  );

  useEffect(() => {
    if (!alreadySigned || signedThisSession.current || isCompleting) {
      return;
    }

    setIsCompleting(true);
    void complete({})
      .then(() => navigate({ to: "/register/complete", replace: true }))
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Registration could not be completed.",
        );
        setIsCompleting(false);
      });
  }, [alreadySigned, complete, isCompleting, navigate]);

  async function handleSigned(data: DocusealFormCompleteData) {
    setError(null);
    setIsSavingSignature(true);
    signedThisSession.current = true;
    try {
      await recordSignature({
        docusealSubmissionId: data.submission?.id
          ? String(data.submission.id)
          : undefined,
      });
      setSigned(true);
    } catch (caught) {
      signedThisSession.current = false;
      setError(
        caught instanceof Error
          ? caught.message
          : "The signed agreement could not be saved.",
      );
    } finally {
      setIsSavingSignature(false);
    }
  }

  async function handleComplete() {
    setError(null);
    setIsCompleting(true);
    try {
      await complete({});
      await navigate({ to: "/register/complete" });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Registration could not be completed.",
      );
      setIsCompleting(false);
    }
  }

  if (
    state === undefined ||
    (alreadySigned && !signedThisSession.current) ||
    isSavingSignature
  ) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Spinner className="size-5" />
        {isSavingSignature ? (
          <p className="text-sm text-muted-foreground">Saving agreement...</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-6xl">
      <div className="mb-5">
        <h1 className="text-3xl font-bold">Client agreement</h1>
        <p className="mt-1 text-muted-foreground">
          Review and sign the recreational client agreement.
        </p>
      </div>

      {!contractUrl ? (
        <Card>
          <CardHeader>
            <CardTitle>Agreement unavailable</CardTitle>
            <CardDescription>
              The signing document has not been configured.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : signed ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="size-10 text-primary" />
            <CardTitle>Agreement signed</CardTitle>
            <CardDescription>
              Your signature has been saved. You can now finish registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              disabled={isCompleting}
              onClick={() => void handleComplete()}
            >
              {isCompleting ? "Finishing..." : "Complete registration"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="min-h-[32rem] overflow-hidden rounded-md border bg-white lg:aspect-[16/10] lg:min-h-0">
          <DocusealForm
            className="block min-h-[32rem] w-full lg:h-full lg:min-h-0"
            src={contractUrl}
            email={getEmail(state.user.email)}
            name={getAccountName(state.user)}
            externalId={state.user._id}
            expand
            minimize={false}
            withTitle
            allowToResubmit={false}
            completedMessage={{
              title: "Agreement signed",
              body: "Return to Access Momentum to complete registration.",
            }}
            onComplete={(data) => void handleSigned(data)}
          />
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!signed ? (
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/register/review">Back to review</Link>
        </Button>
      ) : null}
    </div>
  );
}

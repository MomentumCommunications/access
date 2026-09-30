import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Gift } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";
import { verifiedReferralEmail } from "../../shared/referrals";

export const Route = createFileRoute("/referral/$token")({
  component: ReferralLanding,
});

function ReferralLanding() {
  const { token } = Route.useParams();
  const { signOut } = useAuthActions();
  const [signingOut, setSigningOut] = useState(false);
  async function switchAccount() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      toast.error("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }
  const referral = useConvexQuery(api.referrals.preview, { token });
  const user = useConvexQuery(api.users.current, {});
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Gift className="mb-3 size-8 text-primary" />
          <CardTitle>
            {referral
              ? `${referral.referrerName} invited you to Access Momentum`
              : "Access Momentum"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {referral === undefined ? (
            <Spinner />
          ) : referral ? (
            <>
              <p>
                Create an account or sign in using{" "}
                <strong className="break-all">{referral.email}</strong>. Your
                referral will connect when that email is verified, even if you
                register without this link.
              </p>
              <p className="text-sm text-muted-foreground">
                Your friend may receive $50 in credit after you pay for a full
                month of regular classes. Trials and prorated partial months
                alone don’t qualify. Our team reviews eligibility.
              </p>
              {user && verifiedReferralEmail(user) === referral.email ? (
                <>
                  <p className="text-sm">
                    You’re signed in with the invited email. Our team will
                    review the referral before awarding credit.
                  </p>
                  <Button asChild>
                    <Link to="/home">Continue to your account</Link>
                  </Button>
                </>
              ) : (
                <>
                  {user && (
                    <p className="text-sm text-destructive">
                      You’re signed in with a different or unverified email.
                      Sign out first if you need to use another account.
                    </p>
                  )}
                  {user && (
                    <Button
                      variant="outline"
                      disabled={signingOut}
                      onClick={() => void switchAccount()}
                    >
                      {signingOut
                        ? "Signing out…"
                        : "Sign out to use another account"}
                    </Button>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link to="/register" search={{ referral: token }}>
                        Create an account
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link
                        to="/login"
                        search={{ redirect: `/referral/${token}` }}
                      >
                        Sign in
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <p>
                This referral link is unavailable. You can still register
                normally; referrals are matched using your verified email.
              </p>
              <Button asChild>
                <Link to="/register">Create an account</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

import { useConvexAction, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Copy, Gift, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { referralStatusLabels } from "../../shared/referrals";
import { useCurrentUser } from "~/hooks/useCurrentUser";
import { hasUserRole } from "~/lib/roles";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Spinner } from "~/components/ui/spinner";
import { formatDateTime } from "~/lib/date-utils";

export const Route = createFileRoute("/_app/refer")({ component: ReferPage });

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Referral link copied.");
  } catch {
    toast.error(
      "Could not copy the link. Select and copy it from the link field.",
    );
  }
}

function ReferPage() {
  const { data: user, isLoading } = useCurrentUser();
  if (isLoading) return <Spinner className="m-8" />;
  if (
    !user ||
    !hasUserRole(user, "member") ||
    user.status === "inactive" ||
    user.onboardingStatus !== "complete"
  ) {
    return (
      <main className="mx-auto max-w-3xl p-4 lg:p-8">
        <h1 className="text-3xl font-bold">Refer a friend</h1>
        <p className="mt-4 text-muted-foreground">
          Referrals are available to active members who have completed
          registration.
        </p>
      </main>
    );
  }
  return <MemberReferrals />;
}

function MemberReferrals() {
  const referrals = useConvexQuery(api.referrals.listMine, {});
  const send = useConvexAction(api.referralActions.send);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof send>> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState("");

  async function sendInvitation(targetEmail: string) {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const response = await send({ email: targetEmail });
      setResult(response);
      setSelectedLink(response.url);
      if (response.sent) toast.success("Invitation sent.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not send your referral.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-8">
      <header className="space-y-2">
        <Gift className="size-8 text-primary" />
        <h1 className="text-3xl font-bold">Refer a friend</h1>
        <p className="text-lg text-muted-foreground">
          Share Access Momentum and earn $50 in credit.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Invite your friend</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We’ll email your friend an invitation. You can also copy their link
            to share yourself.
          </p>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendInvitation(email);
            }}
          >
            <Label htmlFor="friend-email">Friend’s email</Label>
            <Input
              id="friend-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
              placeholder="friend@example.com"
            />
            <Button type="submit" disabled={sending}>
              <Mail />
              {sending ? "Sending…" : "Send invitation"}
            </Button>
          </form>
          <div aria-live="polite">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {result?.warning && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {result.warning}
              </p>
            )}
          </div>
          {selectedLink && (
            <div className="space-y-2">
              <Label htmlFor="referral-link">Your friend’s referral link</Label>
              <div className="flex gap-2">
                <Input
                  id="referral-link"
                  value={selectedLink}
                  readOnly
                  onFocus={(event) => event.target.select()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy referral link"
                  onClick={() => void copyLink(selectedLink)}
                >
                  <Copy />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Your referrals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {referrals === undefined ? (
            <Spinner />
          ) : referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your referrals will appear here after you invite a friend.
            </p>
          ) : (
            referrals.map((referral) => (
              <div
                key={referral._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="break-all font-medium">
                    {referral.invitedEmail}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added {formatDateTime(referral.createdAt)} · $50 credit
                  </p>
                  <Badge variant="secondary">
                    {referralStatusLabels[referral.status]}
                  </Badge>
                  {referral.status === "invited" && !referral.lastSentAt && (
                    <p className="text-xs text-muted-foreground">
                      Email delivery not confirmed. You can share the link.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `${window.location.origin}/referral/${referral.token}`;
                      setSelectedLink(url);
                      void copyLink(url);
                    }}
                  >
                    <Copy />
                    Copy link
                  </Button>
                  {referral.status === "invited" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={sending}
                      onClick={() => void sendInvitation(referral.invitedEmail)}
                    >
                      Resend email
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <section
        className="space-y-3 text-sm text-muted-foreground"
        aria-labelledby="referral-terms"
      >
        <h2
          id="referral-terms"
          className="text-lg font-semibold text-foreground"
        >
          Referral terms
        </h2>
        <p>
          You can earn $50 in account credit when your friend becomes a new
          paying client and pays for one full month of regular classes. A trial
          or a prorated partial month alone does not qualify. Friends with
          existing trial accounts may still qualify.
        </p>
        <p>
          Our team reviews eligibility and applies the credit manually after
          confirming payment. There is one reward per referred client, assigned
          to the first referral for their email. You cannot refer yourself.
        </p>
        <p>
          Your friend must verify the email you invited. We’ll connect the
          referral even if they register without the link. “Pending review”
          means their account is connected; it does not mean credit has been
          approved.
        </p>
      </section>
    </main>
  );
}

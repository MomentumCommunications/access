import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { toast } from "sonner";
import {
  referralStatusLabels,
  type ReferralStatus,
} from "../../shared/referrals";
import { formatDateTime } from "~/lib/date-utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";

type Referral = FunctionReturnType<
  typeof api.referrals.adminForAccount
>["outgoing"][number];
type Decision = Exclude<ReferralStatus, "invited">;

export function AdminAccountReferrals({ userId }: { userId: Id<"users"> }) {
  const data = useConvexQuery(api.referrals.adminForAccount, { userId });
  if (data === undefined) return <Spinner className="m-4" />;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Check payment for a full month of regular classes, then apply the $50
        credit in billing before recording it here. Trials and prorated partial
        months alone do not qualify.
      </p>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Referred by</h2>
        {data.incoming ? (
          <ReferralCard referral={data.incoming} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No connected referral for this account.
          </p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Referrals sent</h2>
        {data.outgoing.length ? (
          data.outgoing.map((referral) => (
            <ReferralCard key={referral._id} referral={referral} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            This account has not sent any referrals.
          </p>
        )}
      </section>
    </div>
  );
}

function ReferralCard({ referral }: { referral: Referral }) {
  const update = useConvexMutation(api.referrals.adminSetStatus);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [expectedStatus, setExpectedStatus] = useState(referral.status);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDecision(next: Decision) {
    setExpectedStatus(referral.status);
    setDecision(next);
    setNote("");
    setConfirmed(false);
    setError(null);
  }

  async function save() {
    if (!decision) return;
    setSaving(true);
    setError(null);
    try {
      await update({
        referralId: referral._id,
        status: decision,
        expectedStatus,
        note,
        confirmed,
      });
      setDecision(null);
      toast.success("Referral updated.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update this referral.",
      );
    } finally {
      setSaving(false);
    }
  }

  const decisionTitle =
    decision === "credit_applied"
      ? "Mark credit applied"
      : decision === "not_eligible"
        ? "Mark not eligible"
        : "Reopen for review";
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="break-all text-base">
            {referral.invitedEmail}
          </CardTitle>
          <Badge variant="secondary">
            {referralStatusLabels[referral.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Referrer</dt>
            <dd>
              <Link
                className="underline underline-offset-4"
                to="/admin/accounts/$userId"
                params={{ userId: referral.referrer._id }}
                search={{ tab: "referrals" }}
              >
                {referral.referrer.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Referred account</dt>
            <dd>
              {referral.referred ? (
                <Link
                  className="underline underline-offset-4"
                  to="/admin/accounts/$userId"
                  params={{ userId: referral.referred._id }}
                  search={{ tab: "referrals" }}
                >
                  {referral.referred.name}
                </Link>
              ) : (
                "Awaiting verified account"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reward</dt>
            <dd>${(referral.rewardCents / 100).toFixed(2)} account credit</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{formatDateTime(referral.createdAt)}</dd>
          </div>
          {referral.connectedAt !== undefined && (
            <div>
              <dt className="text-muted-foreground">Connected</dt>
              <dd>{formatDateTime(referral.connectedAt)}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Last email sent</dt>
            <dd>
              {referral.lastSentAt === undefined
                ? "Delivery not confirmed"
                : formatDateTime(referral.lastSentAt)}
            </dd>
          </div>
        </dl>
        {referral.referred && (
          <div className="flex flex-wrap gap-2">
            {referral.status === "pending_review" ? (
              <>
                <Button
                  size="sm"
                  onClick={() => openDecision("credit_applied")}
                >
                  Mark credit applied
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openDecision("not_eligible")}
                >
                  Mark not eligible
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openDecision("pending_review")}
              >
                Reopen for review
              </Button>
            )}
          </div>
        )}
        {referral.history.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold">
              Decision history · Admin only
            </h3>
            {referral.history.map((entry, index) => (
              <div key={index} className="text-sm">
                <p>
                  {referralStatusLabels[entry.status]} · {entry.actor.name} ·{" "}
                  {formatDateTime(entry.at)}
                </p>
                {entry.note && (
                  <p className="whitespace-pre-wrap break-words text-muted-foreground">
                    {entry.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <Dialog
          open={decision !== null}
          onOpenChange={(open) => {
            if (!open && !saving) setDecision(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{decisionTitle}</DialogTitle>
              <DialogDescription>
                {decision === "pending_review"
                  ? "This only reopens the referral record. It does not reverse a billing credit. Add a correction note so other admins understand the change."
                  : decision === "credit_applied"
                    ? "This records a credit you have already applied manually. It does not change billing."
                    : "Record that this referral does not qualify for credit."}
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              {decision === "credit_applied" && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`confirm-${referral._id}`}
                    checked={confirmed}
                    onCheckedChange={(checked) =>
                      setConfirmed(checked === true)
                    }
                  />
                  <Label
                    className="leading-relaxed"
                    htmlFor={`confirm-${referral._id}`}
                  >
                    I confirmed payment for one full month of regular classes
                    and already applied the $50 credit to the referrer’s billing
                    account.
                  </Label>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor={`note-${referral._id}`}>
                  {decision === "pending_review"
                    ? "Correction note (required)"
                    : "Admin note (optional)"}
                </Label>
                <Textarea
                  id={`note-${referral._id}`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={2000}
                  required={decision === "pending_review"}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setDecision(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    saving ||
                    (decision === "credit_applied" && !confirmed) ||
                    (decision === "pending_review" && !note.trim())
                  }
                >
                  {saving ? "Saving…" : decisionTitle}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

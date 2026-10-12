import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";

type SyncStatus = {
  status: "pending" | "syncing" | "synced" | "failed";
  error?: string;
  nextRetryAt?: number;
  lastSyncedAt?: number;
};

export function AutopaySyncStatus({
  sync,
  retry,
}: {
  sync: SyncStatus | null;
  retry: () => Promise<unknown>;
}) {
  const [retrying, setRetrying] = useState(false);
  const pending = sync?.status === "pending" || sync?.status === "syncing";
  return (
    <div className="space-y-2 text-sm" role="status" aria-live="polite">
      <p
        className={
          sync?.status === "failed"
            ? "text-destructive"
            : "text-muted-foreground"
        }
      >
        {pending
          ? "Updating Stripe…"
          : sync?.status === "synced"
            ? "Stripe subscription settings are up to date."
            : sync?.status === "failed"
              ? "Stripe settings need attention."
              : "Stripe subscription settings have not been synchronized yet."}
      </p>
      {sync?.error ? (
        <p className="text-muted-foreground">{sync.error}</p>
      ) : null}
      {sync?.nextRetryAt ? (
        <p className="text-muted-foreground">
          An automatic retry is scheduled.
        </p>
      ) : null}
      {!pending && sync?.status !== "synced" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            try {
              await retry();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Unable to retry synchronization.",
              );
            } finally {
              setRetrying(false);
            }
          }}
        >
          {retrying ? "Requesting…" : "Retry Stripe synchronization"}
        </Button>
      ) : null}
    </div>
  );
}

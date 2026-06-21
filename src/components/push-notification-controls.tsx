import { useConvexMutation } from "@convex-dev/react-query";
import { BellRing, Download, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  disableDevicePush,
  disablePushSubscriptionRef,
  enableDevicePush,
  getPushDeviceState,
  registerPushSubscriptionRef,
  type PushDeviceState,
} from "~/lib/push-notifications";
import { shouldShowPushPrompt } from "../../shared/push-notifications";

const SESSION_DISMISS_KEY = "access:push-prompt-dismissed";

function usePushControls() {
  const register = useConvexMutation(registerPushSubscriptionRef);
  const disable = useConvexMutation(disablePushSubscriptionRef);
  const [state, setState] = useState<PushDeviceState>("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void getPushDeviceState().then(setState);
  }, []);

  useEffect(refresh, [refresh]);

  async function enablePush() {
    setBusy(true);
    try {
      await enableDevicePush(register);
      setState("enabled");
      toast.success("Device notifications enabled");
    } catch (error) {
      refresh();
      toast.error(
        error instanceof Error
          ? error.message
          : "Device notifications could not be enabled",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      await disableDevicePush(disable);
      setState("prompt");
      toast.success("Device notifications disabled");
    } catch (error) {
      refresh();
      toast.error(
        error instanceof Error
          ? error.message
          : "Device notifications could not be disabled",
      );
    } finally {
      setBusy(false);
    }
  }

  return { state, busy, enablePush, disablePush };
}

export function PushNotificationPrompt() {
  const { state, busy, enablePush } = usePushControls();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(SESSION_DISMISS_KEY) === "true");
  }, []);

  if (!shouldShowPushPrompt(state, dismissed)) {
    return null;
  }

  const requiresInstall = state === "requires_install";
  return (
    <div className="bg-card text-card-foreground rounded-lg border p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="bg-primary text-primary-foreground rounded-md p-2">
          {requiresInstall ? (
            <Download className="size-4" />
          ) : (
            <BellRing className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h2 className="text-sm font-semibold">
              {requiresInstall
                ? "Install Access for device alerts"
                : "Stay up to date"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {requiresInstall
                ? "On iPhone and iPad, add Access to your Home Screen before enabling notifications."
                : "Enable device notifications for enrollment updates and other important Access activity."}
            </p>
          </div>
          {requiresInstall ? (
            <Button size="sm" variant="outline" asChild>
              <a href="/help#install-app">Show me how</a>
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => void enablePush()}>
              {busy ? "Enabling..." : "Enable notifications"}
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 -m-2 shrink-0"
          aria-label="Dismiss notification prompt"
          onClick={() => {
            sessionStorage.setItem(SESSION_DISMISS_KEY, "true");
            setDismissed(true);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function PushNotificationSettings() {
  const { state, busy, enablePush, disablePush } = usePushControls();
  const content: Record<PushDeviceState, string> = {
    loading: "Checking this device…",
    unsupported: "This browser does not support device notifications.",
    missing_config: "Device notifications have not been configured yet.",
    requires_install:
      "Add Access to your iPhone or iPad Home Screen, then open the installed app to enable notifications.",
    denied:
      "Notifications are blocked. Allow Access in your browser or device notification settings, then return here.",
    prompt:
      "Receive enrollment updates and other important Access activity on this device.",
    enabled: "Device notifications are enabled for this browser installation.",
  };

  const canEnable = state === "prompt";
  const canDisable = state === "enabled";
  return (
    <div className="max-w-xl space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <BellRing className="size-4" />
        <h3 className="font-semibold">Device notifications</h3>
      </div>
      <p className="text-muted-foreground text-sm">{content[state]}</p>
      {state === "requires_install" ? (
        <Button variant="outline" asChild>
          <a href="/help#install-app">Installation instructions</a>
        </Button>
      ) : null}
      {canEnable ? (
        <Button disabled={busy} onClick={() => void enablePush()}>
          {busy ? "Enabling..." : "Enable on this device"}
        </Button>
      ) : null}
      {canDisable ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void disablePush()}
        >
          {busy ? "Disabling..." : "Disable on this device"}
        </Button>
      ) : null}
    </div>
  );
}

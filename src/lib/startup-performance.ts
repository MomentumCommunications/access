export const STARTUP_PERFORMANCE = {
  hydrationStart: "access:hydration:start",
  hydrationEnd: "access:hydration:end",
  hydrationMeasure: "access:hydration",
  authRestorationStart: "access:auth-restoration:start",
  authRestorationEnd: "access:auth-restoration:end",
  authRestorationMeasure: "access:auth-restoration",
  usersCurrentStart: "access:users-current:start",
  usersCurrentEnd: "access:users-current:end",
  usersCurrentMeasure: "access:users-current",
  shellRenderStart: "access:shell-render:start",
  shellRenderEnd: "access:shell-render:end",
  shellRenderMeasure: "access:shell-render",
  startupToShellMeasure: "access:startup-to-shell",
} as const;

function supportsUserTiming() {
  return (
    typeof performance !== "undefined" &&
    typeof performance.mark === "function" &&
    typeof performance.measure === "function"
  );
}

export function markStartupOnce(name: string) {
  if (!supportsUserTiming() || performance.getEntriesByName(name).length > 0) {
    return;
  }

  performance.mark(name);
}

export function measureStartupOnce(
  name: string,
  startMark: string,
  endMark: string,
) {
  if (
    !supportsUserTiming() ||
    performance.getEntriesByName(name, "measure").length > 0 ||
    performance.getEntriesByName(startMark, "mark").length === 0 ||
    performance.getEntriesByName(endMark, "mark").length === 0
  ) {
    return;
  }

  performance.measure(name, startMark, endMark);
}

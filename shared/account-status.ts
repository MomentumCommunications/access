export type AccountStatus = "active" | "inactive";

export function resolveAccountStatus(
  status: AccountStatus | undefined,
): AccountStatus {
  return status ?? "active";
}

export function accountStatusChanged(
  current: AccountStatus | undefined,
  next: AccountStatus,
) {
  return resolveAccountStatus(current) !== next;
}

export function accountStatusConfirmationCopy({
  status,
  householdName,
  accountName,
}: {
  status: AccountStatus;
  householdName?: string;
  accountName: string;
}) {
  if (householdName) {
    return `Do you want to mark ${householdName} as ${status}?`;
  }
  return `Do you want to mark ${accountName} and their connected students as ${status}?`;
}

export function shouldSkipSharedStudentOnInactivation({
  targetAccountIds,
  connectedAccountIds,
  accountStatuses,
}: {
  targetAccountIds: ReadonlySet<string>;
  connectedAccountIds: readonly string[];
  accountStatuses: ReadonlyMap<string, AccountStatus | undefined>;
}) {
  return connectedAccountIds.some(
    (accountId) =>
      !targetAccountIds.has(accountId) &&
      resolveAccountStatus(accountStatuses.get(accountId)) === "active",
  );
}

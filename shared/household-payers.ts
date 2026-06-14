export type HouseholdConnectionLike = {
  id: string;
  householdId: string;
  createdAt?: number;
};

export type HouseholdPayerLike = HouseholdConnectionLike & {
  userId: string;
  active: boolean;
  isPrimary: boolean;
};

function compareConnections(
  left: HouseholdConnectionLike,
  right: HouseholdConnectionLike,
) {
  return (
    (left.createdAt ?? 0) - (right.createdAt ?? 0) ||
    left.id.localeCompare(right.id)
  );
}

export function defaultHouseholdName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()} Household`.trim();
}

export function selectDefaultHouseholdConnection({
  validMemberships,
  validUserPayers,
}: {
  validMemberships: HouseholdConnectionLike[];
  validUserPayers: HouseholdConnectionLike[];
}) {
  const membership = [...validMemberships].sort(compareConnections)[0];
  if (membership) {
    return { householdId: membership.householdId, source: "membership" as const };
  }
  const payer = [...validUserPayers].sort(compareConnections)[0];
  if (payer) {
    return { householdId: payer.householdId, source: "payer" as const };
  }
  return null;
}

export function planDefaultHouseholdBilling({
  validMemberships,
  payers,
  userId,
}: {
  validMemberships: HouseholdConnectionLike[];
  payers: HouseholdPayerLike[];
  userId: string;
}) {
  const canonicalMembership = [...validMemberships].sort(compareConnections)[0];
  const householdId = canonicalMembership?.householdId;
  const householdPayers = householdId
    ? payers.filter((payer) => payer.householdId === householdId)
    : [];
  const userPayers = householdPayers
    .filter((payer) => payer.userId === userId)
    .sort(compareConnections);
  const canonicalPayer = userPayers[0];

  return {
    createHousehold: !canonicalMembership,
    canonicalMembership,
    duplicateMembershipIds: canonicalMembership
      ? validMemberships
          .filter((membership) => membership.id !== canonicalMembership.id)
          .map((membership) => membership.id)
      : [],
    createPayer: householdId !== undefined && canonicalPayer === undefined,
    canonicalPayer,
    duplicatePayerIds: userPayers.slice(1).map((payer) => payer.id),
    payerIdsToDeactivate: householdPayers
      .filter(
        (payer) =>
          payer.userId !== userId && (payer.active || payer.isPrimary),
      )
      .map((payer) => payer.id)
      .sort(),
  };
}

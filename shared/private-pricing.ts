export type PrivateParticipantCount = 1 | 2 | 3;

export type PrivateRateLike = {
  id: string;
  participants: PrivateParticipantCount;
  hourlyPriceCents: number;
  active: boolean;
  activatedAt: number;
  inactivatedAt?: number;
};

export type PrivateChargeSnapshot = {
  privateRateId: string;
  priceCents: number;
};

export function validatePrivateParticipantCount(
  participants: number,
): asserts participants is PrivateParticipantCount {
  if (participants !== 1 && participants !== 2 && participants !== 3) {
    throw new Error("Private rates require 1, 2, or 3 participants.");
  }
}

export function validatePrivateHourlyPriceCents(hourlyPriceCents: number) {
  if (
    !Number.isSafeInteger(hourlyPriceCents) ||
    hourlyPriceCents < 0
  ) {
    throw new Error("Private hourly price must be a nonnegative cent value.");
  }
}

export function calculatePrivateChargeCents(
  hourlyPriceCents: number,
  durationMinutes: number,
) {
  validatePrivateHourlyPriceCents(hourlyPriceCents);
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 480
  ) {
    throw new Error("Private lesson duration must be between 1 and 480 minutes.");
  }
  return Math.round((hourlyPriceCents * durationMinutes) / 60);
}

export function selectActivePrivateRate<T extends PrivateRateLike>(
  rates: T[],
  participants: number,
) {
  validatePrivateParticipantCount(participants);
  return rates
    .filter((rate) => rate.active && rate.participants === participants)
    .sort(
      (left, right) =>
        right.activatedAt - left.activatedAt ||
        right.id.localeCompare(left.id),
    )[0];
}

export function resolvePrivateCharge({
  billable,
  participants,
  durationMinutes,
  rates,
  snapshot,
}: {
  billable: boolean;
  participants: number;
  durationMinutes: number;
  rates: PrivateRateLike[];
  snapshot?: PrivateChargeSnapshot;
}) {
  if (!billable) {
    return { amountCents: undefined, rateId: undefined, warning: undefined };
  }
  if (snapshot) {
    return {
      amountCents: snapshot.priceCents,
      rateId: snapshot.privateRateId,
      warning: undefined,
    };
  }
  if (participants < 1 || participants > 3) {
    return {
      amountCents: undefined,
      rateId: undefined,
      warning: "Private default participant count must be between 1 and 3.",
    };
  }
  const rate = selectActivePrivateRate(rates, participants);
  if (!rate) {
    return {
      amountCents: undefined,
      rateId: undefined,
      warning: `No active private rate is configured for ${participants} participant${
        participants === 1 ? "" : "s"
      }.`,
    };
  }
  return {
    amountCents: calculatePrivateChargeCents(
      rate.hourlyPriceCents,
      durationMinutes,
    ),
    rateId: rate.id,
    warning: undefined,
  };
}

export function replaceActivePrivateRate<T extends PrivateRateLike>(
  rates: T[],
  replacement: T,
  replacedAt: number,
) {
  validatePrivateParticipantCount(replacement.participants);
  validatePrivateHourlyPriceCents(replacement.hourlyPriceCents);
  return [
    ...rates.map((rate) =>
      rate.active && rate.participants === replacement.participants
        ? { ...rate, active: false, inactivatedAt: replacedAt }
        : rate,
    ),
    replacement,
  ];
}

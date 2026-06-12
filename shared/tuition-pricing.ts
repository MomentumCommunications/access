export type TuitionTierDraftRow = {
  label: string;
  maxWeeklyHours: string;
  monthlyAmount: string;
};

export type NormalizedTuitionTier = {
  label: string;
  maxWeeklyMinutes?: number;
  monthlyAmountCents: number;
  sortOrder: number;
};

export type TuitionTierField = keyof TuitionTierDraftRow;

export type TuitionTierValidation = {
  tiers: NormalizedTuitionTier[];
  errors: Record<number, Partial<Record<TuitionTierField, string>>>;
};

const MAX_TIER_COUNT = 100;
const MAX_LABEL_LENGTH = 80;

export function isBlankTuitionTierRow(row: TuitionTierDraftRow) {
  return !row.label.trim() && !row.maxWeeklyHours.trim() && !row.monthlyAmount.trim();
}

export function parseWeeklyHours(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^(?:\d+|\d*\.\d+)$/.test(trimmed)) return null;

  const hours = Number(trimmed);
  const minutes = hours * 60;
  if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isInteger(minutes)) {
    return null;
  }
  return minutes;
}

export function parseCurrencyToCents(value: string) {
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!normalized || !/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [whole, fractional = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatWeeklyHours(minutes?: number) {
  if (minutes === undefined) return "";
  return Number((minutes / 60).toFixed(4)).toString();
}

export function formatCurrencyFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export function parseTabularText(text: string) {
  const rows = text.replace(/\r\n?/g, "\n").split("\n").map((row) => row.split("\t"));
  while (rows.length > 0 && rows.at(-1)?.every((cell) => cell === "")) {
    rows.pop();
  }
  return rows;
}

export function applyTuitionTierPaste(
  rows: TuitionTierDraftRow[],
  startRow: number,
  startColumn: number,
  pastedCells: string[][],
) {
  const fields: TuitionTierField[] = [
    "label",
    "maxWeeklyHours",
    "monthlyAmount",
  ];
  const next = rows.map((row) => ({ ...row }));
  const requiredRows = startRow + pastedCells.length;

  while (next.length < requiredRows) {
    next.push({ label: "", maxWeeklyHours: "", monthlyAmount: "" });
  }

  pastedCells.forEach((pastedRow, rowOffset) => {
    pastedRow.forEach((cell, columnOffset) => {
      const field = fields[startColumn + columnOffset];
      if (field) {
        next[startRow + rowOffset][field] = cell.trim();
      }
    });
  });

  return next;
}

export function validateTuitionTierDraftRows(
  rows: TuitionTierDraftRow[],
): TuitionTierValidation {
  const errors: TuitionTierValidation["errors"] = {};
  const populated = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !isBlankTuitionTierRow(row));

  if (populated.length > MAX_TIER_COUNT) {
    errors[populated[MAX_TIER_COUNT].index] = {
      label: `A pricing schema can contain at most ${MAX_TIER_COUNT} tiers.`,
    };
  }

  let previousMaximum = 0;
  const tiers: NormalizedTuitionTier[] = [];

  populated.forEach(({ row, index }, populatedIndex) => {
    const rowErrors: Partial<Record<TuitionTierField, string>> = {};
    const label = row.label.trim();
    if (!label) {
      rowErrors.label = "Tier name is required.";
    } else if (label.length > MAX_LABEL_LENGTH) {
      rowErrors.label = `Tier name must be ${MAX_LABEL_LENGTH} characters or fewer.`;
    }

    const maximum = parseWeeklyHours(row.maxWeeklyHours);
    const isLast = populatedIndex === populated.length - 1;
    if (maximum === null) {
      rowErrors.maxWeeklyHours =
        "Enter hours in increments that equal a whole minute.";
    } else if (maximum === undefined && !isLast) {
      rowErrors.maxWeeklyHours =
        "Only the final tier can have an unlimited maximum.";
    } else if (maximum !== undefined && maximum <= previousMaximum) {
      rowErrors.maxWeeklyHours =
        "Maximum hours must increase from the previous tier.";
    }

    const amount = parseCurrencyToCents(row.monthlyAmount);
    if (amount === null) {
      rowErrors.monthlyAmount = "Enter a valid nonnegative amount.";
    }

    if (Object.keys(rowErrors).length > 0) {
      errors[index] = rowErrors;
      return;
    }

    tiers.push({
      label,
      maxWeeklyMinutes: maximum,
      monthlyAmountCents: amount!,
      sortOrder: populatedIndex,
    });
    if (maximum !== undefined) previousMaximum = maximum;
  });

  return { tiers, errors };
}

export function validateNormalizedTuitionTiers(
  tiers: NormalizedTuitionTier[],
) {
  if (tiers.length === 0) {
    throw new Error("Add at least one tuition tier.");
  }
  if (tiers.length > MAX_TIER_COUNT) {
    throw new Error(`A pricing schema can contain at most ${MAX_TIER_COUNT} tiers.`);
  }

  let previousMaximum = 0;
  tiers.forEach((tier, index) => {
    const label = tier.label.trim();
    if (!label || label.length > MAX_LABEL_LENGTH) {
      throw new Error(`Tier ${index + 1} has an invalid name.`);
    }
    if (
      !Number.isSafeInteger(tier.monthlyAmountCents) ||
      tier.monthlyAmountCents < 0
    ) {
      throw new Error(`Tier ${index + 1} has an invalid monthly amount.`);
    }
    if (tier.sortOrder !== index) {
      throw new Error("Tuition tier sort order is invalid.");
    }
    if (tier.maxWeeklyMinutes === undefined) {
      if (index !== tiers.length - 1) {
        throw new Error("Only the final tuition tier can be unlimited.");
      }
      return;
    }
    if (
      !Number.isInteger(tier.maxWeeklyMinutes) ||
      tier.maxWeeklyMinutes <= previousMaximum
    ) {
      throw new Error("Tuition tier maximums must be positive and increasing.");
    }
    previousMaximum = tier.maxWeeklyMinutes;
  });
}

export function nextPricingSchemaVersion(
  schemas: Array<{ name: string; version: number }>,
  name: string,
) {
  const normalizedName = name.trim().toLocaleLowerCase();
  return (
    Math.max(
      0,
      ...schemas
        .filter(
          (schema) =>
            schema.name.trim().toLocaleLowerCase() === normalizedName,
        )
        .map((schema) => schema.version),
    ) + 1
  );
}

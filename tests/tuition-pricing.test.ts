import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTuitionTierPaste,
  nextPricingSchemaVersion,
  parseCurrencyToCents,
  parsePercentToBasisPoints,
  parseTabularText,
  parseWeeklyHours,
  validateSiblingDiscountConfig,
  validateNormalizedTuitionTiers,
  validateTuitionTierDraftRows,
} from "../shared/tuition-pricing.ts";

describe("tuition pricing parsing", () => {
  it("converts decimal weekly hours to exact whole minutes", () => {
    assert.equal(parseWeeklyHours("1.5"), 90);
    assert.equal(parseWeeklyHours("0.75"), 45);
    assert.equal(parseWeeklyHours("1.52"), null);
    assert.equal(parseWeeklyHours(""), undefined);
  });

  it("parses common currency values into cents", () => {
    assert.equal(parseCurrencyToCents("$1,250.00"), 125000);
    assert.equal(parseCurrencyToCents("95.5"), 9550);
    assert.equal(parseCurrencyToCents("0"), 0);
    assert.equal(parseCurrencyToCents("-10"), null);
  });

  it("parses sibling discount percentages into exact basis points", () => {
    assert.equal(parsePercentToBasisPoints("10"), 1000);
    assert.equal(parsePercentToBasisPoints("12.5"), 1250);
    assert.equal(parsePercentToBasisPoints("12.50"), 1250);
    assert.equal(parsePercentToBasisPoints("100.01"), null);
    assert.equal(parsePercentToBasisPoints("1.234"), null);
  });

  it("validates enabled and disabled sibling discount settings", () => {
    assert.doesNotThrow(() =>
      validateSiblingDiscountConfig({
        enabled: false,
        percentOffBasisPoints: 0,
        appliesTo: "all_but_highest",
      }),
    );
    assert.doesNotThrow(() =>
      validateSiblingDiscountConfig({
        enabled: true,
        percentOffBasisPoints: 1250,
        appliesTo: "all_but_highest",
      }),
    );
    assert.throws(
      () =>
        validateSiblingDiscountConfig({
          enabled: true,
          percentOffBasisPoints: 0,
          appliesTo: "all_but_highest",
        }),
      /greater than 0/,
    );
  });

  it("parses tab and newline separated clipboard text", () => {
    assert.deepEqual(
      parseTabularText("Beginner\t1\t$100\r\nIntermediate\t2\t$175\r\n"),
      [
        ["Beginner", "1", "$100"],
        ["Intermediate", "2", "$175"],
      ],
    );
  });

  it("fills from the focused cell and expands the grid", () => {
    assert.deepEqual(
      applyTuitionTierPaste(
        [{ label: "Existing", maxWeeklyHours: "", monthlyAmount: "" }],
        0,
        1,
        [
          ["1", "$100"],
          ["2", "$175"],
        ],
      ),
      [
        {
          label: "Existing",
          maxWeeklyHours: "1",
          monthlyAmount: "$100",
        },
        {
          label: "",
          maxWeeklyHours: "2",
          monthlyAmount: "$175",
        },
      ],
    );
  });
});

describe("tuition tier validation", () => {
  it("normalizes valid ascending tiers and an unlimited final tier", () => {
    assert.deepEqual(
      validateTuitionTierDraftRows([
        { label: "Tier 1", maxWeeklyHours: "1", monthlyAmount: "$100" },
        { label: "Tier 2", maxWeeklyHours: "2.5", monthlyAmount: "175.50" },
        { label: "Unlimited", maxWeeklyHours: "", monthlyAmount: "225" },
      ]),
      {
        tiers: [
          {
            label: "Tier 1",
            maxWeeklyMinutes: 60,
            monthlyAmountCents: 10000,
            sortOrder: 0,
          },
          {
            label: "Tier 2",
            maxWeeklyMinutes: 150,
            monthlyAmountCents: 17550,
            sortOrder: 1,
          },
          {
            label: "Unlimited",
            maxWeeklyMinutes: undefined,
            monthlyAmountCents: 22500,
            sortOrder: 2,
          },
        ],
        errors: {},
      },
    );
  });

  it("ignores completely blank rows and reports partial rows", () => {
    const result = validateTuitionTierDraftRows([
      { label: "", maxWeeklyHours: "", monthlyAmount: "" },
      { label: "Incomplete", maxWeeklyHours: "1", monthlyAmount: "" },
    ]);

    assert.deepEqual(result.tiers, []);
    assert.equal(
      result.errors[1].monthlyAmount,
      "Enter a valid nonnegative amount.",
    );
  });

  it("rejects non-increasing and non-final unlimited tiers", () => {
    const result = validateTuitionTierDraftRows([
      { label: "Unlimited", maxWeeklyHours: "", monthlyAmount: "100" },
      { label: "Lower", maxWeeklyHours: "1", monthlyAmount: "150" },
      { label: "Duplicate", maxWeeklyHours: "1", monthlyAmount: "175" },
    ]);

    assert.match(result.errors[0].maxWeeklyHours!, /final tier/);
    assert.match(result.errors[2].maxWeeklyHours!, /increase/);
  });

  it("validates normalized server input and immutable version numbering", () => {
    assert.throws(
      () =>
        validateNormalizedTuitionTiers([
          {
            label: "Unlimited",
            monthlyAmountCents: 10000,
            sortOrder: 0,
          },
          {
            label: "Later",
            maxWeeklyMinutes: 120,
            monthlyAmountCents: 15000,
            sortOrder: 1,
          },
        ]),
      /final tuition tier/,
    );
    assert.equal(
      nextPricingSchemaVersion(
        [
          { name: "Standard", version: 1 },
          { name: "standard", version: 2 },
          { name: "Summer", version: 5 },
        ],
        " Standard ",
      ),
      3,
    );
  });
});

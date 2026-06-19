import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveBillingRunItemSourceComponents } from "../convex/lib/billing/runSourceComponents.ts";

function legacyItem(overrides: Record<string, unknown> = {}) {
  return {
    includeTuition: false,
    sourceReferences: {
      privateChargeIds: [],
      perSessionChargeIds: [],
    },
    ...overrides,
  } as never;
}

describe("legacy billing run source component derivation", () => {
  it("derives charge-only student subtotals from frozen private prices", async () => {
    const documents = new Map<string, unknown>([
      [
        "private-a",
        {
          studentId: "student-a",
          appliedPriceCents: 3500,
        },
      ],
      [
        "private-b",
        {
          studentId: "student-a",
          appliedPriceCents: 1500,
        },
      ],
      [
        "student-a",
        {
          firstName: "Alex",
          lastName: "Rivera",
        },
      ],
    ]);
    const ctx = {
      db: {
        get: async (id: string) => documents.get(id) ?? null,
      },
    } as never;

    const result = await resolveBillingRunItemSourceComponents(
      ctx,
      legacyItem({
        sourceReferences: {
          privateChargeIds: ["private-a", "private-b"],
          perSessionChargeIds: [],
        },
      }),
    );

    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.equal(result.derived, true);
    assert.deepEqual(result.components.privateStudents, [
      {
        studentId: "student-a",
        studentName: "Alex Rivera",
        subtotalCents: 5000,
      },
    ]);
  });

  it("blocks legacy tuition drafts rather than guessing student bases", async () => {
    const result = await resolveBillingRunItemSourceComponents(
      { db: { get: async () => null } } as never,
      legacyItem({ includeTuition: true }),
    );

    assert.equal(result.status, "requires_review");
    if (result.status !== "requires_review") return;
    assert.match(result.reason, /per-student tuition amounts/i);
  });

  it("blocks mixed legacy per-session charges that cannot be separated", async () => {
    const result = await resolveBillingRunItemSourceComponents(
      { db: { get: async () => null } } as never,
      legacyItem({
        sourceReferences: {
          privateChargeIds: [],
          perSessionChargeIds: ["session-a"],
        },
      }),
    );

    assert.equal(result.status, "requires_review");
    if (result.status !== "requires_review") return;
    assert.match(result.reason, /cannot be separated safely/i);
  });
});

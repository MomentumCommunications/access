import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultHouseholdName,
  planDefaultHouseholdBilling,
  selectDefaultHouseholdConnection,
} from "../shared/household-payers.ts";

describe("default household billing setup", () => {
  it("uses a predictable household name", () => {
    assert.equal(
      defaultHouseholdName("  Ada ", " Lovelace  "),
      "Ada Lovelace Household",
    );
  });

  it("creates a household when no valid membership exists", () => {
    const plan = planDefaultHouseholdBilling({
      validMemberships: [],
      payers: [],
      userId: "user-1",
    });

    assert.equal(plan.createHousehold, true);
    assert.equal(plan.canonicalMembership, undefined);
  });

  it("reuses existing membership and requests a missing payer", () => {
    const plan = planDefaultHouseholdBilling({
      validMemberships: [
        { id: "membership-1", householdId: "household-1" },
      ],
      payers: [],
      userId: "user-1",
    });

    assert.equal(plan.createHousehold, false);
    assert.equal(plan.canonicalMembership?.id, "membership-1");
    assert.equal(plan.createPayer, true);
  });

  it("repairs a missing membership from an existing payer connection", () => {
    assert.deepEqual(
      selectDefaultHouseholdConnection({
        validMemberships: [],
        validUserPayers: [
          {
            id: "payer-1",
            householdId: "household-1",
            createdAt: 1,
          },
        ],
      }),
      {
        householdId: "household-1",
        source: "payer",
      },
    );
  });

  it("reuses payer rows and identifies duplicate connections", () => {
    const plan = planDefaultHouseholdBilling({
      validMemberships: [
        { id: "membership-2", householdId: "household-2" },
        { id: "membership-1", householdId: "household-1" },
      ],
      payers: [
        {
          id: "payer-2",
          householdId: "household-1",
          userId: "user-1",
          active: true,
          isPrimary: true,
        },
        {
          id: "payer-1",
          householdId: "household-1",
          userId: "user-1",
          active: false,
          isPrimary: false,
        },
      ],
      userId: "user-1",
    });

    assert.equal(plan.canonicalMembership?.id, "membership-1");
    assert.deepEqual(plan.duplicateMembershipIds, ["membership-2"]);
    assert.equal(plan.canonicalPayer?.id, "payer-1");
    assert.deepEqual(plan.duplicatePayerIds, ["payer-2"]);
  });

  it("deactivates competing payers in the selected household", () => {
    const plan = planDefaultHouseholdBilling({
      validMemberships: [
        { id: "membership-1", householdId: "household-1" },
      ],
      payers: [
        {
          id: "other-primary",
          householdId: "household-1",
          userId: "user-2",
          active: true,
          isPrimary: true,
        },
        {
          id: "inactive-other",
          householdId: "household-1",
          userId: "user-3",
          active: false,
          isPrimary: false,
        },
      ],
      userId: "user-1",
    });

    assert.deepEqual(plan.payerIdsToDeactivate, ["other-primary"]);
  });
});

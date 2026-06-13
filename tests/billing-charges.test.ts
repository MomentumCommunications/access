import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregatePerSessionCharges } from "../shared/billing-charges.ts";

describe("aggregatePerSessionCharges", () => {
  it("groups selected sessions by student and class", () => {
    assert.deepEqual(
      aggregatePerSessionCharges(
        [
          {
            signupId: "signup-2",
            studentId: "student-1",
            classId: "class-1",
            sessionId: "session-2",
            sessionDate: "2026-07-12",
            unitPriceCents: 2500,
          },
          {
            signupId: "signup-1",
            studentId: "student-1",
            classId: "class-1",
            sessionId: "session-1",
            sessionDate: "2026-07-05",
            unitPriceCents: 2500,
          },
        ],
        "2026-07-01",
        "2026-07-31",
      ),
      [
        {
          studentId: "student-1",
          classId: "class-1",
          periodStart: "2026-07-01",
          periodEnd: "2026-07-31",
          selectedSessionCount: 2,
          perSessionPriceCents: 2500,
          aggregateAmountCents: 5000,
          sessionIds: ["session-1", "session-2"],
          warning: undefined,
        },
      ],
    );
  });

  it("sums exact saved prices and warns when prices vary", () => {
    const [aggregate] = aggregatePerSessionCharges(
      [
        {
          signupId: "signup-1",
          studentId: "student-1",
          classId: "class-1",
          sessionId: "session-1",
          sessionDate: "2026-07-05",
          unitPriceCents: 2500,
        },
        {
          signupId: "signup-2",
          studentId: "student-1",
          classId: "class-1",
          sessionId: "session-2",
          sessionDate: "2026-07-12",
          unitPriceCents: 3000,
        },
      ],
      "2026-07-01",
      "2026-07-31",
    );

    assert.equal(aggregate.perSessionPriceCents, undefined);
    assert.equal(aggregate.aggregateAmountCents, 5500);
    assert.match(aggregate.warning || "", /different saved prices/);
  });

  it("orders aggregates deterministically", () => {
    const rows = [
      {
        signupId: "signup-2",
        studentId: "student-2",
        classId: "class-1",
        sessionId: "session-2",
        sessionDate: "2026-07-12",
        unitPriceCents: 2500,
      },
      {
        signupId: "signup-1",
        studentId: "student-1",
        classId: "class-2",
        sessionId: "session-1",
        sessionDate: "2026-07-05",
        unitPriceCents: 3000,
      },
    ];

    assert.deepEqual(
      aggregatePerSessionCharges(rows, "2026-07-01", "2026-07-31"),
      aggregatePerSessionCharges(
        [...rows].reverse(),
        "2026-07-01",
        "2026-07-31",
      ),
    );
  });
});

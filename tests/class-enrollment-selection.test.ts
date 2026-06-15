import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEnrollmentReview,
  emptyEnrollmentSelectionDraft,
  enrollmentReviewTriggerLabel,
  recurringClassSelectionStatus,
  sessionSelectionStatus,
  toggleRecurringClassSelection,
  toggleSessionSelection,
  type EnrollmentReviewClass,
} from "../shared/class-enrollment-selection.ts";

const classes: EnrollmentReviewClass[] = [
  {
    classId: "active",
    title: "Active Class",
    mode: "standard",
    enrollmentStatus: "enrolled",
    sessions: [],
  },
  {
    classId: "pending",
    title: "Pending Class",
    mode: "standard",
    enrollmentStatus: "pending",
    sessions: [],
  },
  {
    classId: "new",
    title: "New Class",
    mode: "standard",
    sessions: [],
  },
  {
    classId: "summer",
    title: "Summer Class",
    mode: "per_session",
    sessions: [
      {
        sessionId: "confirmed",
        label: "7/1/2026 · 10:00 - 11:00 AM",
        signupStatus: "enrolled",
      },
      {
        sessionId: "requested",
        label: "7/8/2026 · 10:00 - 11:00 AM",
        signupStatus: "pending",
      },
      {
        sessionId: "new-date",
        label: "7/15/2026 · 10:00 - 11:00 AM",
      },
    ],
  },
];

describe("class enrollment selection", () => {
  it("toggles recurring classes without mutating other selections", () => {
    const selected = toggleRecurringClassSelection(
      emptyEnrollmentSelectionDraft(),
      "new",
    );
    assert.deepEqual(selected.recurringClassIds, ["new"]);
    assert.deepEqual(
      toggleRecurringClassSelection(selected, "new").recurringClassIds,
      [],
    );
  });

  it("toggles per-session choices and removes empty class groups", () => {
    const selected = toggleSessionSelection(
      emptyEnrollmentSelectionDraft(),
      "summer",
      "new-date",
    );
    assert.deepEqual(selected.sessionIdsByClass, {
      summer: ["new-date"],
    });
    assert.deepEqual(
      toggleSessionSelection(
        selected,
        "summer",
        "new-date",
      ).sessionIdsByClass,
      {},
    );
  });

  it("builds current and newly selected review sections", () => {
    let draft = toggleRecurringClassSelection(
      emptyEnrollmentSelectionDraft(),
      "new",
    );
    draft = toggleSessionSelection(draft, "summer", "new-date");
    const review = buildEnrollmentReview(classes, draft);

    assert.deepEqual(
      review.currentActive.map((row) => row.classId),
      ["active", "summer"],
    );
    assert.deepEqual(
      review.currentPending.map((row) => row.classId),
      ["pending", "summer"],
    );
    assert.deepEqual(review.selectedRecurring, [
      { classId: "new", title: "New Class" },
    ]);
    assert.deepEqual(review.selectedPerSession, [
      {
        classId: "summer",
        title: "Summer Class",
        sessions: [
          {
            sessionId: "new-date",
            label: "7/15/2026 · 10:00 - 11:00 AM",
          },
        ],
      },
    ]);
    assert.equal(review.changeCount, 2);
  });

  it("returns clear active, pending, full, ineligible, and managed states", () => {
    assert.equal(
      recurringClassSelectionStatus({
        enrollmentStatus: "enrolled",
        selected: false,
        full: true,
        ageEligible: false,
        canManage: false,
      }),
      "active",
    );
    assert.equal(
      recurringClassSelectionStatus({
        enrollmentStatus: "pending",
        selected: false,
        full: false,
        ageEligible: true,
        canManage: true,
      }),
      "pending",
    );
    assert.equal(
      recurringClassSelectionStatus({
        selected: false,
        full: true,
        ageEligible: true,
        canManage: true,
      }),
      "full",
    );
    assert.equal(
      recurringClassSelectionStatus({
        selected: false,
        full: false,
        ageEligible: false,
        canManage: true,
      }),
      "ineligible",
    );
    assert.equal(
      recurringClassSelectionStatus({
        selected: false,
        full: false,
        ageEligible: true,
        canManage: false,
      }),
      "managed",
    );
    assert.equal(
      sessionSelectionStatus({
        selected: true,
        full: false,
        ageEligible: true,
        canManage: true,
      }),
      "selected",
    );
  });

  it("keeps the empty review stable when no changes exist", () => {
    const review = buildEnrollmentReview(
      classes,
      emptyEnrollmentSelectionDraft(),
    );
    assert.equal(review.changeCount, 0);
    assert.deepEqual(review.selectedRecurring, []);
    assert.deepEqual(review.selectedPerSession, []);
  });

  it("provides a compact mobile review trigger label", () => {
    assert.equal(enrollmentReviewTriggerLabel(0), "Review classes");
    assert.equal(enrollmentReviewTriggerLabel(1), "Review 1 selection");
    assert.equal(enrollmentReviewTriggerLabel(3), "Review 3 selections");
  });
});

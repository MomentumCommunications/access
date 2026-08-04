import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classDurationMinutes,
  isMarketingClassVisible,
  isValidCatalogSlug,
  marketingClassHasVacancy,
  normalizeCatalogSlug,
  toPublicInstructors,
} from "../shared/marketing-class-catalog.ts";

describe("marketing class catalog", () => {
  it("only exposes published classes without audience restrictions", () => {
    assert.equal(isMarketingClassVisible({ status: "published" }), true);
    assert.equal(isMarketingClassVisible({ status: "draft" }), false);
    assert.equal(isMarketingClassVisible({ status: "archived" }), false);
    assert.equal(
      isMarketingClassVisible({
        status: "published",
        visibleToGroupIds: ["private-group"],
      }),
      false,
    );
  });

  it("reports availability from enrollment state and capacity", () => {
    assert.equal(
      marketingClassHasVacancy({ activeEnrollmentCount: 10 }),
      true,
    );
    assert.equal(
      marketingClassHasVacancy({
        enrollmentOpen: false,
        activeEnrollmentCount: 0,
      }),
      false,
    );
    assert.equal(
      marketingClassHasVacancy({ capacity: 10, activeEnrollmentCount: 10 }),
      false,
    );
    assert.equal(
      marketingClassHasVacancy({ capacity: 10, activeEnrollmentCount: 9 }),
      true,
    );
  });

  it("calculates duration only for valid same-day time ranges", () => {
    assert.equal(classDurationMinutes("16:00", "17:30"), 90);
    assert.equal(classDurationMinutes("17:30", "16:00"), null);
    assert.equal(classDurationMinutes("not-a-time", "17:30"), null);
  });

  it("preserves one or multiple public instructor links", () => {
    assert.deepEqual(
      toPublicInstructors([
        { displayName: "Alex", staffSlug: "alex-rivera" },
        { firstName: "Sam", lastName: "Lee", staffSlug: "sam-lee" },
        null,
      ]),
      [
        { name: "Alex", staffSlug: "alex-rivera" },
        { name: "Sam Lee", staffSlug: "sam-lee" },
      ],
    );
    assert.deepEqual(toPublicInstructors([{ name: "Taylor" }]), [
      { name: "Taylor", staffSlug: null },
    ]);
  });
});

describe("catalog slugs", () => {
  it("normalizes surrounding whitespace and case", () => {
    assert.equal(normalizeCatalogSlug(" Fall-26 "), "fall-26");
    assert.equal(normalizeCatalogSlug("  "), undefined);
  });

  it("rejects unstable or path-like keys", () => {
    assert.equal(isValidCatalogSlug("fall-26"), true);
    assert.equal(isValidCatalogSlug("Fall 26"), false);
    assert.equal(isValidCatalogSlug("../fall-26"), false);
    assert.equal(isValidCatalogSlug("fall--26"), false);
  });
});
